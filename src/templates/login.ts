export function renderLoginPage(): string {
  return `
  <main class="auth-page-wrap"><div class="auth-card">
    <div class="auth-header"><span class="section-tag">LVIV ARENA</span><h1>Вхід до кабінету</h1><p>Введіть свої дані, щоб увійти до системи клубу.</p></div>
    <div id="login-alert" class="form-alert" role="alert" aria-live="polite"></div>
    <form id="login-form" novalidate>
      <div class="form-group"><label for="login-input" class="form-label">Електронна пошта або логін *</label><input id="login-input" name="login" type="text" required autocomplete="username" placeholder="name@example.com" class="form-input" /></div>
      <div class="form-group"><label for="password-input" class="form-label">Пароль *</label><input id="password-input" name="password" type="password" required autocomplete="current-password" placeholder="Введіть пароль" class="form-input" /></div>
      <button type="submit" id="login-submit-btn" class="btn-lime submit-btn"><span class="btn-text">Увійти</span></button>
      <div class="auth-switch">Ще не маєте акаунта? <a href="/register" class="auth-link">Зареєструватися</a></div>
    </form>
  </div></main>`
}
