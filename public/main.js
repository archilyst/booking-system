const API_URL = 'http://localhost:3000/api';

let currentWeekStart = null;
let allBookings = [];
let userBookings = [];
let disciplines = [];
let currentUser = null;
let remindersInterval = null;

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (!token || !user) { window.location.href = '/auth.html'; return false; }
    currentUser = JSON.parse(user);
    document.getElementById('user-email').textContent = currentUser.email;
    if (currentUser.role === 'admin') document.getElementById('admin-panel-button').classList.remove('hidden');
    return true;
}

document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('token'); localStorage.removeItem('user');
    window.location.href = '/auth.html';
});

async function loadDisciplines() {
    try {
        const r = await fetch(`${API_URL}/disciplines`);
        if (!r.ok) return;
        disciplines = await r.json();
        renderDisciplines();
    } catch (e) { console.error(e); }
}

function getDiscById(id) { return disciplines.find(d => d.id == id); }

function renderDisciplines() {
    const c = document.getElementById('disciplines-list');
    c.innerHTML = '';
    disciplines.forEach(d => {
        const name = d.name.toLowerCase();
        const isT = name.includes('теннис');
        const desc = getDisciplineDescription(name);
        const card = document.createElement('div');
        card.className = 'discipline-card';
        card.innerHTML = `
            <div class="discipline-header">
                <div class="discipline-info">
                    <div class="discipline-name">${d.name}</div>
                    <div class="discipline-price">${d.price_per_hour} ₽/час</div>
                </div>
                <span class="discipline-arrow">▼</span>
            </div>
            <div class="discipline-details">
                <div class="discipline-content">
                    <div class="discipline-full-desc">${desc}</div>
                    <div class="discipline-actions">
                        <button class="book-button" data-id="${d.id}" data-name="${d.name}" ${isT ? 'data-tennis="true"' : ''}>Записаться</button>
                        <button class="survey-button" data-disc="${name}">📋 Опрос</button>
                    </div>
                </div>
            </div>`;
        c.appendChild(card);
    });
    c.querySelectorAll('.discipline-header').forEach(h => h.addEventListener('click', () => h.parentElement.classList.toggle('expanded')));
    c.querySelectorAll('.book-button').forEach(btn => btn.addEventListener('click', () => openBookingModal(btn.dataset.id, btn.dataset.name, btn.dataset.tennis === 'true')));
    c.querySelectorAll('.survey-button').forEach(btn => btn.addEventListener('click', () => openSurveyModal(btn.dataset.disc)));
}

function getDisciplineDescription(name) {
    if (name.includes('математик')) {
        return `<p><strong>Кому:</strong> школьникам (любой класс) и студентам первых курсов, кому нужна понятная математика без страха.</p>
            <p><strong>Как работаю:</strong> Объясняю сложные темы максимально подробно и без воды. Не повышаю голос и не давлю — стрессоустойчивость моя профессиональная черта. Домашние задания обязательны, без них прогресса не будет.</p>
            <p><strong>Формат:</strong> онлайн, длительность под вас (хоть 30 минут, хоть 3 часа).</p>
            <p><strong>Результат:</strong> Ученица поднялась с двойки до твёрдой четвёрки на ОГЭ.</p>
            <p><strong>Записаться:</strong> пробное занятие — разбор вашей самой непонятной темы.</p>`;
    }
    if (name.includes('информатик')) {
        return `<p><strong>Кому:</strong> тем, кто никогда не программировал, но хочет сдать ОГЭ/ЕГЭ и понимать язык, а не зубрить.</p>
            <p><strong>Подход:</strong> 70% практики, 30% нужной теории. Учимся писать код на Python так, чтобы решать любые задачи, а не заученные шаблоны.</p>
            <p><strong>Результат:</strong> Две ученицы начали с полного нуля и сдали ОГЭ по информатике на пятёрки.</p>
            <p><strong>Формат:</strong> онлайн, гибкая длительность.</p>
            <p><strong>Записаться:</strong> первое занятие — пишем первую работающую программу за 20 минут.</p>`;
    }
    if (name.includes('тренер') && name.includes('теннис')) {
        return `<p><strong>Кому:</strong> дети (постановка техники), взрослые с нуля (без неловкости и спешки), игроки среднего уровня (отточить элементы), корпоративные клиенты.</p>
            <p><strong>Что я даю:</strong> Помогаю с любыми трудностями — от держания ракетки до топспина. Учим конкретный элемент столько, сколько нужно, без подгонки под шаблон.</p>
            <p><strong>Условия:</strong> Корт арендует клиент. Я привожу свою корзину мячей и при необходимости ракетку.</p>
            <p><strong>Записаться:</strong> разовая тренировка на отработку вашего самого проблемного удара.</p>`;
    }
    if (name.includes('спаринг')) {
        return `<p><strong>Кому:</strong> кому не хватает агрессивного, живого спарринг-партнёра с высоким темпом и борьбой на каждом мяче.</p>
            <p><strong>Обо мне:</strong> 6 лет игрового опыта, агрессивный стиль. Давлю на корте, заставляю двигаться, выходить из зоны комфорта — идеально, если готовитесь к турниру или просто любите жёсткую игру.</p>
            <p><strong>Формат:</strong> корт оплачивается отдельно клиентом. Длительность — от 1 часа.</p>
            <p><strong>Записаться:</strong> один спарринг-сет без обязательств, чтобы понять наш темп.</p>`;
    }
    return 'Индивидуальные занятия.';
}

