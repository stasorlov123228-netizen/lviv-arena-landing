
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderBookingPage } from '@/templates/booking'
import { initBookingClient } from '@/client/bookingClient'
import { handleBookingAfterError } from '@/collections/Bookings'

const response = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

let cleanupBooking: (() => void) | null = null

const renderBooking = async () => {
  document.body.innerHTML = renderBookingPage()
  const phone = document.querySelector<HTMLInputElement>('#phone')
  const email = document.querySelector<HTMLInputElement>('#email')
  if (phone) phone.value = '+380501234567'
  if (email) email.value = 'guest@example.com'
  const bookingFetch = globalThis.fetch
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === '/api/auth/profile') return Promise.resolve(response(401, {})) as Promise<Response>
    return bookingFetch(input, init)
  }))
  cleanupBooking = initBookingClient()
}

const submitBooking = async () => {
  const form = document.querySelector('form')
  if (!form) throw new Error('Booking form was not rendered')

  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await new Promise((resolve) => setTimeout(resolve, 10))
}

describe('booking form errors', () => {
  afterEach(() => {
    cleanupBooking?.()
    cleanupBooking = null
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it('rejects a phone number without exactly nine digits after +380', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await renderBooking()
    const phone = document.querySelector<HTMLInputElement>('#phone')
    if (!phone) throw new Error('Phone input was not rendered')
    phone.value = '+3801234567890'

    await submitBooking()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('+380 і 9 цифр')
  })

  it('shows success only after the API confirms a saved document', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(201, { doc: { id: 42 } }))
    vi.stubGlobal('fetch', fetchMock)

    await renderBooking()
    await submitBooking()

    expect(document.body.textContent).toContain('ЗАБРОНЮВАЛИ')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('shows the booking conflict message from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response(409, {
          message: 'Вибраний час щойно зайняли. Оберіть інший час і спробуйте ще раз.',
          errors: [
            {
              message: 'Вибраний час щойно зайняли. Оберіть інший час і спробуйте ще раз.',
            },
          ],
        }),
      ),
    )

    await renderBooking()
    await submitBooking()

    expect(document.body.textContent).toContain(
      'Вибраний час щойно зайняли. Оберіть інший час і спробуйте ще раз.',
    )
    const dialog = document.querySelector('[role="alertdialog"]')
    expect(dialog).toBeTruthy()
    const overlay = dialog?.parentElement
    if (!overlay) throw new Error('Booking error overlay was not rendered')
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('shows Payload validation messages and the invalid field label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response(400, {
          message: 'Validation Error.',
          errors: [{ field: 'phone', message: 'This field is required.' }],
        }),
      ),
    )

    await renderBooking()
    await submitBooking()

    expect(document.body.textContent).toMatch(/Номер телефону: Це поле обов’язкове\./)
    expect(document.body.textContent).not.toContain('ЗАБРОНЮВАЛИ')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
  })

  it('shows a connection error when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await renderBooking()
    await submitBooking()

    expect(document.body.textContent).toContain(
      'Не вдалося зв’язатися із сервером. Перевірте підключення до інтернету та спробуйте ще раз.',
    )
  })

  it('shows a connection error when the API response cannot be parsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Invalid JSON')
        },
      }),
    )

    await renderBooking()
    await submitBooking()

    expect(document.body.textContent).toContain(
      'Не вдалося зв’язатися із сервером. Перевірте підключення до інтернету та спробуйте ще раз.',
    )
  })

  it('shows availability without exposing a selectable computer number', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (!url.startsWith('/api/bookings?')) {
        return response(201, { doc: { id: 42 } })
      }

      const params = new URLSearchParams(url.split('?')[1])
      return response(
        200,
        params.get('tariff') === 'PRO'
          ? { category: 'PRO', availableCount: 2 }
          : { category: 'STANDART', availableCount: 2 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await renderBooking()

    const dateInput = document.querySelector<HTMLInputElement>('#date')
    if (!dateInput) throw new Error('Date input was not rendered')

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(dateInput, '2026-10-20')
    dateInput.dispatchEvent(new Event('input', { bubbles: true }))
    dateInput.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector('#computer')).toBeNull()
    expect(document.querySelector('#availability-status')?.textContent).toContain('Номер буде призначено автоматично')

    const tariffSelect = document.querySelector<HTMLSelectElement>('#tariff')
    if (!tariffSelect) throw new Error('Tariff selector was not rendered')

    const tariffSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
    tariffSetter?.call(tariffSelect, 'PRO')
    tariffSelect.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.querySelector('#availability-status')?.textContent).toContain('Є вільні комп’ютери: 2')
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('tariff=DEFAULT'),
      expect.stringContaining('tariff=PRO'),
    ])
  })

  it('keeps entered values and prevents a second submission while saving', async () => {
    let resolveResponse: (value: ReturnType<typeof response>) => void = () => {}
    const fetchMock = vi.fn(
      () =>
        new Promise<ReturnType<typeof response>>((resolve) => {
          resolveResponse = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await renderBooking()
    const nameInput = document.querySelector<HTMLInputElement>('#name')
    if (!nameInput) throw new Error('Name input was not rendered')

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(nameInput, 'Олена')
    nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    nameInput.dispatchEvent(new Event('change', { bubbles: true }))

    const form = document.querySelector('form')
    if (!form) throw new Error('Booking form was not rendered')

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    const submitButton = document.querySelector<HTMLButtonElement>('button[type="submit"]')
    expect(submitButton?.disabled).toBe(true)
    expect(nameInput.value).toBe('Олена')

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(fetchMock).toHaveBeenCalledOnce()

    resolveResponse(response(201, { doc: { id: 42 } }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.body.textContent).toContain('ЗАБРОНЮВАЛИ')
  })
})

describe('booking API error formatting', () => {
  it('returns an HTTP 409 for the PostgreSQL exclusion constraint without leaking SQL', () => {
    const postgresError = Object.assign(new Error('internal database detail'), {
      code: '23P01',
      constraint: 'bookings_no_overlapping_computer',
    })
    const error = Object.assign(new Error('query failed'), { cause: postgresError })
    const result = handleBookingAfterError({ error })

    expect(result.status).toBe(409)
    expect(JSON.stringify(result.response)).toContain('заброньовано')
    expect(JSON.stringify(result.response)).not.toContain('internal database detail')
  })

  it('returns a safe server message instead of an internal stack trace', () => {
    const error = new Error('database password and SQL details')
    const result = handleBookingAfterError({ error })

    expect(result.status).toBe(500)
    expect(result.response.message).toBe('Не вдалося створити бронювання через помилку сервера.')
    expect(JSON.stringify(result.response)).not.toContain('database password')
  })
})
