const API_URL = 'http://localhost:3000/api';

let isLoginMode = true;

const authTitle = document.getElementById('auth-title');
const authForm = document.getElementById('auth-form');
const authButton = document.getElementById('auth-button');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchLink = document.getElementById('auth-switch-link');
const authError = document.getElementById('auth-error');

authSwitchLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;

    if (isLoginMode) {
        authTitle.textContent = 'Вход';
        authButton.textContent = 'Войти';
        authSwitchText.textContent = 'Нет аккаунта?';
        authSwitchLink.textContent = 'Зарегистрироваться';
    } else {
        authTitle.textContent = 'Регистрация';
        authButton.textContent = 'Зарегистрироваться';
        authSwitchText.textContent = 'Уже есть аккаунт?';
        authSwitchLink.textContent = 'Войти';
    }

    authError.textContent = '';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    authError.textContent = '';

    try {
        const endpoint = isLoginMode ? '/login' : '/register';
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Ошибка сервера');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        window.location.href = '/index.html';
    } catch (error) {
        authError.textContent = error.message;
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = '/index.html';
    }
});