function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff); d.setHours(0, 0, 0, 0);
    return d;
}

function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function timeToMinutes(t) {
    if (!t) return 0;
    const p = t.split(':');
    return parseInt(p[0]) * 60 + parseInt(p[1] || '0');
}

function minutesToTime(m) {
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function renderWeeklyCalendar() {
    const monday = getMonday(currentWeekStart);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    document.getElementById('current-week-label').textContent =
        `${monday.getDate()} ${months[monday.getMonth()]} — ${sunday.getDate()} ${months[sunday.getMonth()]} ${sunday.getFullYear()}`;

    const container = document.getElementById('weekly-calendar');
    container.innerHTML = '';
    const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    const todayStr = fmtDate(new Date());

    for (let i = 0; i < 7; i++) {
        const dd = new Date(monday);
        dd.setDate(monday.getDate() + i);
        const dateStr = fmtDate(dd);

        const col = document.createElement('div');
        col.className = 'week-day-column';

        const hdr = document.createElement('div');
        hdr.className = 'week-day-header' + (dateStr === todayStr ? ' today' : '');
        hdr.textContent = `${dayNames[i]}, ${dd.getDate()}`;
        col.appendChild(hdr);

        const area = document.createElement('div');
        area.className = 'week-day-bookings';

        const dayB = allBookings.filter(b => {
            const bd = b.booking_date ? b.booking_date.split('T')[0] : '';
            return bd === dateStr && b.status !== 'rejected' && b.start_time && b.end_time;
        });

        if (dayB.length === 0) {
            area.innerHTML = '<div class="day-empty">Нет записей</div>';
        } else {
            dayB.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

            dayB.forEach(b => {
                const disc = getDiscById(b.discipline_id);
                if (!disc) return;

                const startMin = timeToMinutes(b.start_time);
                const endMin = timeToMinutes(b.end_time);
                if (endMin <= startMin) return;

                const isMath = disc.name.toLowerCase().includes('математик') || disc.name.toLowerCase().includes('информатик');
                const block = document.createElement('div');
                block.className = 'booking-card ' + (isMath ? 'math' : 'tennis');
                block.innerHTML = `
                    <div class="booking-card-time">${minutesToTime(startMin)}–${minutesToTime(endMin)}</div>
                    <div class="booking-card-name">${disc.name}</div>
                `;
                block.title = `${disc.name}\n${minutesToTime(startMin)} — ${minutesToTime(endMin)}`;
                area.appendChild(block);
            });
        }

        col.appendChild(area);
        container.appendChild(col);
    }
}

document.getElementById('prev-week').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderWeeklyCalendar();
});
document.getElementById('next-week').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderWeeklyCalendar();
});

