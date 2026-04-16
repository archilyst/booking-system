const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const path = require('path');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

function requiresAdminApproval(bookingDate, startTime) {
  const bookingDateTime = new Date(`${bookingDate}T${startTime}`);
  const now = new Date();
  const hoursDiff = (bookingDateTime - now) / (1000 * 60 * 60);
  return hoursDiff < 24;
}

async function getBookingsForDate(dateStr) {
  const result = await pool.query(`
    SELECT b.*, d.name as discipline_name
    FROM bookings b
    JOIN disciplines d ON b.discipline_id = d.id
    WHERE b.booking_date = $1::date AND b.status != 'rejected'
    ORDER BY b.start_time
  `, [dateStr]);
  return result.rows;
}

function timeToMinutes(t) {
  const p = t.split(':');
  return parseInt(p[0]) * 60 + parseInt(p[1] || '0');
}

function minutesToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

async function validateBooking(dateStr, startTime, endTime, disciplineId, tennisAddress) {
  const existingBookings = await getBookingsForDate(dateStr);

  const discResult = await pool.query('SELECT * FROM disciplines WHERE id = $1', [disciplineId]);
  if (discResult.rows.length === 0) return { valid: false, error: 'Дисциплина не найдена' };

  const newDisc = discResult.rows[0];
  const isNewTennis = newDisc.name.toLowerCase().includes('теннис');
  const isNewMath = newDisc.name.toLowerCase().includes('математик') || newDisc.name.toLowerCase().includes('информатик');

  const newStartMin = timeToMinutes(startTime);
  const newEndMin = timeToMinutes(endTime);

  for (const ex of existingBookings) {
    const exStartMin = timeToMinutes(ex.start_time);
    const exEndMin = timeToMinutes(ex.end_time);
    const exName = ex.discipline_name.toLowerCase();
    const isExTennis = exName.includes('теннис');
    const isExMath = exName.includes('математик') || exName.includes('информатик');

    if (newStartMin < exEndMin && exStartMin < newEndMin) {
      return { valid: false, error: `Время ${startTime.substring(0,5)}-${endTime.substring(0,5)} пересекается с записью (${ex.start_time.substring(0,5)}-${ex.end_time.substring(0,5)})` };
    }

    if (newStartMin < exEndMin) {
      return { valid: false, error: `Начало ${startTime.substring(0,5)} раньше окончания ${ex.end_time.substring(0,5)}` };
    }

    const gapEndMin = exEndMin + 60;

    if (newStartMin >= exEndMin && newStartMin < gapEndMin) {
      if (isExMath) {
        if (!isNewMath) {
          return { valid: false, error: `После "${ex.discipline_name}" (до ${ex.end_time.substring(0,5)}) на "${newDisc.name}" можно записаться не ранее ${minutesToTime(gapEndMin)}` };
        }
        continue;
      }

      if (isExTennis) {
        if (!isNewTennis) {
          return { valid: false, error: `После тенниса (до ${ex.end_time.substring(0,5)}) на "${newDisc.name}" можно записаться не ранее ${minutesToTime(gapEndMin)}` };
        }
        const exAddr = ex.tennis_complex_address ? ex.tennis_complex_address.trim().toLowerCase() : null;
        const newAddr = tennisAddress ? tennisAddress.trim().toLowerCase() : null;

        if (exAddr && newAddr && exAddr !== newAddr) {
          return { valid: false, error: `После тенниса в "${ex.tennis_complex_address}" на теннис в другом комплексе можно записаться не ранее ${minutesToTime(gapEndMin)}` };
        }
        continue;
      }
    }
  }

  return { valid: true };
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Неверный токен' });
    }
    req.user = user;
    next();
  });
}

function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Требуется роль администратора' });
  }
  next();
}

