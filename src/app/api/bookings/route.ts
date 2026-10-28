
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import { sql } from 'drizzle-orm'
import config from '@payload-config'
import { getCurrentUser } from '@/utilities/auth'
import { findAvailableComputerNumbers } from '@/utilities/computers'
import { calculateBookingTotal } from '@/utilities/money'
import {
  bookingRangesOverlap,
  getBookingRange,
  isBookingCategory,
  isBookingTariff,
  isValidBookingDate,
  isValidBookingDuration,
  isValidBookingTime,
  type BookingCategory,
  type BookingComputer,
} from '@/utilities/booking'

const bookingConflictMessage =
  'Вибраний час щойно зайняли. Оберіть інший час і спробуйте ще раз.'

function getErrorStatus(error: unknown): number | undefined {
  const visited = new Set<object>()
  let current: unknown = error

  while (typeof current === 'object' && current !== null && !visited.has(current)) {
    visited.add(current)

    if (
      'status' in current &&
      typeof current.status === 'number' &&
      current.status >= 400 &&
      current.status < 600
    ) {
      return current.status
    }

    if ('code' in current && current.code === '23P01') {
      return 409
    }

    current = 'cause' in current ? current.cause : undefined
  }

  return undefined
}

function getKyivDateTime() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''

  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  }
}

function validateSchedule(
  date: string | null,
  time: string | null,
  duration: string | null,
) {
  if (
    !date ||
    !isValidBookingDate(date) ||
    !time ||
    !isValidBookingTime(time) ||
    duration === null ||
    !isValidBookingDuration(duration)
  ) {
    return null
  }

  return { date, time, duration: Number(duration) }
}

