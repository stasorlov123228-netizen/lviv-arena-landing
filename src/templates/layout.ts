export interface LayoutProps {
  title: string
  description: string
  content: string
  scripts?: string[]
  activeNav?: 'home' | 'booking' | 'login' | 'register' | 'dashboard' | string
}

export function renderLayout({
  title,
  description,
  content,
  scripts = [],
  activeNav = 'home',
}: LayoutProps): string {
  const currentYear = new Date().getFullYear()

  const scriptTags = [
    '  <script type="module" src="/common.js"></script>',
    ...scripts.map((src) => `  <script src="${src}"></script>`),
  ].join('\n')

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/site.css">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta name="theme-color" content="#090b0a">
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <a href="/" class="logo">
        <span>LVIV ARENA</span>
        <span class="logo-dot">●</span>
      </a>

      <nav>
        <ul class="nav-links" id="primary-nav" data-cms-navigation="header">
          <li><a href="/#about" class="${activeNav === 'about' ? 'active' : ''}">Про клуб</a></li>
          <li><a href="/#gallery" class="${activeNav === 'gallery' ? 'active' : ''}">Галерея</a></li>
          <li><a href="/#tariffs" class="${activeNav === 'tariffs' ? 'active' : ''}">Тарифи</a></li>
          <li><a href="/computers" class="${activeNav === 'computers' ? 'active' : ''}">Комп’ютери</a></li>
          <li><a href="/news">Новини</a></li>
          <li><a href="/#contacts" class="${activeNav === 'contacts' ? 'active' : ''}">Контакти</a></li>
          <li class="mobile-only" id="mobile-auth-slot">
            <a href="/login" class="btn-outline" style="width: 100%; text-align: center; margin-top: 8px;">Увійти</a>
          </li>
        </ul>
      </nav>

      <div class="header-actions">

        <div id="header-auth-slot" class="auth-slot">
          <a href="/login" class="btn-outline login-btn" id="header-login-btn">Увійти</a>
        </div>

        <a href="/booking" class="btn-lime">Забронювати</a>

        <button class="menu-toggle" id="menu-toggle" aria-label="Меню" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </div>
  </header>

  ${content}

  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a href="/" class="logo"><span>LVIV ARENA</span><span class="logo-dot">●</span></a>
          <p>ТВОЯ ГРА. ТВОЯ АРЕНА.</p>
        </div>
        <div class="footer-location">
          <p class="footer-label">ЗНАЙДИ СВОЮ АРЕНУ</p>
          <address>Львів, вулиця Личаківська, 120</address>
          <a class="footer-map-link" href="https://www.google.com/maps/search/?api=1&amp;query=Львів%2C%20вулиця%20Личаківська%2C%20120" target="_blank" rel="noopener noreferrer">Відкрити в Google Maps ↗</a>
        </div>
        <nav class="footer-links" aria-label="Посилання у футері" data-cms-navigation="footer">
          <a href="/#about">Про клуб</a>
          <a href="/#gallery">Галерея</a>
          <a href="/#tariffs">Тарифи</a>
          <a href="/booking">Бронювання</a>
          <a href="/news">Новини</a>
          <a href="/#contacts">Контакти</a>
        </nav>
        <iframe class="footer-map" title="Карта: Львів, вулиця Личаківська, 120" src="https://www.google.com/maps?q=Львів%2C%20вулиця%20Личаківська%2C%20120&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
      <div class="footer-bottom"><span>© ${currentYear} Lviv Arena. Усі права захищено.</span><span>ТВОЯ ГРА. ТВОЯ АРЕНА.</span></div>
    </div>
  </footer>

  <script>
    const toggle = document.getElementById('menu-toggle');
    const nav = document.getElementById('primary-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const isOpen = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(isOpen));
      });
      nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          nav.classList.remove('open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    async function updateHeaderAuthState() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const data = await res.json();
        const user = data.user;

        const authSlot = document.getElementById('header-auth-slot');
        const mobileAuthSlot = document.getElementById('mobile-auth-slot');

        if (user && authSlot) {
          const isAdmin = user.role === 'admin';
          const name = user.name || user.email.split('@')[0];

          authSlot.innerHTML = \`
            <div class="user-chip-wrap">
              <a href="/dashboard" class="btn-admin-pill">Мій кабінет</a>\${isAdmin ? '<a href="/club-admin" class="btn-admin-pill">Панель клубу</a><a href="/admin" class="btn-admin-pill">Payload CMS</a>' : ''}
              <span class="user-badge" title="\${escapeHtml(user.email)}"> \${escapeHtml(name)}</span>
              <button type="button" class="btn-logout" id="header-logout-btn" title="Вийти">Вийти</button>
            </div>
          \`;

          if (mobileAuthSlot) {
            mobileAuthSlot.innerHTML = \`
              <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; border-top: 1px solid var(--border-light); padding-top: 12px; margin-top: 8px;">
                <span class="user-badge" style="text-align: center;"> \${escapeHtml(name)} (\${isAdmin ? 'Адміністратор' : 'Користувач'})</span>
                <a href="/dashboard" class="btn-admin-pill" style="text-align: center;">Мій кабінет</a>\${isAdmin ? '<a href="/club-admin" class="btn-admin-pill" style="text-align: center;">Панель клубу</a><a href="/admin" class="btn-admin-pill" style="text-align: center;">Payload CMS</a>' : ''}
                <button type="button" class="btn-outline" id="mobile-logout-btn">Вийти з акаунту</button>
              </div>
            \`;
            document.getElementById('mobile-logout-btn')?.addEventListener('click', handleLogout);
          }

          document.getElementById('header-logout-btn')?.addEventListener('click', handleLogout);
        }
      } catch (err) {
      }
    }

    async function handleLogout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.reload();
      } catch (err) {
        window.location.href = '/login';
      }
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    updateHeaderAuthState();
  </script>
${scriptTags}
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