app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role',
      [email, passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/disciplines', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM disciplines ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения дисциплин:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.id,
        b.discipline_id,
        d.name as discipline_name,
        b.booking_date::text as booking_date,
        b.start_time,
        b.end_time,
        b.status,
        b.requires_admin_approval
      FROM bookings b
      JOIN disciplines d ON b.discipline_id = d.id
      ORDER BY b.booking_date, b.start_time
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения записей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const { discipline_id, booking_date, start_time, end_time, student_name, student_phone, tennis_complex_address } = req.body;

    if (!discipline_id || !booking_date || !start_time || !end_time || !student_name || !student_phone) {
      return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
    }

    const disciplineResult = await pool.query('SELECT * FROM disciplines WHERE id = $1', [discipline_id]);
    if (disciplineResult.rows.length === 0) {
      return res.status(404).json({ error: 'Дисциплина не найдена' });
    }

    const validation = await validateBooking(booking_date, start_time, end_time, discipline_id, tennis_complex_address);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const needsApproval = requiresAdminApproval(booking_date, start_time);

    const result = await pool.query(`
      INSERT INTO bookings
        (user_id, discipline_id, booking_date, start_time, end_time, student_name, student_phone, tennis_complex_address, requires_admin_approval, status)
      VALUES
        ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, booking_date, start_time, end_time, discipline_id, user_id
    `, [
      parseInt(req.user.id),
      discipline_id,
      booking_date,
      start_time,
      end_time,
      student_name,
      student_phone,
      tennis_complex_address || null,
      needsApproval,
      needsApproval ? 'pending' : 'confirmed'
    ]);

    res.json({ message: 'Запись создана', booking: result.rows[0] });
  } catch (error) {
    console.error('Ошибка создания записи:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/pending-bookings', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.id,
        b.user_id,
        b.discipline_id,
        d.name as discipline_name,
        b.booking_date::text as booking_date,
        b.start_time,
        b.end_time,
        b.student_name,
        b.student_phone,
        b.tennis_complex_address,
        b.requires_admin_approval,
        b.status,
        b.created_at
      FROM bookings b
      JOIN disciplines d ON b.discipline_id = d.id
      WHERE b.status = 'pending'
      ORDER BY b.booking_date, b.start_time
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения ожидающих записей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/admin/bookings/:id/approve', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comment } = req.body;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Неверное действие' });
    }

    const booking = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (booking.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    await pool.query(
      'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [action === 'approved' ? 'confirmed' : 'rejected', id]
    );

    await pool.query(
      'INSERT INTO booking_approvals (booking_id, admin_id, action, comment) VALUES ($1, $2, $3, $4)',
      [id, req.user.id, action, comment || null]
    );

    res.json({ message: action === 'approved' ? 'Запись подтверждена' : 'Запись отклонена' });
  } catch (error) {
    console.error('Ошибка обработки записи:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/bookings', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.id,
        b.user_id,
        u.email as user_email,
        b.discipline_id,
        d.name as discipline_name,
        b.booking_date::text as booking_date,
        b.start_time,
        b.end_time,
        b.student_name,
        b.student_phone,
        b.tennis_complex_address,
        b.status,
        b.requires_admin_approval,
        b.created_at
      FROM bookings b
      JOIN disciplines d ON b.discipline_id = d.id
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY b.booking_date DESC, b.start_time DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения всех записей:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

app.delete('/api/admin/bookings/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM bookings WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    res.json({ message: 'Запись удалена' });
  } catch (error) {
    console.error('Ошибка удаления записи:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/user/statistics', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.user.id);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const result = await pool.query(`
      SELECT
        d.name as discipline_name,
        SUM(
          (EXTRACT(HOUR FROM (b.end_time - b.start_time)) * 60 + EXTRACT(MINUTE FROM (b.end_time - b.start_time))) / 60.0
        ) as total_hours
      FROM bookings b
      JOIN disciplines d ON b.discipline_id = d.id
      WHERE b.user_id = $1
        AND EXTRACT(YEAR FROM b.booking_date::date) = $2
        AND EXTRACT(MONTH FROM b.booking_date::date) = $3
        AND b.status != 'rejected'
        AND b.end_time > b.start_time
      GROUP BY d.name
      ORDER BY total_hours DESC
    `, [userId, year, month]);

    const stats = result.rows.map(row => ({
      discipline_name: row.discipline_name,
      total_hours: parseFloat(row.total_hours) || 0
    }));

    res.json(stats);
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

app.post('/api/surveys', authenticateToken, async (req, res) => {
  try {
    const { disc_type, answers } = req.body;

    if (!disc_type || !answers) {
      return res.status(400).json({ error: 'Укажите тип дисциплины и ответы' });
    }

    await pool.query(`
      INSERT INTO surveys (user_id, disc_type, answers)
      VALUES ($1, $2, $3)
    `, [parseInt(req.user.id), disc_type, JSON.stringify(answers)]);

    res.json({ message: 'Опрос сохранён' });
  } catch (error) {
    console.error('Ошибка сохранения опроса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/surveys', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { disc_type } = req.query;
    let query = `
      SELECT s.id, s.user_id, u.email, s.disc_type, s.answers, s.created_at
      FROM surveys s
      LEFT JOIN users u ON s.user_id = u.id
    `;
    const params = [];

    if (disc_type) {
      query += ' WHERE s.disc_type = $1';
      params.push(disc_type);
    }

    query += ' ORDER BY s.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения опросов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/user/bookings', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.user.id);
    const result = await pool.query(`
      SELECT
        b.id,
        b.discipline_id,
        d.name as discipline_name,
        b.booking_date::text as booking_date,
        b.start_time,
        b.end_time,
        b.status
      FROM bookings b
      JOIN disciplines d ON b.discipline_id = d.id
      WHERE b.user_id = $1 AND b.status != 'rejected'
      ORDER BY b.booking_date, b.start_time
    `, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения записей пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
