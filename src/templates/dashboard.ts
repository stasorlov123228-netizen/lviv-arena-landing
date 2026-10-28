import { AuthenticatedUser } from '@/utilities/auth'

export function renderDashboardPage(user: AuthenticatedUser): string {
  const mustChangePassword = Boolean(user.mustChangePassword)

  return `
  <main class="dash-page">
    <div class="container">

      <div class="dash-top-bar">
        <div class="dash-heading-wrap">
          <span class="section-tag">LVIV ARENA CONTROL</span>
          <h1>Панель керування клубом</h1>
        </div>
        <div class="dash-top-actions">
          <button type="button" class="btn-secondary" id="btn-open-change-pw">
             Змінити пароль
          </button>
          <a href="/admin" class="btn-secondary" target="_blank" rel="noopener noreferrer" title="Відкрити Payload CMS admin">
            Payload CMS
          </a>
        </div>
      </div>

      ${
        mustChangePassword
          ? `
      <div class="must-change-banner" id="banner-must-change-pw">
        <div class="must-change-banner-text">
          <span class="must-change-banner-icon">Увага</span>
          <div>
            <strong>Увага!</strong> Ви використовуєте стандартний тимчасовий пароль адміністратора.
            Будь ласка, змініть його для безпеки клубу.
          </div>
        </div>
        <button type="button" class="btn-lime btn-sm" id="banner-change-pw-btn">
          Змінити пароль зараз
        </button>
      </div>
      `
          : ''
      }

      <nav class="dash-tabs" aria-label="Розділи керування">
        <button class="dash-tab-btn active" data-tab="bookings" id="tab-btn-bookings">
           Бронювання <span class="tab-badge" id="badge-bookings-count">0</span>
        </button>
        <button class="dash-tab-btn" data-tab="computers" id="tab-btn-computers">
           Комп’ютери <span class="tab-badge" id="badge-computers-count">0</span>
        </button>
        <button class="dash-tab-btn" data-tab="tariffs" id="tab-btn-tariffs">
           Тарифи <span class="tab-badge" id="badge-tariffs-count">0</span>
        </button>
        <button class="dash-tab-btn" data-tab="users" id="tab-btn-users">
           Користувачі <span class="tab-badge" id="badge-users-count">0</span>
        </button>
      </nav>

      <section class="tab-panel active" id="panel-bookings">
        <div class="dash-toolbar">
          <div class="filter-group-wrap">
            <input
              type="text"
              id="filter-booking-search"
              class="dash-search-input"
              placeholder="Пошук: клієнт, тел, ПК..."
            />
            <select id="filter-booking-status" class="dash-select">
              <option value="all">Усі статуси</option>
              <option value="new">Нові (new)</option>
              <option value="confirmed">Підтверджені (confirmed)</option>
              <option value="cancelled">Скасовані (cancelled)</option>
            </select>
            <select id="filter-booking-tariff" class="dash-select">
              <option value="all">Усі тарифи</option>
              <option value="DEFAULT">DEFAULT</option>
              <option value="PRO">PRO</option>
              <option value="VIP">VIP</option>
              <option value="STREAM">STREAM</option>
            </select>
            <input type="date" id="filter-booking-date" class="dash-select" title="Фільтр за датою" />
          </div>
          <button type="button" class="btn-secondary btn-sm" id="btn-refresh-bookings">
             Оновити
          </button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table" id="bookings-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Клієнт</th>
                <th>ПК / Зона</th>
                <th>Тариф</th>
                <th>Дата та час</th>
                <th>Тривалість</th>
                <th>Сума</th>
                <th>Статус</th>
                <th>Дії</th>
              </tr>
            </thead>
            <tbody id="bookings-tbody">
              <tr>
                <td colspan="9" class="empty-state">Завантаження бронювань...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="tab-panel" id="panel-computers">
        <div class="dash-toolbar">
          <div class="filter-group-wrap">
            <input
              type="text"
              id="filter-pc-search"
              class="dash-search-input"
              placeholder="Пошук ПК (напр. PC-01)..."
            />
            <select id="filter-pc-category" class="dash-select">
              <option value="all">Усі категорії</option>
              <option value="STANDART">STANDART</option>
              <option value="PRO">PRO</option>
              <option value="VIP">VIP</option>
              <option value="STREAMER">STREAM</option>
            </select>
            <select id="filter-pc-status" class="dash-select">
              <option value="all">Усі статуси</option>
              <option value="available">Вільний (available)</option>
              <option value="occupied">Зайнятий (occupied)</option>
              <option value="maintenance">Обслуговування</option>
              <option value="offline">Вимкнено (offline)</option>
            </select>
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-lime btn-sm" id="btn-add-computer">
              + Додати комп’ютер
            </button>
            <button type="button" class="btn-secondary btn-sm" id="btn-refresh-computers">
               Оновити
            </button>
          </div>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table" id="computers-table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Категорія</th>
                <th>Опис / Характеристики</th>
                <th>Статус</th>
                <th>Дії</th>
              </tr>
            </thead>
            <tbody id="computers-tbody">
              <tr>
                <td colspan="5" class="empty-state">Завантаження комп’ютерів...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="tab-panel" id="panel-tariffs">
        <div class="dash-toolbar">
          <div>
            <strong>Керування тарифами клубу</strong>
           
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-lime btn-sm" id="btn-add-tariff">
              + Додати тариф
            </button>
            <button type="button" class="btn-secondary btn-sm" id="btn-refresh-tariffs">
               Оновити
            </button>
          </div>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table admin-table-tariffs" id="tariffs-table">
            <thead>
              <tr>
                <th>Код тарифу</th>
                <th>Назва</th>
                <th>Категорія ПК</th>
                <th>Опис</th>
                <th>Ціна за 1 год</th>
                <th>Активність</th>
                <th>Дії</th>
              </tr>
            </thead>
            <tbody id="tariffs-tbody">
              <tr>
                <td colspan="7" class="empty-state">Завантаження тарифів...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="tab-panel" id="panel-users">
        <div class="dash-toolbar">
          <div class="filter-group-wrap">
            <input
              type="text"
              id="filter-user-search"
              class="dash-search-input"
              placeholder="Пошук: ім’я або email..."
            />
          </div>
          <button type="button" class="btn-secondary btn-sm" id="btn-refresh-users">
             Оновити
          </button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table admin-table-users" id="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ім’я</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Зареєстровано</th>
                <th>Дії</th>
              </tr>
            </thead>
            <tbody id="users-tbody">
              <tr>
                <td colspan="7" class="empty-state">Завантаження користувачів...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>

  <div class="admin-modal-overlay" id="modal-change-password">
    <div class="admin-modal">
      <div class="admin-modal-header">
        <h3 class="admin-modal-title">Зміна пароля адміністратора</h3>
        <button type="button" class="admin-modal-close" data-close-modal="modal-change-password">&times;</button>
      </div>
      <div id="pw-modal-alert" class="form-alert"></div>
      <form id="change-pw-form">
        <div class="form-group">
          <label for="new-pw-input" class="form-label">Новий пароль (від 8 символів) *</label>
          <input
            type="password"
            id="new-pw-input"
            required
            minlength="8"
            class="form-input"
            placeholder="Введіть новий надійний пароль"
          />
        </div>
        <div class="form-group">
          <label for="confirm-pw-input" class="form-label">Підтвердження нового пароля *</label>
          <input
            type="password"
            id="confirm-pw-input"
            required
            minlength="8"
            class="form-input"
            placeholder="Повторіть новий пароль"
          />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn-secondary" data-close-modal="modal-change-password">Скасувати</button>
          <button type="submit" class="btn-lime" id="btn-submit-change-pw">Зберегти новий пароль</button>
        </div>
      </form>
    </div>
  </div>

  <div class="admin-modal-overlay" id="modal-edit-booking">
    <div class="admin-modal">
      <div class="admin-modal-header">
        <h3 class="admin-modal-title">Редагування бронювання #<span id="edit-booking-id-display"></span></h3>
        <button type="button" class="admin-modal-close" data-close-modal="modal-edit-booking">&times;</button>
      </div>
      <div id="booking-modal-alert" class="form-alert"></div>
      <form id="edit-booking-form">
        <input type="hidden" id="edit-booking-id" />
        <div class="form-group">
          <label for="edit-booking-user" class="form-label">Обліковий запис клієнта</label>
          <select id="edit-booking-user" class="form-input"><option value="">Без прив’язки до акаунта</option></select>
        </div>
        <div class="form-row">
          <div class="form-group"><label for="edit-booking-name" class="form-label">Ім’я клієнта *</label><input id="edit-booking-name" class="form-input" required /></div>
          <div class="form-group"><label for="edit-booking-phone" class="form-label">Телефон *</label><input id="edit-booking-phone" class="form-input" required /></div>
        </div>
        <div class="form-group">
          <label for="edit-booking-tariff" class="form-label">Тариф *</label>
          <select id="edit-booking-tariff" class="form-input">
            <option value="DEFAULT">DEFAULT</option><option value="PRO">PRO</option><option value="VIP">VIP</option><option value="STREAM">STREAM</option>
          </select>
        </div>
        <div class="form-group">
          <label for="edit-booking-status" class="form-label">Статус *</label>
          <select id="edit-booking-status" class="form-input">
            <option value="new">Нове (new)</option>
            <option value="confirmed">Підтверджено (confirmed)</option>
            <option value="cancelled">Скасовано (cancelled)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="edit-booking-computer" class="form-label">Призначений комп’ютер *</label>
          <input type="text" id="edit-booking-computer" class="form-input" placeholder="PC-01" />
        </div>
        <div class="form-group">
          <label for="edit-booking-date" class="form-label">Дата бронювання *</label>
          <input type="date" id="edit-booking-date" class="form-input" required />
        </div>
        <div class="form-group">
          <label for="edit-booking-time" class="form-label">Час початку *</label>
          <input type="time" id="edit-booking-time" class="form-input" required />
        </div>
        <div class="form-group">
          <label for="edit-booking-duration" class="form-label">Тривалість *</label>
          <select id="edit-booking-duration" class="form-input" required><option value="1">1 година</option><option value="2">2 години</option><option value="3">3 години</option><option value="5">5 годин</option><option value="8">8 годин</option></select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn-secondary" data-close-modal="modal-edit-booking">Скасувати</button>
          <button type="submit" class="btn-lime">Зберегти зміни</button>
        </div>
      </form>
    </div>
  </div>

  <div class="admin-modal-overlay" id="modal-computer">
    <div class="admin-modal">
      <div class="admin-modal-header">
        <h3 class="admin-modal-title" id="computer-modal-title">Комп’ютер</h3>
        <button type="button" class="admin-modal-close" data-close-modal="modal-computer">&times;</button>
      </div>
      <div id="computer-modal-alert" class="form-alert"></div>
      <form id="computer-form">
        <input type="hidden" id="computer-form-id" />
        <div class="form-group">
          <label for="comp-number-input" class="form-label">Номер комп’ютера *</label>
          <input type="text" id="comp-number-input" required class="form-input" placeholder="PC-" />
        </div>
        <div class="form-group">
          <label for="comp-category-input" class="form-label">Категорія / Зона *</label>
          <select id="comp-category-input" class="form-input" required>
            <option value="STANDART">STANDART</option>
            <option value="PRO">PRO</option>
            <option value="VIP">VIP</option>
            <option value="STREAMER">STREAM</option>
          </select>
        </div>
        <div class="form-group">
          <label for="comp-status-input" class="form-label">Поточний статус *</label>
          <select id="comp-status-input" class="form-input" required>
            <option value="available">Вільний (available)</option>
            <option value="occupied">Зайнятий (occupied)</option>
            <option value="maintenance">Обслуговування (maintenance)</option>
            <option value="offline">Вимкнено (offline)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="comp-desc-input" class="form-label">Опис / Характеристики</label>
          <input type="text" id="comp-desc-input" class="form-input" placeholder="RTX 4070, i7-13700KF, 240Hz" />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn-secondary" data-close-modal="modal-computer">Скасувати</button>
          <button type="submit" class="btn-lime">Зберегти</button>
        </div>
      </form>
    </div>
  </div>

  <div class="admin-modal-overlay" id="modal-tariff">
    <div class="admin-modal">
      <div class="admin-modal-header">
        <h3 class="admin-modal-title" id="tariff-modal-title">Тариф</h3>
        <button type="button" class="admin-modal-close" data-close-modal="modal-tariff">&times;</button>
      </div>
      <div id="tariff-modal-alert" class="form-alert"></div>
      <form id="tariff-form">
        <input type="hidden" id="tariff-form-id" />
        <div class="form-group">
          <label for="tariff-name-input" class="form-label">Код тарифу *</label>
          <input type="text" id="tariff-name-input" required class="form-input" placeholder="PRO" />
        </div>
        <div class="form-group">
          <label for="tariff-title-input" class="form-label">Публічна назва *</label>
          <input type="text" id="tariff-title-input" required class="form-input" placeholder="PRO Zone" />
        </div>
        <div class="form-group">
          <label for="tariff-cat-input" class="form-label">Категорія комп’ютерів *</label>
          <select id="tariff-cat-input" class="form-input" required>
            <option value="STANDART">STANDART</option>
            <option value="PRO">PRO</option>
            <option value="VIP">VIP</option>
            <option value="STREAMER">STREAM</option>
          </select>
        </div>
        <div class="form-group">
          <label for="tariff-price-input" class="form-label">Ціна за 1 годину (грн)</label>
          <input type="number" id="tariff-price-input" min="0" step="1" class="form-input" placeholder="Не задана" />
        </div>
        <div class="form-group">
          <label for="tariff-desc-input" class="form-label">Опис тарифу</label>
          <input type="text" id="tariff-desc-input" class="form-input" placeholder="Потужні ПК для турнірів" />
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-primary);">
            <input type="checkbox" id="tariff-active-input" checked style="width: 18px; height: 18px;" />
            Тариф активний для бронювання
          </label>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn-secondary" data-close-modal="modal-tariff">Скасувати</button>
          <button type="submit" class="btn-lime">Зберегти тариф</button>
        </div>
      </form>
    </div>
  </div>

  <dialog class="admin-action-dialog" id="admin-action-dialog" aria-labelledby="admin-action-title" aria-describedby="admin-action-description">
    <div class="admin-action-content">
      <span class="admin-action-mark" aria-hidden="true">!</span>
      <h2 id="admin-action-title">Підтвердьте дію</h2>
      <p id="admin-action-description"></p>
      <p id="admin-action-status" class="admin-action-status" role="status" aria-live="polite"></p>
      <div class="admin-action-buttons">
        <button type="button" class="btn-secondary" id="admin-action-cancel">Ні, залишити</button>
        <button type="button" class="btn-lime" id="admin-action-confirm">Підтвердити</button>
      </div>
    </div>
  </dialog>
  `
}
