'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  const nameInput = document.getElementById('name-input');
  const emailInput = document.getElementById('email-input');
  const passwordInput = document.getElementById('password-input');
  const confirmPasswordInput = document.getElementById('confirm-password-input');
  const submitBtn = document.getElementById('register-submit-btn');
  const alertEl = document.getElementById('register-alert');

  if (!form || !nameInput || !emailInput || !passwordInput || !confirmPasswordInput || !submitBtn || !alertEl) return;

  function showAlert(message, type = 'error') {
    alertEl.textContent = message;
    alertEl.className = `form-alert active ${type}`;
    alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('loading', loading);
    submitBtn.innerHTML = loading
      ? '<span class="btn-spinner"></span> Створюємо акаунт…'
      : '<span class="btn-text">Зареєструватися</span>';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alertEl.textContent = '';
    alertEl.className = 'form-alert';

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!name) {
      showAlert('Вкажіть ім’я або ігровий псевдонім.');
      nameInput.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert('Введіть коректну адресу електронної пошти.');
      emailInput.focus();
      return;
    }
    if (password.length < 8) {
      showAlert('Пароль має містити щонайменше 8 символів.');
      passwordInput.focus();
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Паролі не збігаються. Перевірте введені значення.');
      confirmPasswordInput.focus();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showAlert(data.message || 'Не вдалося створити акаунт. Спробуйте ще раз.');
        setLoading(false);
        return;
      }

      showAlert(data.message || 'Акаунт створено.', 'success');
      window.setTimeout(() => {
        window.location.href = data.authenticated ? '/dashboard' : '/login';
      }, 700);
    } catch {
      showAlert('Не вдалося зв’язатися із сервером. Перевірте з’єднання та повторіть спробу.');
      setLoading(false);
    }
  });
});
