export interface HomeTariff {
  id?: number | string
  name: string
  title?: string | null
  description?: string | null
  pricePerHour?: number | null
  computerCategory?: string | null
  isActive?: boolean | null
}

const categories = [
  { name: 'STANDART', label: 'Стандарт', color: '#94a3b8' },
  { name: 'PRO', label: 'Pro', color: '#3b82f6' },
  { name: 'VIP', label: 'VIP', color: '#a855f7' },
  { name: 'STREAMER', label: 'STREAM', color: '#d946ef' },
] as const

const displayCategory = (value: string) =>
  categories.find((category) => category.name === value)?.label ?? value

function escapeHtml(value: unknown): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character] ?? character)
}

export function renderHomePage(
  customTariffs: HomeTariff[] = [],
  computerCounts: Record<string, number> = {},
  catalogStatus: { tariffsUnavailable?: boolean; computersUnavailable?: boolean } = {},
): string {
  const zones = categories.map((category) => ({ ...category, count: Number(computerCounts[category.name] || 0) }))
  const totalComputers = zones.reduce((total, category) => total + category.count, 0)
  const activeTariffs = customTariffs.filter((tariff) => tariff.isActive !== false)
  const tariffsHtml = activeTariffs.map((tariff) => {
    const category = tariff.computerCategory || tariff.name
    const price = tariff.pricePerHour == null ? 'Ціну уточнюйте в клубі' : `${tariff.pricePerHour} грн/год`
    const countLabel = catalogStatus.computersUnavailable
      ? 'Кількість місць тимчасово недоступна'
      : `${Number(computerCounts[category] || 0)} місць у категорії`
    const description = tariff.description ? `<li>${escapeHtml(tariff.description)}</li>` : ''
    return `<article class="tariff-card ${tariff.name === 'PRO' ? 'featured' : ''}">
      <h3 class="tariff-name ${tariff.name === 'PRO' ? 'lime' : ''}">${escapeHtml(displayCategory(category))}</h3>
      <p class="tariff-subtitle">${escapeHtml(tariff.title || tariff.name)}</p>
      <div style="margin:12px 0 6px"><span class="tariff-price">${escapeHtml(price)}</span></div>
      <p class="tariff-count">${escapeHtml(countLabel)}</p>
      <ul class="tariff-specs">${description}</ul>
      <a href="/booking?tariff=${encodeURIComponent(tariff.name)}" class="btn-outline">Обрати тариф</a>
    </article>`
  }).join('') || `<div class="tariffs-empty-state" role="status"><h3>${catalogStatus.tariffsUnavailable
    ? 'Тарифи тимчасово недоступні'
    : 'Тарифи скоро з’являться'}</h3><p>${catalogStatus.tariffsUnavailable
      ? 'Не вдалося завантажити актуальні дані. Спробуйте пізніше.'
      : 'Ми готуємо пропозиції для кожної ігрової зони.'}</p></div>`

  const categoryCount = zones.filter((category) => category.count > 0).length
  const totalLabel = catalogStatus.computersUnavailable ? '-' : String(totalComputers)
  const categoryLabel = catalogStatus.computersUnavailable ? '-' : String(categoryCount)
  const locationLabel = 'Львів'
  const features = [
    { label: 'Ігрові зони', title: 'Обирай свій рівень', description: 'Стандартні, Pro, VIP та стримерські місця для різних форматів гри.' },
    { label: 'Бронювання', title: 'Плануй гру онлайн', description: 'Обери тариф, дату, час і доступний комп’ютер на сторінці бронювання.' },
    { label: 'Для команди', title: 'Зустрічайся з друзями', description: 'Грай разом, тренуйся та проводь час у Lviv Arena.' },
    { label: 'Стримінг', title: 'Створюй свій контент', description: 'Окрема категорія тарифу для стримерських місць.' },
  ]
  const featuresHtml = features.map((feature) => `<article class="feature-card">
    <div class="feature-icon" aria-hidden="true">${escapeHtml(feature.label)}</div>
    <h3 class="feature-title">${escapeHtml(feature.title)}</h3>
    <p class="feature-desc">${escapeHtml(feature.description)}</p>
  </article>`).join('')

  return `
  <main>
    <section class="hero-section"><div class="hero-glow-1"></div><div class="hero-glow-2"></div><div class="hero-content">
      <span class="badge-tag">ЛЬВІВ · COMPUTER CLUB</span><span class="hours-badge">ПРАЦЮЄМО 24/7</span>
      <h1 class="hero-title">ТВОЯ ГРА.<span class="gradient-text">ТВОЯ АРЕНА.</span></h1>
      <p class="hero-desc">Lviv Arena - простір для геймерів, друзів і майбутніх чемпіонів. Обирай свою зону, бронюй комп’ютер та грай на повну.</p>
      <div class="hero-buttons"><a href="/booking" class="btn-lime">ЗАБРОНЮВАТИ КОМП’ЮТЕР</a><a href="#tariffs" class="btn-outline">Подивитися тарифи</a></div>
      <div class="hero-stats">
        <div class="stat-item"><p class="stat-num">${totalLabel}</p><p class="stat-label">ігрових місць</p></div>
        <div class="stat-item"><p class="stat-num">${categoryLabel}</p><p class="stat-label">категорії комп’ютерів</p></div>
        <div class="stat-item"><p class="stat-num">24/7</p><p class="stat-label">режим роботи</p></div>
        <div class="stat-item"><p class="stat-num">${locationLabel}</p><p class="stat-label">наша локація</p></div>
      </div>
    </div></section>
    <section id="about" class="section"><div class="container"><div class="about-grid"><div class="about-text"><p class="section-tag">ПРО LVIV ARENA</p>
      <h2>БІЛЬШЕ, НІЖ <span class="highlight">ПРОСТО ГРА</span></h2>
      <p>Lviv Arena - місце, де можна зібратися з друзями, зануритися в улюблені ігри та відчути атмосферу кіберспорту. Обирай тариф відповідно до своїх потреб і бронюй онлайн.</p>
      <p>Від першої гри до командних матчів - у Lviv Arena знайдеться місце для кожного.</p>
      <div style="margin-top:24px"><a href="/booking" class="btn-outline">Обрати місце</a></div>
    </div><div class="zones-card"><div class="zones-card-header"><h3>Категорії місць</h3><p>${catalogStatus.computersUnavailable
      ? 'Дані про кількість місць тимчасово недоступні'
      : `${totalComputers} ігрових місць`}</p></div>
      ${zones.map((category) => `<div class="zone-row"><div class="zone-row-meta"><span>${category.label}</span><span>${catalogStatus.computersUnavailable ? '-' : category.count}</span></div>
        <div class="zone-bar-bg"><div class="zone-bar-fill" style="width:${totalComputers ? category.count / totalComputers * 100 : 0}%;background-color:${category.color}"></div></div>
      </div>`).join('')}
    </div></div></div></section>

    <section id="gallery" class="section arena-gallery-section"><div class="container">
      <div class="section-header">
        <p class="section-tag">АТМОСФЕРА КЛУБУ · ФОТОГАЛЕРЕЯ</p>
        <h2 class="section-title">РЕАЛЬНИЙ ПРОСТІР <span class="highlight">LVIV ARENA</span></h2>
        <p class="section-desc">Поглянь на наші бойові станції: кіберспортивна сцена, приватний неоновий VIP-лаундж, стрімерські студії та продумана ергономіка кожного місця.</p>
      </div>

      <div class="arena-gallery" id="arena-gallery-grid">
        <figure class="arena-gallery-item arena-gallery-item--large" tabindex="0" role="button" aria-label="Детальніше про Головну арену"
          data-gallery-src="/images/gaming-arena-pexels-9072216.webp"
          data-gallery-title="Турнірна сцена та Pro-зал"
          data-gallery-zone="ГОЛОВНА АРЕНА"
          data-gallery-desc="Масштабний кіберспортивний простір з командними лініями, 240Hz моніторами та потужними відеокартами для максимального FPS без осідань."
          data-gallery-specs="240Hz / 1ms, RTX 4080, Gigabit LAN, Командні ряди"
          data-gallery-tariff="PRO">
          <img src="/images/gaming-arena-pexels-9072216.webp" alt="Головна кіберспортивна арена Lviv Arena" loading="lazy" width="800" height="600">
          <div class="gallery-badge-top">
            <span class="gallery-pill-tag">ГОЛОВНА АРЕНА</span>
            <button type="button" class="gallery-zoom-btn" title="Збільшити фото" aria-label="Збільшити фото">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>
          </div>
          <figcaption>
            <div class="gallery-caption-meta">
              <span class="gallery-category-label">70+ БОЙОВИХ СТАНЦІЙ</span>
              <strong>Турнірна сцена та Pro-зал</strong>
            </div>
            <p class="gallery-item-desc">Масштабний кіберспортивний простір з командними лініями, 240Hz моніторами та топовими відеокартами для максимального FPS.</p>
            <div class="gallery-tags-wrap">
              <span class="gallery-spec-chip">240Hz / 1ms</span>
              <span class="gallery-spec-chip">RTX 4080</span>
              <span class="gallery-spec-chip">Gigabit LAN</span>
            </div>
            <div class="gallery-footer-action">
              <a href="/booking?tariff=PRO" class="gallery-book-btn">Забронювати в залі &rarr;</a>
            </div>
          </figcaption>
        </figure>

        <figure class="arena-gallery-item" tabindex="0" role="button" aria-label="Детальніше про PRO Кіберспорт"
          data-gallery-src="/images/pexels-esports-setup-9072394.jpg"
          data-gallery-title="Кіберспортивний Battlestation"
          data-gallery-zone="PRO ZONE"
          data-gallery-desc="Топове спорядження для змагань і клатчів 1v5: надшвидка матриця 360Hz, збалансована механіка та бездоганний сенсор без затримок."
          data-gallery-specs="360Hz Display, ZOWIE &amp; Logitech, 0.5ms Lag, RTX 4080"
          data-gallery-tariff="PRO">
          <img src="/images/pexels-esports-setup-9072394.jpg" alt="Кіберспортивний сетап Lviv Arena" loading="lazy" width="600" height="400">
          <div class="gallery-badge-top">
            <span class="gallery-pill-tag">PRO SETUP</span>
            <button type="button" class="gallery-zoom-btn" title="Збільшити фото" aria-label="Збільшити фото">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>
          </div>
          <figcaption>
            <div class="gallery-caption-meta">
              <span class="gallery-category-label">ESPORTS GRADE</span>
              <strong>PRO Кіберспорт</strong>
            </div>
            <p class="gallery-item-desc">Надшвидкісна матриця та точна периферія для турнірних змагань.</p>
            <div class="gallery-tags-wrap">
              <span class="gallery-spec-chip">360Hz</span>
              <span class="gallery-spec-chip">0.5ms</span>
              <span class="gallery-spec-chip">RTX 4080</span>
            </div>
            <div class="gallery-footer-action">
              <a href="/booking?tariff=PRO" class="gallery-book-btn">Забронювати PRO &rarr;</a>
            </div>
          </figcaption>
        </figure>

        <figure class="arena-gallery-item" tabindex="0" role="button" aria-label="Детальніше про VIP Lounge"
          data-gallery-src="/images/pexels-blue-gaming-room-18867762.jpg"
          data-gallery-title="Неоновий VIP-простір"
          data-gallery-zone="VIP LOUNGE"
          data-gallery-desc="Повна звукоізоляція, преміальні ерго-крісла, глибокий неоновий затишок і RTX 4090 для бездоганної гри у власній компанії 24/7."
          data-gallery-specs="Повна звукоізоляція, RTX 4090, 4K OLED, Lounge-сервіс"
          data-gallery-tariff="VIP">
          <img src="/images/pexels-blue-gaming-room-18867762.jpg" alt="Неонова VIP кімната Lviv Arena" loading="lazy" width="600" height="400">
          <div class="gallery-badge-top">
            <span class="gallery-pill-tag">VIP LOUNGE</span>
            <button type="button" class="gallery-zoom-btn" title="Збільшити фото" aria-label="Збільшити фото">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>
          </div>
          <figcaption>
            <div class="gallery-caption-meta">
              <span class="gallery-category-label">ПРИВАТНА ЗОНА 24/7</span>
              <strong>Неоновий VIP-простір</strong>
            </div>
            <p class="gallery-item-desc">Повна звукоізоляція, преміальні ерго-крісла та RTX 4090 для особливого комфорту.</p>
            <div class="gallery-tags-wrap">
              <span class="gallery-spec-chip">RTX 4090</span>
              <span class="gallery-spec-chip">4K OLED</span>
              <span class="gallery-spec-chip">Lounge-зона</span>
            </div>
            <div class="gallery-footer-action">
              <a href="/booking?tariff=VIP" class="gallery-book-btn">Забронювати VIP &rarr;</a>
            </div>
          </figcaption>
        </figure>

        <figure class="arena-gallery-item" tabindex="0" role="button" aria-label="Детальніше про Стрім-студію"
          data-gallery-src="/images/pexels-rgb-station-4317157.jpg"
          data-gallery-title="Студія стрімінгу та контенту"
          data-gallery-zone="STREAM ROOM"
          data-gallery-desc="Окрема акустична студія з двома моніторами, професійним мікрофоном Shure, налаштованим RGB-світлом та пультами стрімінгу."
          data-gallery-specs="Dual Monitor, Shure SM7B, Elgato Stream Deck, Studio Light"
          data-gallery-tariff="STREAMER">
          <img src="/images/pexels-rgb-station-4317157.jpg" alt="Стрім-студія та контент Lviv Arena" loading="lazy" width="600" height="400">
          <div class="gallery-badge-top">
            <span class="gallery-pill-tag">STREAM ROOM</span>
            <button type="button" class="gallery-zoom-btn" title="Збільшити фото" aria-label="Збільшити фото">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>
          </div>
          <figcaption>
            <div class="gallery-caption-meta">
              <span class="gallery-category-label">ДЛЯ СТРІМІВ ТА ВІДЕО</span>
              <strong>Стрім-студія з RGB</strong>
            </div>
            <p class="gallery-item-desc">Дводісплейна станція з мікрофоном Shure та налаштованим освітленням.</p>
            <div class="gallery-tags-wrap">
              <span class="gallery-spec-chip">Dual Screen</span>
              <span class="gallery-spec-chip">Shure Mic</span>
              <span class="gallery-spec-chip">Elgato Deck</span>
            </div>
            <div class="gallery-footer-action">
              <a href="/booking?tariff=STREAMER" class="gallery-book-btn">Забронювати STREAM &rarr;</a>
            </div>
          </figcaption>
        </figure>

        <figure class="arena-gallery-item" tabindex="0" role="button" aria-label="Детальніше про Standart Plus"
          data-gallery-src="/images/pexels-gaming-room-6125337.jpg"
          data-gallery-title="Індивідуальний комфорт"
          data-gallery-zone="STANDART+"
          data-gallery-desc="Продумана ергономіка робочого місця, чіткий 7.1 об'ємний звук і тихі механічні перемикачі для нічних каток та улюблених ігор."
          data-gallery-specs="HyperX 7.1, RTX 4060 Ti, Ерго-крісло, Механіка"
          data-gallery-tariff="STANDART">
          <img src="/images/pexels-gaming-room-6125337.jpg" alt="Індивідуальне ігрове місце Standart Lviv Arena" loading="lazy" width="600" height="400">
          <div class="gallery-badge-top">
            <span class="gallery-pill-tag">STANDART+</span>
            <button type="button" class="gallery-zoom-btn" title="Збільшити фото" aria-label="Збільшити фото">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>
          </div>
          <figcaption>
            <div class="gallery-caption-meta">
              <span class="gallery-category-label">КОМФОРТ І ДРАЙВ</span>
              <strong>Індивідуальний комфорт</strong>
            </div>
            <p class="gallery-item-desc">Ергономічні робочі місця для щоденних перемог та улюблених новинок.</p>
            <div class="gallery-tags-wrap">
              <span class="gallery-spec-chip">HyperX 7.1</span>
              <span class="gallery-spec-chip">RTX 4060 Ti</span>
              <span class="gallery-spec-chip">Ерго-крісло</span>
            </div>
            <div class="gallery-footer-action">
              <a href="/booking?tariff=STANDART" class="gallery-book-btn">Забронювати Standart &rarr;</a>
            </div>
          </figcaption>
        </figure>
      </div>

      <div class="gallery-bottom-bar">
        <div class="gallery-feature-pill">
          <span class="pill-dot">●</span> 100% реальні кіберспортивні сетапи
        </div>
        <div class="gallery-feature-pill">
          <span class="pill-dot">●</span> Професійна ігрова периферія
        </div>
        <div class="gallery-feature-pill">
          <span class="pill-dot">●</span> Натисніть на фото для перегляду деталей
        </div>
      </div>
    </div></section>

    <!-- Lightbox Modal -->
    <div id="gallery-lightbox" class="gallery-lightbox" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Перегляд зони">
      <div class="gallery-lightbox-backdrop" data-close-lightbox></div>
      <div class="gallery-lightbox-content">
        <button type="button" class="gallery-lightbox-close" data-close-lightbox aria-label="Закрити">&times;</button>
        <div class="gallery-lightbox-image-wrap">
          <img id="gallery-lightbox-img" src="" alt="Фото зони">
        </div>
        <div class="gallery-lightbox-info">
          <div>
            <div class="gallery-lightbox-badge-row">
              <span id="gallery-lightbox-badge" class="gallery-pill-tag"></span>
              <span id="gallery-lightbox-zone" class="gallery-category-label"></span>
            </div>
            <h3 id="gallery-lightbox-title" class="gallery-lightbox-title"></h3>
            <p id="gallery-lightbox-desc" class="gallery-lightbox-desc"></p>
            <div class="gallery-lightbox-specs-heading">Оснащення зони:</div>
            <div id="gallery-lightbox-specs" class="gallery-tags-wrap"></div>
          </div>
          <div class="gallery-lightbox-actions">
            <a id="gallery-lightbox-book-btn" href="/booking" class="btn-lime">Забронювати це місце</a>
            <button type="button" class="btn-outline" data-close-lightbox>Закрити</button>
          </div>
        </div>
      </div>
    </div>
    <section id="tariffs" class="section"><div class="container"><div class="section-header"><p class="section-tag">ОБИРАЙ СВІЙ РІВЕНЬ</p><h2 class="section-title">НАШІ ТАРИФИ</h2><p class="section-desc">Обери зону, яка підходить саме тобі.</p></div><div class="tariffs-grid">${tariffsHtml}</div></div></section>
    <section class="section"><div class="container"><div class="section-header"><p class="section-tag">ЧОМУ САМЕ МИ</p><h2 class="section-title">АТМОСФЕРА ГРИ</h2></div><div class="features-grid">${featuresHtml}</div></div></section>
    <section class="container"><div class="cta-banner"><h2>ГОТОВИЙ ДО ГРИ?</h2><p>Обирай тариф, дату та час. Забронюй своє місце в Lviv Arena.</p><a href="/booking" class="btn-lime" style="font-size:1.1rem;padding:14px 32px">Забронювати місце</a></div></section>
    <section id="contacts" class="section"><div class="container"><div class="contacts-card"><p class="section-tag">КОНТАКТИ</p><h2>ЗУСТРІНЕМОСЯ НА АРЕНІ</h2>
      <p>Львів, вул. Личаківська, 120</p><p>Телефон: <a href="tel:+380501234567">+38 (050) 123-45-67</a></p><a href="/booking" class="btn-outline">Забронювати місце</a>
    </div></div></section>
  </main>`
}