async function loadBookings() {
    try {
        const r = await fetch(`${API_URL}/bookings`);
        if (!r.ok) return;
        allBookings = await r.json();
        renderWeeklyCalendar();
    } catch (e) { console.error(e); }
}

async function loadUserBookings() {
    try {
        const token = localStorage.getItem('token');
        const r = await fetch(`${API_URL}/user/bookings`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!r.ok) return;
        userBookings = await r.json();
        checkReminders();
    } catch (e) { console.error(e); }
}

function openBookingModal(discId, discName, isTennis) {
    document.getElementById('modal-discipline-name').value = discName;
    document.getElementById('modal-discipline-id').value = discId;
    const tg = document.getElementById('tennis-address-group');
    if (isTennis) tg.classList.remove('hidden'); else { tg.classList.add('hidden'); document.getElementById('modal-tennis-address').value = ''; }
    document.getElementById('modal-booking-date').value = '';
    document.getElementById('modal-start-time').value = '';
    document.getElementById('modal-end-time').value = '';
    document.getElementById('modal-student-name').value = '';
    document.getElementById('modal-student-phone').value = '';
    document.getElementById('booking-price').textContent = '';
    document.getElementById('booking-error').textContent = '';
    document.getElementById('booking-success').textContent = '';
    document.getElementById('multi-booking-fields').classList.add('hidden');
    document.getElementById('multi-weeks-count').value = '4';
    document.getElementById('available-slots-info').innerHTML = '';
    document.getElementById('booking-modal').classList.remove('hidden');
}

document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => b.closest('.modal').classList.add('hidden')));
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); }));

document.getElementById('contacts-button').addEventListener('click', () => document.getElementById('contacts-modal').classList.remove('hidden'));

document.getElementById('modal-booking-date').addEventListener('change', async function() {
    const dateVal = this.value;
    const info = document.getElementById('available-slots-info');
    if (!dateVal) { info.innerHTML = ''; return; }
    info.innerHTML = '<span style="color:var(--text-secondary);font-size:0.8rem;">Загрузка...</span>';
    try {
        const r = await fetch(`${API_URL}/bookings`);
        if (!r.ok) { info.innerHTML = ''; return; }
        const all = await r.json();
        const dayB = all.filter(b => { const bd = b.booking_date ? b.booking_date.split('T')[0] : ''; return bd === dateVal && b.status !== 'rejected'; });
        if (!dayB.length) { info.innerHTML = '<span style="color:var(--success);font-size:0.8rem;">✓ Весь день свободен</span>'; return; }
        const occupied = dayB.map(b => ({ s: timeToMinutes(b.start_time), e: timeToMinutes(b.end_time), name: b.discipline_name })).sort((a,b) => a.s - b.s);
        let lines = [];
        let lastEnd = 7 * 60;
        occupied.forEach(o => {
            if (o.s > lastEnd) {
                lines.push(`<span style="color:var(--success);font-size:0.8rem;">✓ Свободно: ${minutesToTime(lastEnd)} – ${minutesToTime(o.s)}</span>`);
            }
            lastEnd = Math.max(lastEnd, o.e);
            lines.push(`<span style="color:var(--error);font-size:0.75rem;">✗ ${minutesToTime(o.s)}–${minutesToTime(o.e)} (${o.name})</span>`);
        });
        if (lastEnd < 23 * 60) lines.push(`<span style="color:var(--success);font-size:0.8rem;">✓ Свободно с: ${minutesToTime(lastEnd)}</span>`);
        info.innerHTML = lines.join('<br>');
    } catch(e) { info.innerHTML = ''; }
});

['modal-start-time','modal-end-time'].forEach(id => document.getElementById(id).addEventListener('change', calculatePrice));

