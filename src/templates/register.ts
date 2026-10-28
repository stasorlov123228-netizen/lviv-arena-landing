export function renderRegisterPage(): string {
  return `
  <main class="auth-page-wrap">
    <div class="auth-card">
      <div class="auth-header">
        <span class="section-tag">LVIV ARENA</span>
        <h1>Створення акаунта</h1>
        <p>Створіть профіль, щоб швидко бронювати місця та стежити за своїми бронюваннями.</p>
      </div>
      <div id="register-alert" class="form-alert" role="alert" aria-live="polite"></div>
      <form id="register-form" novalidate>
        <div class="form-group"><label for="name-input" class="form-label">Ім’я або ігровий псевдонім *</label><input id="name-input" name="name" type="text" required autocomplete="name" placeholder="Ваше ім’я" class="form-input" /></div>
        <div class="form-group"><label for="email-input" class="form-label">Електронна пошта *</label><input id="email-input" name="email" type="email" required autocomplete="email" placeholder="name@example.com" class="form-input" /></div>
        <div class="form-group"><label for="password-input" class="form-label">Пароль (від 8 символів) *</label><input id="password-input" name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="Створіть пароль" class="form-input" /></div>
        <div class="form-group"><label for="confirm-password-input" class="form-label">Повторіть пароль *</label><input id="confirm-password-input" name="confirmPassword" type="password" required minlength="8" autocomplete="new-password" placeholder="Повторіть пароль" class="form-input" /></div>
        <button type="submit" id="register-submit-btn" class="btn-lime submit-btn"><span class="btn-text">Зареєструватися</span></button>
        <div class="auth-switch">Уже маєте акаунт? <a href="/login" class="auth-link">Увійти</a></div>
      </form>
    </div>
  </main>`
}
