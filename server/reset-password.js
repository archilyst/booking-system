const bcrypt = require('bcrypt');

const password = process.argv[2];
if (!password) {
    console.log('Использование: node reset-password.js <новый_пароль>');
    process.exit(1);
}

bcrypt.hash(password, 10, async (err, hash) => {
    if (err) {
        console.error('Ошибка:', err);
        process.exit(1);
    }
    
    console.log('\nХеш пароля:');
    console.log(hash);
    console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'твоя@почта.com';`);
});