function calculatePrice() {
    const s = document.getElementById('modal-start-time').value;
    const e = document.getElementById('modal-end-time').value;
    const discId = document.getElementById('modal-discipline-id').value;
    if (!s || !e || !discId) return;
    const startMin = timeToMinutes(s);
    const endMin = timeToMinutes(e);
    if (endMin <= startMin) { document.getElementById('booking-price').textContent = 'Неверное время'; return; }
    const hrs = (endMin - startMin) / 60;
    const disc = getDiscById(discId);
    if (disc) document.getElementById('booking-price').textContent = `Стоимость: ${(hrs * disc.price_per_hour).toFixed(2)} ₽ (${hrs} ч.)`;
}

document.getElementById('multi-booking-toggle').addEventListener('click', () => document.getElementById('multi-booking-fields').classList.toggle('hidden'));

document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const discId = document.getElementById('modal-discipline-id').value;
    const dateVal = document.getElementById('modal-booking-date').value;
    const sTime = document.getElementById('modal-start-time').value;
    const eTime = document.getElementById('modal-end-time').value;
    const sName = document.getElementById('modal-student-name').value;
    const sPhone = document.getElementById('modal-student-phone').value;
    const tAddr = document.getElementById('modal-tennis-address').value;
    const isMulti = !document.getElementById('multi-booking-fields').classList.contains('hidden');
    const weeks = parseInt(document.getElementById('multi-weeks-count').value) || 1;
    const errP = document.getElementById('booking-error');
    const okP = document.getElementById('booking-success');
    errP.textContent = '';
    okP.textContent = '';
    if (!dateVal || !sTime || !eTime) { errP.textContent = 'Заполните все поля'; return; }

    const body = {
        discipline_id: parseInt(discId),
        booking_date: dateVal,
        start_time: sTime,
        end_time: eTime,
        student_name: sName,
        student_phone: sPhone,
        tennis_complex_address: tAddr || null
    };

    try {
        if (isMulti && weeks > 1) {
            let ok = 0, fail = 0;
            const errors = [];
            for (let w = 0; w < weeks; w++) {
                const parts = dateVal.split('-');
                const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                d.setDate(d.getDate() + w * 7);
                const ds = fmtDate(d);
                const r = await fetch(`${API_URL}/bookings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ ...body, booking_date: ds })
                });
                if (r.ok) {
                    ok++;
                } else {
                    fail++;
                    const errData = await r.json().catch(() => ({}));
                    errors.push(`${ds}: ${errData.error || 'ошибка'}`);
                }
            }
            if (ok > 0) {
                okP.textContent = `Создано: ${ok}` + (fail > 0 ? `, пропущено: ${fail}` : '');
                if (errors.length > 0) okP.textContent += '\n' + errors.join('\n');
                await loadBookings();
                await loadUserBookings();
                setTimeout(() => document.getElementById('booking-modal').classList.add('hidden'), 1500);
            } else {
                errP.textContent = 'Не удалось создать записи: ' + errors.join('; ');
            }
        } else {
            const r = await fetch(`${API_URL}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(body)
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Ошибка');
            okP.textContent = 'Запись создана!';
            await loadBookings();
            await loadUserBookings();
            setTimeout(() => document.getElementById('booking-modal').classList.add('hidden'), 1000);
        }
    } catch(err) {
        errP.textContent = err.message;
    }
});

document.getElementById('statistics-button').addEventListener('click', async () => {
    const modal = document.getElementById('statistics-modal');
    const content = document.getElementById('statistics-content');
    content.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">Загрузка...</p>';
    modal.classList.remove('hidden');
    try {
        const token = localStorage.getItem('token');
        const r = await fetch(`${API_URL}/user/statistics`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!r.ok) throw new Error();
        const stats = await r.json();
        content.innerHTML = '';
        let has = false;
        stats.forEach(s => {
            const h = parseFloat(s.total_hours);
            if (h <= 0) return;
            has = true;
            const row = document.createElement('div');
            row.className = 'stat-row';
            row.innerHTML = `<span class="stat-name">${s.discipline_name}</span><span class="stat-hours">${h.toFixed(1)} ч.</span>`;
            content.appendChild(row);
        });
        if (!has) content.innerHTML = '<div class="stat-empty">Нет данных за этот месяц</div>';
    } catch(e) {
        content.innerHTML = '<div class="stat-empty">Ошибка загрузки</div>';
    }
});

