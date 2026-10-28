export interface BookingTemplateProps {
  presetTariff?: string
  presetCategory?: string
  tariffs?: Array<{ name: string; title: string; computerCategory: string }>
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]!)

export function renderBookingPage(props: BookingTemplateProps = {}): string {
  const { presetTariff = '', presetCategory = '', tariffs = [] } = props
  const selectedTariff = tariffs.find((tariff) => tariff.name === presetTariff)?.name
    ?? tariffs.find((tariff) => tariff.computerCategory === presetCategory)?.name
    ?? tariffs[0]?.name
  const tariffOptions = tariffs.map((tariff) =>
    `<option value="${escapeHtml(tariff.name)}" data-category="${escapeHtml(tariff.computerCategory)}"${tariff.name === selectedTariff ? ' selected' : ''}>${escapeHtml(tariff.name)} - ${escapeHtml(tariff.title)}</option>`,
  ).join('')

  return `
  <main class="booking-page-wrap">
    <div class="booking-container">
      <a href="/" class="back-link">← На головну</a>

      <p class="section-tag" style="margin-bottom: 8px;">LVIV ARENA / БРОНЮВАННЯ</p>
      <h1 class="section-title" style="text-align: left; margin-bottom: 12px;">БРОНЮВАННЯ</h1>
      <p style="color: var(--text-secondary); margin-bottom: 24px;">
        Заповни форму, щоб забронювати місце в клубі. Після успішного бронювання ти отримаєш номер підтвердження.
      </p>

      <div id="booking-success" class="success-card" style="display: none;"></div>

      <form id="booking-form" class="form-card" novalidate>

        <div class="form-group">
          <label for="name" class="form-label">Ім’я *</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autocomplete="given-name"
            placeholder="Введи своє ім'я"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="phone" class="form-label">Номер телефону *</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autocomplete="tel"
            inputmode="tel"
            minlength="13"
            maxlength="13"
            pattern="\\+380[0-9]{9}"
            aria-describedby="phone-hint"
            placeholder="+380501234567"
            class="form-input"
          />
          <small id="phone-hint" class="form-hint">Формат: +380 і 9 цифр, наприклад +380501234567.</small>
        </div>

        <div class="form-group">
          <label for="email" class="form-label">Email *</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autocomplete="email"
            maxlength="254"
            placeholder="name@example.com"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="tariff" class="form-label">Тариф *</label>
          <select id="tariff" name="tariff" class="form-select">${tariffOptions}</select>
        </div>

        <div class="category-info-box">
          <p class="category-info-title">Категорія комп’ютера</p>
          <p class="category-info-desc" id="category-info-text">
            STANDART - визначається тарифом автоматично.
          </p>
        </div>

        <div id="availability-status" class="form-hint" role="status" aria-live="polite">
          Вільний комп’ютер і його номер буде призначено автоматично після перевірки доступності.
        </div>

        <div class="form-group">
          <label for="date" class="form-label">Дата бронювання *</label>
          <input
            id="date"
            name="date"
            type="date"
            required
            class="form-input"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="time" class="form-label">Час початку *</label>
            <input
              id="time"
              name="time"
              type="time"
              required
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="duration" class="form-label">Тривалість *</label>
            <select id="duration" name="duration" class="form-select">
              <option value="1">1 година</option>
              <option value="2" selected>2 години</option>
              <option value="3">3 години</option>
              <option value="5">5 годин</option>
              <option value="8">8 годин</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          id="submit-btn"
          class="btn-lime submit-btn"
        >
          <span class="btn-text">Підтвердити бронювання</span>
        </button>
      </form>
    </div>
  </main>
  `
}

