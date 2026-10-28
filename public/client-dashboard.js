const state = document.querySelector('#booking-state')
const list = document.querySelector('#my-bookings')
const form = document.querySelector('#profile-form')
const message = document.querySelector('#profile-message')
const editDialog = document.querySelector('#edit-booking-dialog')
const editForm = document.querySelector('#edit-booking-form')
const editMessage = document.querySelector('#edit-booking-message')
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const apiError = async (response) => { const data = await response.json().catch(() => ({})); throw new Error(data.message || `Помилка запиту (${response.status})`) }
const load = async () => {
  state.textContent = 'Завантаження…'
  try {
    const [b, p] = await Promise.all([fetch('/api/my/bookings'), fetch('/api/auth/profile')])
    if (!b.ok || !p.ok) throw new Error('Не вдалося завантажити кабінет. Увійдіть знову.')
    const { docs } = await b.json()
    const { profile } = await p.json()
    form.elements.email.value = profile.email
    form.elements.phone.value = profile.phone || ''
    state.textContent = docs.length ? '' : 'У вас поки немає бронювань.'
    list.innerHTML = docs.map((x) => {
      const start = x.bookingStart ? new Date(x.bookingStart) : new Date(`${x.date?.slice(0, 10)}T${x.time}:00+02:00`)
      const editable = x.paymentStatus !== 'paid' && x.status !== 'cancelled' && start > new Date()
      const statusLabels = { new: 'Нове', confirmed: 'Підтверджено', cancelled: 'Скасовано', completed: 'Завершено' }
      const paymentLabels = { unpaid: 'Не оплачено', paid: 'Оплачено', refunded: 'Повернено' }
      return `<article class="client-booking-card"><div class="client-booking-top"><div><p class="client-booking-kicker">БРОНЮВАННЯ #${esc(x.id)}</p><h3>${esc(x.date?.slice(0,10))}<span> · </span>${esc(x.time)}</h3></div><span class="booking-status booking-status--${esc(x.status)}">${esc(statusLabels[x.status] || x.status)}</span></div><div class="client-booking-main"><div><p class="client-booking-seat">${esc(x.computer || 'ПК не призначено')}</p><p class="client-booking-meta">${esc(x.tariff)} <span>·</span> ${esc(x.duration)} год</p></div><div class="client-booking-total"><span>Сума</span><strong>${esc(x.totalAmount ?? '-')} грн</strong></div></div><div class="client-booking-bottom"><p>Оплата: <strong>${esc(paymentLabels[x.paymentStatus] || x.paymentStatus)}</strong></p><div class="client-booking-actions"><a class="btn-secondary" href="/bookings/${esc(x.id)}">Деталі</a> ${editable ? `<button class="btn-secondary" data-edit="${esc(x.id)}" data-date="${esc(x.date?.slice(0,10))}" data-time="${esc(x.time)}" data-duration="${esc(x.duration)}">Змінити</button>` : ''} ${editable && x.paymentMethod !== 'card' ? `<button class="btn-secondary" data-cancel="${esc(x.id)}">Скасувати</button>` : ''}</div></div></article>`
    }).join('')
  } catch (e) { state.textContent = e.message }
}
form?.addEventListener('submit', async (event) => {
  event.preventDefault()
  const phone = form.elements.phone.value.trim()
  if (!/^\+380\d{9}$/.test(phone)) {
    message.textContent = 'Введіть номер у форматі +380 і 9 цифр, наприклад +380501234567.'
    form.elements.phone.focus()
    return
  }
  message.textContent = 'Збереження…'
  try {
    const response = await fetch('/api/auth/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.elements.email.value, phone }) })
    if (!response.ok) await apiError(response)
    message.textContent = 'Контакти оновлено.'
  } catch (error) { message.textContent = error.message }
})
list?.addEventListener('click', async (event) => {
  const cancel = event.target.closest('[data-cancel]')
  if (cancel) {
    cancel.disabled = true
    try { const response = await fetch(`/api/my/bookings/${cancel.dataset.cancel}`, { method: 'DELETE' }); if (!response.ok) await apiError(response); await load() }
    catch (error) { state.textContent = error.message; cancel.disabled = false }
    return
  }
  const edit = event.target.closest('[data-edit]')
  if (edit) { editForm.elements.id.value = edit.dataset.edit; editForm.elements.date.value = edit.dataset.date; editForm.elements.time.value = edit.dataset.time; editForm.elements.duration.value = edit.dataset.duration; editMessage.textContent = ''; editDialog.showModal() }
})
editForm?.addEventListener('submit', async (event) => {
  event.preventDefault(); editMessage.textContent = 'Збереження…'
  const submit = editForm.querySelector('[type=submit], button:not([type])'); submit.disabled = true
  try {
    const response = await fetch(`/api/my/bookings/${editForm.elements.id.value}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: editForm.elements.date.value, time: editForm.elements.time.value, duration: editForm.elements.duration.value }) })
    if (!response.ok) await apiError(response)
    editDialog.close(); await load()
  } catch (error) { editMessage.textContent = error.message }
  finally { submit.disabled = false }
})
document.querySelector('[data-close-edit]')?.addEventListener('click', () => editDialog.close())
load()