async function findRelevantBookings(
  payload: Payload,
  computers: string[],
  firstRelevantDate: Date,
  targetDate: Date,
) {
  if (!payload.db?.drizzle) {
    return payload.find({
      collection: 'bookings',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      where: {
        and: [
          { computer: { in: computers } },
          { date: { greater_than_equal: firstRelevantDate.toISOString() } },
          { date: { less_than_equal: targetDate.toISOString() } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
    }).then((result) => result.docs)
  }

  const computerParams = sql.join(computers.map((computer) => sql`${computer}`), sql`, `)
  const result = await payload.db.drizzle.execute(sql`
    SELECT computer, date, time, duration
    FROM bookings
    WHERE computer IN (${computerParams})
      AND date >= ${firstRelevantDate.toISOString()}
      AND date <= ${targetDate.toISOString()}
      AND status <> 'cancelled'
  `)
  const rows = (result as { rows?: Array<Record<string, unknown>> }).rows ?? []
  return rows.map((row) => ({
    computer: typeof row.computer === 'string' ? row.computer : null,
    date: row.date instanceof Date ? row.date.toISOString() : typeof row.date === 'string' ? row.date : null,
    time: typeof row.time === 'string' ? row.time : null,
    duration: typeof row.duration === 'number' ? row.duration : Number(row.duration),
  }))
}

async function findComputersAvailableForSchedule(
  payload: Payload,
  category: BookingCategory,
  schedule: { date: string; time: string; duration: number },
): Promise<string[]> {
  const requestedRange = getBookingRange(schedule.date, schedule.time, schedule.duration)
  if (!requestedRange) return []

  const targetDate = new Date(`${schedule.date}T00:00:00.000Z`)
  const firstRelevantDate = new Date(targetDate.getTime() - 24 * 60 * 60 * 1000)
  const computers = await findAvailableComputerNumbers(payload, category)
  if (!computers.length) return []

  const existingBookings = await findRelevantBookings(payload, computers, firstRelevantDate, targetDate)
  const occupiedComputers = new Set<BookingComputer>()

  for (const booking of existingBookings) {
    if (!booking.computer || !booking.date || !booking.time || !booking.duration) continue
    const existingRange = getBookingRange(booking.date, booking.time, booking.duration)
    if (existingRange && bookingRangesOverlap(requestedRange, existingRange)) {
      occupiedComputers.add(booking.computer)
    }
  }

  return computers.filter((computer) => !occupiedComputers.has(computer))
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const tariff = params.get('tariff')

  const schedule = validateSchedule(
    params.get('date'),
    params.get('time'),
    params.get('duration'),
  )

  if (!isBookingTariff(tariff) || !schedule) {
    return Response.json(
      { message: 'Вкажіть коректні тариф, дату, час і тривалість бронювання.' },
      { status: 400 },
    )
  }

  try {
    const payload = await getPayload({ config })
    const tariffDocs = await payload.find({ collection: 'tariffs', overrideAccess: true, limit: 1, where: { and: [{ name: { equals: tariff } }, { isActive: { equals: true } }] } })
    const tariffDoc = tariffDocs.docs[0]
    if (!tariffDoc || !isBookingCategory(tariffDoc.computerCategory)) return Response.json({ availableCount: 0 })
    const category: BookingCategory = tariffDoc.computerCategory
    const availableComputers = await findComputersAvailableForSchedule(payload, category, schedule)
    return Response.json({ category, availableCount: availableComputers.length })
  } catch (error) {
    console.error('Booking availability API error:', error)

    return Response.json(
      { message: 'Не вдалося перевірити доступність комп’ютерів.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return Response.json(
      { message: 'Запит містить некоректний JSON.' },
      { status: 400 },
    )
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return Response.json(
      { message: 'Перевірте правильність заповнення всіх полів.' },
      { status: 400 },
    )
  }

  const data = body as Record<string, unknown>
  const { name, email: submittedEmail, phone, tariff, date, time, duration } = data
  const user = await getCurrentUser(request)
  const normalizedEmail = (user?.email ?? (typeof submittedEmail === 'string' ? submittedEmail : '')).trim().toLowerCase()
  const normalizedName = user?.name?.trim() || (typeof name === 'string' ? name.trim() : '')
  const savedPhone = user?.phone?.trim()
  const normalizedPhone = (savedPhone && /^\+380\d{9}$/.test(savedPhone) ? savedPhone : typeof phone === 'string' ? phone : '').trim()

  const schedule = validateSchedule(
    typeof date === 'string' ? date : null,
    typeof time === 'string' ? time : null,
    duration === undefined || duration === null
      ? null
      : String(duration),
  )

  if (!/^\+380\d{9}$/.test(normalizedPhone)) {
    return Response.json(
      { message: 'Введіть номер у форматі +380 і 9 цифр, наприклад +380501234567.' },
      { status: 400 },
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    return Response.json({ message: 'Enter a valid email address.' }, { status: 400 })
  }

  if (
    !normalizedName ||
    !isBookingTariff(tariff) ||
    !schedule
  ) {
    return Response.json(
      { message: 'Перевірте правильність заповнення всіх полів.' },
      { status: 400 },
    )
  }

  const now = getKyivDateTime()

  if (
    schedule.date < now.date ||
    (schedule.date === now.date && schedule.time <= now.time)
  ) {
    return Response.json(
      { message: 'Не можна забронювати комп’ютер на минулий час.' },
      { status: 400 },
    )
  }

  try {
    const payload = await getPayload({ config })

    const existingPhone = await payload.db.drizzle.execute(sql`
      SELECT id FROM users WHERE phone = ${normalizedPhone} LIMIT 1
    `)
    const phoneOwner = ((existingPhone as unknown as { rows?: Array<{ id: number | string }> }).rows ?? [])[0]
    if (phoneOwner && String(phoneOwner.id) !== String(user?.id ?? '')) {
      return Response.json(
        { code: 'PHONE_IN_USE', message: 'Цей номер телефону вже прив’язаний до зареєстрованого акаунта. Увійдіть у нього або вкажіть інший номер.' },
        { status: 409 },
      )
    }

    const tariffRecord = await payload.find({ collection: 'tariffs', overrideAccess: true, limit: 1, where: { and: [{ name: { equals: tariff } }, { isActive: { equals: true } }] } })
    const tariffDoc = tariffRecord.docs[0]
    if (!tariffDoc || !isBookingCategory(tariffDoc.computerCategory)) {
      return Response.json({ message: 'Тариф не знайдено або він неактивний.' }, { status: 409 })
    }
    const category: BookingCategory = tariffDoc.computerCategory
    const totalAmount = tariffDoc ? calculateBookingTotal(tariffDoc.pricePerHour, schedule.duration) : null
    if (totalAmount === null) {
      return Response.json({ message: 'Обраний тариф неактивний або його ціну ще не налаштовано.' }, { status: 409 })
    }
    const availableComputers = await findComputersAvailableForSchedule(payload, category, schedule)
    const computer = availableComputers[0]
    if (!computer) return Response.json({ message: 'На вибраний час немає вільних комп’ютерів. Оберіть інший час.' }, { status: 409 })
    const doc = await payload.create({
      collection: 'bookings',
      overrideAccess: true,
      context: { bookingOwnerId: user ? Number(user.id) : null },
      data: {
        name: normalizedName,
        phone: normalizedPhone,
        email: normalizedEmail,
        tariff,
        computerCategory: category,
        computer,
        date: `${schedule.date}T00:00:00.000Z`,
        time: schedule.time,
        duration: schedule.duration,
        status: 'new',
        paymentMethod: 'cash',
        paymentStatus: 'unpaid',
        totalAmount,
        user: user ? Number(user.id) : null,
      },
    })

    return Response.json({ doc }, { status: 201 })
  } catch (error) {
    const status = getErrorStatus(error)

    if (status === 409) {
      return Response.json(
        { message: bookingConflictMessage },
        { status: 409 },
      )
    }

    if (status && status < 500) {
      return Response.json(
        { message: 'Перевірте правильність заповнення даних бронювання.' },
        { status },
      )
    }

    console.error('Booking API error:', error)

    return Response.json(
      { message: 'Не вдалося створити бронювання через помилку сервера.' },
      { status: 500 },
    )
  }
}
