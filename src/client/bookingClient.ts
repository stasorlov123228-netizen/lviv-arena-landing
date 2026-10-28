

export const CONNECTION_ERROR =
  'Не вдалося зв’язатися із сервером. Перевірте підключення до інтернету та спробуйте ще раз.'
export const BOOKING_CONFLICT =
  'Вибраний час щойно зайняли. Оберіть інший час і спробуйте ще раз.'

const fieldLabels: Record<string, string> = {
  computerCategory: 'Категорія комп’ютера',
  date: 'Дата',
  duration: 'Тривалість',
  name: 'Ім’я',
  phone: 'Номер телефону',
  tariff: 'Тариф',
  time: 'Час початку',
}

const getFieldLabel = (field: string): string => {
  const fieldName = field.split('.').at(-1) ?? field
  return fieldLabels[fieldName] ?? field
}

const translateServerMessage = (message: string): string => {
  const translations: Record<string, string> = {
    'This field is required.': 'Це поле обов’язкове.',
    'This value is invalid.': 'Вказано неприпустиме значення.',
    'Validation Error.': 'Перевірте правильність заповнення полів.',
  }
  return translations[message] ?? message
}

export const getApiErrorMessage = (body: unknown, status: number): string => {
  if (status === 409) return BOOKING_CONFLICT

  if (typeof body !== 'object' || body === null) {
    return `Сервер відхилив запит (HTTP ${status}), але не надав опису помилки.`
  }

  const response = body as Record<string, unknown>
  const messages: string[] = []

  if (
    typeof response.message === 'string' &&
    response.message.trim() &&
    response.message !== 'Validation Error.'
  ) {
    messages.push(translateServerMessage(response.message.trim()))
  }

  if (Array.isArray(response.errors)) {
    for (const item of response.errors) {
      if (typeof item !== 'object' || item === null) continue

      const error = item as Record<string, unknown>
      if (typeof error.message !== 'string' || !error.message.trim()) continue

      const field =
        typeof error.field === 'string'
          ? error.field
          : typeof error.path === 'string'
            ? error.path
            : null
      const message = translateServerMessage(error.message.trim())

      messages.push(field ? `${getFieldLabel(field)}: ${message}` : message)
    }
  }

  const uniqueMessages = [...new Set(messages)]
  if (uniqueMessages.length) return uniqueMessages.join('\n')

  return `Сервер відхилив запит (HTTP ${status}), але не надав опису помилки.`
}