function checkReminders() {
    const now = new Date();
    const upcoming = userBookings.filter(b => {
        if (!b.booking_date || !b.start_time) return false;
        const dt = new Date(b.booking_date + 'T' + b.start_time.substring(0, 8));
        const h = (dt - now) / (1000 * 60 * 60);
        return h > 1 && h < 48;
    });
    const panel = document.getElementById('reminders-panel');
    const list = document.getElementById('reminders-list');
    if (!upcoming.length) { panel.classList.remove('visible'); return; }
    panel.classList.add('visible');
    list.innerHTML = '';
    upcoming.forEach(b => {
        const disc = getDiscById(b.discipline_id);
        if (!disc) return;
        const dt = new Date(b.booking_date + 'T' + b.start_time.substring(0, 8));
        const diffMs = dt - now;
        const hLeft = Math.floor(diffMs / (1000 * 60 * 60));
        const mLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const item = document.createElement('div');
        item.className = 'reminder-item';
        item.innerHTML = `<div class="reminder-discipline">${disc.name}</div><div class="reminder-time">⏰ Через ${hLeft} ч ${mLeft} мин<br><small>${b.booking_date}, ${b.start_time.substring(0,5)}</small></div>`;
        list.appendChild(item);
    });
}

document.getElementById('reminders-close').addEventListener('click', () => document.getElementById('reminders-panel').classList.remove('visible'));

const surveys = {
    'математик': {
        title: 'Опрос — Математика',
        questions: [
            { id: 'class', label: 'В каком вы классе?', type: 'text', required: false },
            { id: 'exam', label: 'Какой экзамен / задача сейчас стоит?', type: 'radio', options: ['ОГЭ', 'ЕГЭ (база)', 'ЕГЭ (профиль)', 'Помощь с 1 курсом (мат. анализ, линал и т.д.)', 'Без экзамена, подтянуть оценки'] },
            { id: 'problems', label: 'Что конкретно не получается? (можно выбрать несколько)', type: 'checkbox', options: ['Не понимаю теорию вообще', 'Решаю, но медленно', 'Делаю глупые ошибки на ровном месте', 'Путаюсь в формулах / алгоритмах'] },
            { id: 'homework', label: 'Готовы ли делать домашние задания? (честно)', type: 'radio', options: ['Да, регулярно', 'Да, но не всегда есть время', 'Хочу только на занятиях'] }
        ]
    },
    'информатик': {
        title: 'Опрос — Информатика',
        questions: [
            { id: 'class', label: 'В каком вы классе?', type: 'text', required: false },
            { id: 'exam', label: 'Какой экзамен / задача сейчас стоит?', type: 'radio', options: ['ОГЭ', 'ЕГЭ (база)', 'ЕГЭ (профиль)', 'Помощь с 1 курсом', 'Без экзамена, подтянуть'] },
            { id: 'problems', label: 'Что конкретно не получается? (можно выбрать несколько)', type: 'checkbox', options: ['Не понимаю теорию вообще', 'Решаю, но медленно', 'Делаю глупые ошибки', 'Путаюсь в синтаксисе / алгоритмах'] },
            { id: 'homework', label: 'Готовы ли делать домашние задания? (честно)', type: 'radio', options: ['Да, регулярно', 'Да, но не всегда есть время', 'Хочу только на занятиях'] }
        ]
    },
    'тренер': {
        title: 'Опрос — Тренер по теннису',
        questions: [
            { id: 'experience', label: 'Ваш опыт в теннисе:', type: 'radio', options: ['Никогда не держал(а) ракетку', 'Играл(а) пару раз для удовольствия', 'Есть база, но без ударов слева/подачи', 'Играю регулярно, но хочу конкретный элемент'] },
            { id: 'shots', label: 'Какие удары уже есть? (можно выбрать несколько)', type: 'checkbox', options: ['Форхенд', 'Бэкхенд (одной рукой)', 'Бэкхенд (двумя руками)', 'Подача', 'Смэш', 'Выход к сетке'] },
            { id: 'hand', label: 'Вы левша или правша?', type: 'radio', options: ['Левша', 'Правша'] },
            { id: 'problem', label: 'Ваша главная проблема сейчас:', type: 'radio', options: ['Не попадаю в корт', 'Нет стабильности', 'Слабая физика / быстро устаю', 'Плохая работа ног'] },
            { id: 'goal', label: 'Цель:', type: 'radio', options: ['Научиться держать мяч в игре', 'Обыгрывать друзей', 'Участвовать в любительских турнирах', 'Корпоратив / активный отдых'] }
        ]
    },
    'спаринг': {
        title: 'Опрос — Спарринг по теннису',
        questions: [
            { id: 'level', label: 'Ваш уровень (разряд / рейтинг / опыт в годах):', type: 'text', required: false },
            { id: 'style', label: 'Какой стиль игры вам нужен?', type: 'radio', options: ['Агрессивный (давление, атака с форхенда)', 'Контратакующий (ждите мою ошибку)', 'Ровный темп (просто подержать мяч)', 'Разный, под задачи'] },
            { id: 'train', label: 'Что хотите проверить / натренировать в спарринге? (можно выбрать несколько)', type: 'checkbox', options: ['Стабильность под давлением', 'Игру с бэкхенда', 'Приём подачи', 'Движение по корту', 'Психологию счёта'] }
        ]
    }
};

