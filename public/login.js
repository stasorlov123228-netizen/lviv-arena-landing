'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const loginInput = document.getElementById('login-input');
  const passwordInput = document.getElementById('password-input');
  const submitBtn = document.getElementById('login-submit-btn');
  const alertEl = document.getElementById('login-alert');

  if (!form || !loginInput || !passwordInput || !submitBtn || !alertEl) {
    return;
  }

  function showAlert(message, type = 'error') {
    alertEl.textContent = message;
    alertEl.className = `form-alert active ${type}`;
    alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideAlert() {
    alertEl.textContent = '';
    alertEl.className = 'form-alert';
  }

  function setLoading(loading) {
    if (loading) {
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Вхід...';
    } else {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
      submitBtn.innerHTML = '<span class="btn-text">Увійти</span>';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const login = loginInput.value.trim();
    const password = passwordInput.value;

    if (!login) {
      showAlert('Введіть логін або email.');
      loginInput.focus();
      return;
    }

    if (!password) {
      showAlert('Введіть пароль.');
      passwordInput.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ login, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.message || 'Не вдалося увійти. Перевірте логін та пароль.';
        showAlert(errorMsg, 'error');
        setLoading(false);
        return;
      }

      showAlert('Успішний вхід! Перенаправлення...', 'success');

      const urlParams = new URLSearchParams(window.location.search);
      const redirectTarget = urlParams.get('redirect');

      setTimeout(() => {
        if (redirectTarget && redirectTarget.startsWith('/') && !redirectTarget.startsWith('//') && !redirectTarget.startsWith('/\\')) {
          window.location.href = redirectTarget;
        } else if (data.user && data.user.role === 'admin') {
          window.location.href = '/club-admin';
        } else {
          window.location.href = '/dashboard';
        }
      }, 500);
    } catch (err) {
      console.error('Login submit error:', err);
      showAlert('Мережева помилка. Перевірте інтернет-з\'єднання.', 'error');
      setLoading(false);
    }
  });
});