const categoryDescriptions: Record<string, string> = {
  DEFAULT: 'STANDART - визначається тарифом автоматично.',
  PRO: 'PRO - визначається тарифом автоматично.',
  VIP: 'VIP - визначається тарифом автоматично.',
  STREAM: 'STREAM - визначається тарифом автоматично.',
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const durationLabel = (n: number | string): string => {
  const num = Number(n)
  if (num === 1) return '1 година'
  if (num === 2) return '2 години'
  if (num === 3) return '3 години'
  if (num === 5) return '5 годин'
  return `${num} год.`
}

export function initBookingClient(): () => void {
  const form = document.querySelector<HTMLFormElement>('#booking-form')
  const successBox = document.querySelector<HTMLElement>('#booking-success')
  const submitBtn = document.querySelector<HTMLButtonElement>('#submit-btn')

  const nameInput = document.querySelector<HTMLInputElement>('#name')
  const phoneInput = document.querySelector<HTMLInputElement>('#phone')
  const emailInput = document.querySelector<HTMLInputElement>('#email')
  const tariffSelect = document.querySelector<HTMLSelectElement>('#tariff')
  const dateInput = document.querySelector<HTMLInputElement>('#date')
  const timeInput = document.querySelector<HTMLInputElement>('#time')
  const durationSelect = document.querySelector<HTMLSelectElement>('#duration')
  const categoryInfoText = document.querySelector<HTMLElement>('#category-info-text')
  const availabilityStatus = document.querySelector<HTMLElement>('#availability-status')
  const phoneHint = document.querySelector<HTMLElement>('#phone-hint')

  let isSubmitting = false
  let activeAbortController: AbortController | null = null
  let pendingAvailability = false
  const profileRequest = fetch('/api/auth/profile', { cache: 'no-store' })
    .then(async (response) => response.ok ? response.json() as Promise<{ profile?: { email?: string; phone?: string } }> : null)
    .then((data) => {
      const email = data?.profile?.email?.trim()
      if (email && emailInput) {
        emailInput.value = email
        emailInput.readOnly = true
        emailInput.setAttribute('aria-readonly', 'true')
      }
      const phone = data?.profile?.phone?.trim()
      if (phone && phoneInput) {
        phoneInput.value = phone
        if (/^\+380[0-9]{9}$/.test(phone)) {
          phoneInput.readOnly = true
          phoneInput.setAttribute('aria-readonly', 'true')
          if (phoneHint) phoneHint.textContent = 'Phone filled from your profile.'
        }
      }
    })
    .catch(() => undefined)

  const hideError = () => {
    const existing = document.querySelector('#error-dialog-overlay')
    if (existing) {
      existing.remove()
    }
  }

  const showError = (msg: string) => {
    hideError()

    const overlay = document.createElement('div')
    overlay.id = 'error-dialog-overlay'
    overlay.className = 'dialog-overlay'
    overlay.innerHTML = `
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="booking-error-title"
        aria-describedby="booking-error-description"
        class="dialog-card"
      >
        <div class="dialog-icon-wrap">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 id="booking-error-title" class="dialog-title">Не вдалося створити бронювання</h2>
        <p id="booking-error-description" class="dialog-desc"></p>
        <button type="button" id="error-close-btn" class="btn-lime dialog-btn">
          Зрозуміло
        </button>
      </section>
    `

    const descEl = overlay.querySelector('#booking-error-description')
    if (descEl) descEl.textContent = msg

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) hideError()
    })

    const closeBtn = overlay.querySelector<HTMLButtonElement>('#error-close-btn')
    closeBtn?.addEventListener('click', hideError)

    document.body.appendChild(overlay)
    closeBtn?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') hideError()
  }
  document.addEventListener('keydown', onKeyDown)

  if (dateInput) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' })
    dateInput.min = today
  }
  if (timeInput) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(Date.now() + 60 * 1000))
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '00'
    timeInput.value = `${part('hour')}:${part('minute')}`
  }

  try {
    const params = new URLSearchParams(window.location.search)
    const urlTariff = params.get('tariff')
    const urlCat = params.get('category')

    if (urlTariff && tariffSelect) {
      if (['DEFAULT', 'PRO', 'VIP', 'STREAM'].includes(urlTariff)) {
        tariffSelect.value = urlTariff
      }
    } else if (urlCat && tariffSelect) {
      const catToTariff: Record<string, string> = {
        STANDART: 'DEFAULT',
        PRO: 'PRO',
        VIP: 'VIP',
        STREAMER: 'STREAM',
      }
      if (catToTariff[urlCat]) {
        tariffSelect.value = catToTariff[urlCat]
      }
    }
  } catch {

  }

  const updateCategoryText = () => {
    if (!categoryInfoText || !tariffSelect) return
    categoryInfoText.textContent =
      categoryDescriptions[tariffSelect.value] ?? categoryDescriptions.DEFAULT
  }
  updateCategoryText()

  const loadAvailability = async () => {
    if (!dateInput || !tariffSelect || !timeInput || !durationSelect) {
      return
    }

    const date = dateInput.value
    const tariff = tariffSelect.value
    const time = timeInput.value
    const duration = durationSelect.value

    if (!date) {
      if (availabilityStatus) {
        availabilityStatus.textContent =
          'Вільний комп’ютер і його номер буде призначено автоматично після перевірки доступності.'
      }
      return
    }

    activeAbortController?.abort()
    activeAbortController = new AbortController()

    if (availabilityStatus) {
      availabilityStatus.textContent = 'Перевіряємо, чи є вільний комп’ютер…'
    }

    try {
      const query = new URLSearchParams({ tariff, date, time, duration }).toString()
      const res = await fetch(`/api/bookings?${query}`, {
        signal: activeAbortController.signal,
      })
      const body = (await res.json()) as { availableCount?: number; message?: string }

      if (!res.ok) {
        throw new Error(body?.message ?? 'Не вдалося перевірити доступність.')
      }

      const availableCount = Number(body?.availableCount) || 0

      if (availableCount === 0) {
        if (availabilityStatus) {
          availabilityStatus.textContent =
            'На обраний час немає вільних комп’ютерів. Спробуйте інший час або тариф.'
        }
      } else {
        if (availabilityStatus) {
          availabilityStatus.textContent = `Є вільні комп’ютери: ${availableCount}. Номер буде призначено автоматично.`
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
      if (availabilityStatus) {
        availabilityStatus.textContent =
          (err as Error)?.message ?? 'Не вдалося перевірити доступність комп’ютерів.'
      }
    }
  }

  const scheduleAvailability = () => {
    if (pendingAvailability) return
    pendingAvailability = true
    queueMicrotask(() => {
      pendingAvailability = false
      void loadAvailability()
    })
  }

  tariffSelect?.addEventListener('change', () => {
    updateCategoryText()
    scheduleAvailability()
  })
  dateInput?.addEventListener('input', scheduleAvailability)
  dateInput?.addEventListener('change', scheduleAvailability)
  timeInput?.addEventListener('input', scheduleAvailability)
  timeInput?.addEventListener('change', scheduleAvailability)
  durationSelect?.addEventListener('change', scheduleAvailability)

  const onSubmit = async (e: Event) => {
    e.preventDefault()

    if (isSubmitting) return

    await profileRequest

    const name = nameInput?.value.trim() ?? ''
    const phone = phoneInput?.value.trim() ?? ''
    const email = emailInput?.value.trim().toLowerCase() ?? ''
    const tariff = tariffSelect?.value ?? 'DEFAULT'
    const date = dateInput?.value ?? ''
    const time = timeInput?.value ?? ''
    const duration = Number(durationSelect?.value ?? 2)

    if (!/^\+380[0-9]{9}$/.test(phone)) {
      showError('Введіть номер у форматі +380 і 9 цифр, наприклад +380501234567.')
      phoneInput?.focus()
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      showError('Enter a valid email address.')
      emailInput?.focus()
      return
    }

    isSubmitting = true
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.setAttribute('aria-busy', 'true')
    }

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          phone,
          email,
          tariff,
          date,
          time,
          duration,
        }),
      })

      let body: unknown
      try {
        body = await response.json()
      } catch {
        showError(CONNECTION_ERROR)
        return
      }

      if (!response.ok) {
        showError(getApiErrorMessage(body, response.status))
        return
      }

      const resObj = body as { doc?: Record<string, unknown> }
      if (!resObj || !resObj.doc || !resObj.doc.id) {
        showError('Сервер не підтвердив збереження заявки. Спробуйте ще раз.')
        return
      }

      const doc = resObj.doc
      if (form) form.style.display = 'none'
      if (successBox) {
        successBox.innerHTML = `
          <div class="success-header">
            <svg class="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 class="success-title">
              ВИ УСПІШНО ЗАБРОНЮВАЛИ<br>КОМ’ЮТЕР
            </h2>
          </div>
          <div class="success-body">
            <dl class="details-list">
              <div class="detail-row">
                <dt class="detail-label">№ бронювання</dt>
                <dd class="detail-value highlight" id="success-id">#${doc.id}</dd>
              </div>
              <div class="detail-row">
                <dt class="detail-label">Ім’я клієнта</dt>
                <dd class="detail-value" id="success-name">${escapeHtml(String(doc.name ?? ''))}</dd>
              </div>
              <div class="detail-row">
                <dt class="detail-label">Комп’ютер</dt>
                <dd class="detail-value" id="success-computer">${escapeHtml(String(doc.computer ?? '').replace('PC-', 'ПК-'))}</dd>
              </div>
              <div class="detail-row">
                <dt class="detail-label">Категорія</dt>
                <dd class="detail-value" id="success-category">${escapeHtml(doc.computerCategory === 'STREAMER' ? 'STREAM' : String(doc.computerCategory ?? '-'))}</dd>
              </div>
              <div class="detail-row">
                <dt class="detail-label">Тариф</dt>
                <dd class="detail-value" id="success-tariff">${escapeHtml(String(doc.tariff ?? ''))}</dd>
              </div>
              <div class="detail-row">
                <dt class="detail-label">Дата</dt>
                <dd class="detail-value" id="success-date">${formatDate(String(doc.date ?? ''))}</dd>
              </div>
              <div class="detail-row">
                <dt class="detail-label">Час початку</dt>
                <dd class="detail-value" id="success-time">${escapeHtml(String(doc.time ?? ''))}</dd>
              </div>
              <div class="detail-row">
                <dt class="detail-label">Тривалість</dt>
                <dd class="detail-value" id="success-duration">${durationLabel(Number(doc.duration ?? 2))}</dd>
              </div>
            </dl>

            <div class="success-actions">
              <a href="/booking" class="btn-outline" style="flex: 1; text-align: center;">Нове бронювання</a>
              <a href="/" class="btn-lime" style="flex: 1; text-align: center;">На головну</a>
            </div>
          </div>
        `
        successBox.style.display = 'block'
      }
    } catch {
      showError(CONNECTION_ERROR)
    } finally {
      isSubmitting = false
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.removeAttribute('aria-busy')
      }
    }
  }

  form?.addEventListener('submit', onSubmit)

  return () => {
    document.removeEventListener('keydown', onKeyDown)
    form?.removeEventListener('submit', onSubmit)
    activeAbortController?.abort()
    hideError()
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initBookingClient())
  } else {
    initBookingClient()
  }
}