function getSurveyKey(discName) {
    if (discName.includes('математик')) return 'математик';
    if (discName.includes('информатик')) return 'информатик';
    if (discName.includes('тренер')) return 'тренер';
    if (discName.includes('спаринг')) return 'спаринг';
    return null;
}

function openSurveyModal(discName) {
    const key = getSurveyKey(discName);
    if (!key || !surveys[key]) return;

    const survey = surveys[key];
    const title = document.getElementById('survey-title');
    const form = document.getElementById('survey-form');

    title.textContent = survey.title;
    form.innerHTML = '';

    survey.questions.forEach((q, qi) => {
        const qDiv = document.createElement('div');
        qDiv.className = 'survey-question';

        const qLabel = document.createElement('label');
        qLabel.textContent = q.label;
        qDiv.appendChild(qLabel);

        const optsDiv = document.createElement('div');
        optsDiv.className = 'survey-options';

        if (q.type === 'text') {
            const input = document.createElement('input');
            input.type = 'text';
            input.name = `q_${qi}`;
            input.placeholder = 'Ваш ответ...';
            input.dataset.questionId = q.id;
            optsDiv.appendChild(input);
        } else if (q.type === 'radio') {
            q.options.forEach(opt => {
                const label = document.createElement('label');
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `q_${qi}`;
                radio.value = opt;
                radio.dataset.questionId = q.id;
                label.appendChild(radio);
                label.appendChild(document.createTextNode(opt));
                optsDiv.appendChild(label);
            });
        } else if (q.type === 'checkbox') {
            q.options.forEach(opt => {
                const label = document.createElement('label');
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.name = `q_${qi}`;
                cb.value = opt;
                cb.dataset.questionId = q.id;
                label.appendChild(cb);
                label.appendChild(document.createTextNode(opt));
                optsDiv.appendChild(label);
            });
        }

        qDiv.appendChild(optsDiv);
        form.appendChild(qDiv);
    });

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'survey-submit';
    submitBtn.textContent = 'Отправить ответ';
    form.appendChild(submitBtn);

    const successMsg = document.createElement('div');
    successMsg.className = 'survey-success hidden';
    successMsg.id = 'survey-success';
    form.appendChild(successMsg);

    const errorMsg = document.createElement('div');
    errorMsg.className = 'survey-error hidden';
    errorMsg.id = 'survey-error';
    form.appendChild(errorMsg);

    document.getElementById('survey-modal').classList.remove('hidden');
}

