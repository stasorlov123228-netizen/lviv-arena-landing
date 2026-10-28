import type { AuthenticatedUser } from '@/utilities/auth'

export function renderClientDashboard(user: AuthenticatedUser): string {
  return `<main class="container dash-page"><section class="section-heading"><span class="section-tag">ОСОБИСТИЙ КАБІНЕТ</span><h1>Вітаємо, ${escapeHtml(user.name || user.email)}</h1><p>Ваші бронювання та контактні дані.</p></section>
  <section class="card"><h2>Контакти</h2><form id="profile-form"><label>Email<input type="email" name="email" value="${escapeHtml(user.email)}" required></label><label>Телефон<input type="tel" name="phone" id="profile-phone" required pattern="\\+380[0-9]{9}" minlength="13" maxlength="13" placeholder="+380501234567" aria-describedby="profile-phone-hint"><small id="profile-phone-hint">Формат: +380 і 9 цифр, наприклад +380501234567.</small></label><button class="btn-lime">Зберегти контакти</button><p id="profile-message" role="status"></p></form></section>
  <section class="card client-bookings"><div class="client-bookings-heading"><div><span class="section-tag">ВАШІ ВІЗИТИ</span><h2>Мої бронювання</h2><p>Переглядайте деталі та керуйте майбутніми візитами.</p></div></div><p id="booking-state" class="client-bookings-state" role="status">Завантаження…</p><div id="my-bookings" class="client-booking-list"></div></section>
  <dialog id="edit-booking-dialog" class="card"><form id="edit-booking-form"><h2>Змінити бронювання</h2><input type="hidden" name="id"><label>Дата<input type="date" name="date" required></label><label>Час<input type="time" name="time" required></label><label>Тривалість<select name="duration" required><option value="1">1 година</option><option value="2">2 години</option><option value="3">3 години</option><option value="5">5 годин</option><option value="8">8 годин</option></select></label><p id="edit-booking-message" role="status"></p><button class="btn-lime">Зберегти зміни</button><button type="button" class="btn-secondary" data-close-edit>Скасувати</button></form></dialog></main>`
}

export function renderBookingDetails(booking: Record<string, unknown>): string {
  const text = (value: unknown) => String(value ?? '-').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
  const statusLabels: Record<string, string> = { pending: 'Очікує підтвердження', confirmed: 'Підтверджено', cancelled: 'Скасовано', completed: 'Завершено' }
  const paymentLabels: Record<string, string> = { unpaid: 'Не оплачено', paid: 'Оплачено', refunded: 'Повернено' }
  const status = String(booking.status ?? '')
  const paymentStatus = String(booking.paymentStatus ?? '')
  const duration = Number(booking.duration)
  const durationLabel = Number.isFinite(duration) ? `${duration} ${duration === 1 ? 'година' : duration >= 2 && duration <= 4 ? 'години' : 'годин'}` : text(booking.duration)
  const date = typeof booking.date === 'string' ? booking.date.slice(0, 10) : ''
  const detail = (label: string, value: unknown, className = '') => `<div class="booking-detail-item ${className}"><span>${label}</span><strong>${text(value)}</strong></div>`
  return `<main class="container dash-page booking-detail-page">
    <a href="/dashboard" class="btn-secondary booking-detail-back"><span aria-hidden="true">&larr;</span> До кабінету</a>
    <section class="booking-detail-card" aria-labelledby="booking-detail-title">
      <div class="booking-detail-header">
        <div><span class="section-tag">ДЕТАЛІ ВІЗИТУ</span><p class="client-booking-kicker">БРОНЮВАННЯ #${text(booking.id)}</p><h1 id="booking-detail-title">Ваше бронювання</h1></div>
        <span class="booking-status booking-status--${text(status)}">${text(statusLabels[status] || status || 'Статус невідомий')}</span>
      </div>
      <div class="booking-detail-highlight">
        <div><span class="booking-detail-label">Дата та час</span><strong>${text(date || 'Дата не вказана')} <span>&middot;</span> ${text(booking.time || '-')}</strong></div>
        <div class="booking-detail-price"><span class="booking-detail-label">До сплати</span><strong>${text(booking.totalAmount ?? '-')} <small>грн</small></strong></div>
      </div>
      <div class="booking-detail-grid">
        ${detail('Комп’ютер', booking.computer || 'Буде призначено клубом')}
        ${detail('Тариф', booking.tariff)}
        ${detail('Тривалість', durationLabel)}
        ${detail('Оплата', paymentLabels[paymentStatus] || paymentStatus || 'Не вказано', `booking-payment--${text(paymentStatus)}`)}
      </div>
      <div class="booking-detail-footer"><span>Потрібна допомога з бронювання?</span><a href="/dashboard">Перейти до моїх візитів <span aria-hidden="true">&rarr;</span></a></div>
    </section>
  </main>`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}