document.getElementById('survey-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const successEl = document.getElementById('survey-success');
    const errorEl = document.getElementById('survey-error');
    successEl.classList.add('hidden');
    errorEl.classList.add('hidden');

    const answers = {};
    const questions = form.querySelectorAll('.survey-question');

    questions.forEach(qDiv => {
        const questionId = qDiv.querySelector('[data-question-id]')?.dataset.questionId;
        if (!questionId) return;

        const radios = qDiv.querySelectorAll('input[type="radio"]:checked');
        const checkboxes = qDiv.querySelectorAll('input[type="checkbox"]:checked');
        const textInput = qDiv.querySelector('input[type="text"]');

        if (textInput) {
            answers[questionId] = textInput.value;
        } else if (radios.length > 0) {
            answers[questionId] = radios[0].value;
        } else if (checkboxes.length > 0) {
            answers[questionId] = Array.from(checkboxes).map(cb => cb.value);
        }
    });

    const title = document.getElementById('survey-title').textContent;
    let discType = '';
    if (title.includes('Математика')) discType = 'math';
    else if (title.includes('Информатика')) discType = 'cs';
    else if (title.includes('Тренер')) discType = 'tennis_coach';
    else if (title.includes('Спарринг')) discType = 'tennis_sparring';

    try {
        const token = localStorage.getItem('token');
        const r = await fetch(`${API_URL}/surveys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ disc_type: discType, answers })
        });

        if (r.ok) {
            successEl.textContent = 'Ответы отправлены! Спасибо за обратную связь.';
            successEl.classList.remove('hidden');
            setTimeout(() => document.getElementById('survey-modal').classList.add('hidden'), 2000);
        } else {
            const data = await r.json();
            throw new Error(data.error || 'Ошибка отправки');
        }
    } catch(err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
    }
});

let allSurveys = [];
let currentSurveyFilter = 'all';

const surveyLabels = {
    math: 'Математика',
    cs: 'Информатика',
    tennis_coach: 'Тренер',
    tennis_sparring: 'Спарринг'
};

const questionNames = {
    math: { class: 'Класс', exam: 'Экзамен', problems: 'Проблемы', homework: 'Домашние задания' },
    cs: { class: 'Класс', exam: 'Экзамен', problems: 'Проблемы', homework: 'Домашние задания' },
    tennis_coach: { experience: 'Опыт', shots: 'Удары', hand: 'Рука', problem: 'Проблема', goal: 'Цель' },
    tennis_sparring: { level: 'Уровень', style: 'Стиль', train: 'Тренировать' }
};

async function loadSurveys(filter = 'all') {
    try {
        const url = filter === 'all'
            ? `${API_URL}/admin/surveys`
            : `${API_URL}/admin/surveys?disc_type=${filter}`;
        const r = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        if (!r.ok) return;
        allSurveys = await r.json();
        renderSurveys();
    } catch(e) { console.error(e); }
}

function renderSurveys() {
    const list = document.getElementById('surveys-list');
    list.innerHTML = '';

    if (!allSurveys.length) {
        list.innerHTML = '<div class="survey-empty">Нет ответов на опросы</div>';
        return;
    }

    allSurveys.forEach(s => {
        const item = document.createElement('div');
        item.className = 'survey-answer-item';

        const qNames = questionNames[s.disc_type] || {};
        const discLabel = surveyLabels[s.disc_type] || s.disc_type;
        const date = s.created_at ? new Date(s.created_at).toLocaleString('ru-RU') : '';

        let bodyHTML = '';
        const answers = typeof s.answers === 'string' ? JSON.parse(s.answers) : s.answers;

        Object.keys(answers).forEach(key => {
            let val = answers[key];
            if (Array.isArray(val)) val = val.join(', ');
            const label = qNames[key] || key;
            if (val) {
                bodyHTML += `<div class="survey-answer-row"><span class="q-label">${label}:</span><span class="q-value">${val}</span></div>`;
            }
        });

        item.innerHTML = `
            <div class="survey-answer-header">
                <span>👤 ${s.email || 'Аноним'} · <small>${date}</small></span>
                <span class="survey-answer-disc">${discLabel}</span>
            </div>
            <div class="survey-answer-body">${bodyHTML}</div>
        `;
        list.appendChild(item);
    });
}

document.querySelectorAll('.survey-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.survey-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSurveyFilter = btn.dataset.filter;
        loadSurveys(currentSurveyFilter);
    });
});

document.getElementById('admin-panel-button').addEventListener('click', () => {
    document.getElementById('admin-modal').classList.remove('hidden');
    loadPendingBookings();
    loadAllBookings();
    loadSurveys();
});
document.querySelectorAll('.tab-button').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab-button').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById(t.dataset.tab + '-bookings').classList.add('active');
}));

async function loadPendingBookings() {
    try {
        const r = await fetch(`${API_URL}/admin/pending-bookings`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        if (!r.ok) return;
        const bookings = await r.json();
        const list = document.getElementById('pending-list');
        list.innerHTML = '';
        if (!bookings.length) { list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;">Нет ожидающих</p>'; return; }
        bookings.forEach(b => {
            const item = document.createElement('div');
            item.className = 'admin-booking-item';
            item.innerHTML = `<div class="admin-booking-info"><p><strong>Дисциплина:</strong> ${b.discipline_name}</p><p><strong>Дата:</strong> ${b.booking_date}</p><p><strong>Время:</strong> ${b.start_time} – ${b.end_time}</p><p><strong>Имя:</strong> ${b.student_name}</p><p><strong>Телефон:</strong> ${b.student_phone}</p>${b.tennis_complex_address ? `<p><strong>Адрес:</strong> ${b.tennis_complex_address}</p>` : ''}</div><div class="admin-actions"><button class="approve-button" onclick="approveBooking(${b.id},'approved')">Подтвердить</button><button class="reject-button" onclick="approveBooking(${b.id},'rejected')">Отклонить</button></div>`;
            list.appendChild(item);
        });
    } catch(e) { console.error(e); }
}

async function approveBooking(id, action) {
    try {
        const r = await fetch(`${API_URL}/admin/bookings/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ action })
        });
        if (r.ok) { await loadPendingBookings(); await loadAllBookings(); await loadBookings(); }
    } catch(e) { console.error(e); }
}

async function loadAllBookings() {
    try {
        const r = await fetch(`${API_URL}/admin/bookings`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        if (!r.ok) return;
        const bookings = await r.json();
        const list = document.getElementById('all-list');
        list.innerHTML = '';
        if (!bookings.length) { list.innerHTML = '<p style="color:var(--text-secondary);text-align:center;">Нет записей</p>'; return; }
        bookings.forEach(b => {
            const item = document.createElement('div');
            item.className = 'admin-booking-item';
            item.style.borderLeftColor = b.status === 'confirmed' ? 'var(--success)' : 'var(--warning)';
            item.innerHTML = `<div class="admin-booking-info"><p><strong>Дисциплина:</strong> ${b.discipline_name}</p><p><strong>Дата:</strong> ${b.booking_date}</p><p><strong>Время:</strong> ${b.start_time} – ${b.end_time}</p><p><strong>Имя:</strong> ${b.student_name}</p><p><strong>Телефон:</strong> ${b.student_phone}</p>${b.tennis_complex_address ? `<p><strong>Адрес:</strong> ${b.tennis_complex_address}</p>` : ''}<p><strong>Статус:</strong> ${b.status === 'confirmed' ? 'Подтверждено' : 'Ожидает'}</p></div><div class="admin-actions"><button class="delete-button" onclick="deleteBooking(${b.id})">Удалить</button></div>`;
            list.appendChild(item);
        });
    } catch(e) { console.error(e); }
}

async function deleteBooking(id) {
    if (!confirm('Удалить?')) return;
    try {
        const r = await fetch(`${API_URL}/admin/bookings/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (r.ok) { await loadAllBookings(); await loadPendingBookings(); await loadBookings(); }
    } catch(e) { console.error(e); }
}

window.addEventListener('DOMContentLoaded', () => {
    if (checkAuth()) {
        currentWeekStart = getMonday(new Date());
        loadDisciplines();
        loadBookings();
        loadUserBookings();
        checkReminders();
        remindersInterval = setInterval(checkReminders, 60000);
    }
});
