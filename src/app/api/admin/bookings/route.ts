import { getPayload, type Where } from 'payload'
import configPromise from '@payload-config'
import { requireAdmin } from '@/utilities/auth'
import { getBookingRange, isBookingCategory, isBookingTariff, isValidBookingDate, isValidBookingDuration, isValidBookingTime } from '@/utilities/booking'

function getErrorStatus(error: unknown): number | undefined {
  const seen = new Set<object>()
  let current: unknown = error
  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    seen.add(current)
    if ('status' in current && typeof current.status === 'number' && current.status >= 400 && current.status < 600) return current.status
    if ('code' in current && current.code === '23P01') return 409
    current = 'cause' in current ? current.cause : undefined
  }
  return undefined
}

function bookingErrorResponse(error: unknown): Response {
  const status = getErrorStatus(error)
  if (status === 409) return Response.json({ message: 'Обраний час або комп’ютер уже зайнятий іншим бронюванням. Перевірте розклад і спробуйте ще раз.' }, { status })
  if (status && status < 500) {
    if (typeof error === 'object' && error !== null && 'data' in error && typeof error.data === 'object' && error.data !== null && 'errors' in error.data && Array.isArray(error.data.errors)) {
      const messages = error.data.errors
        .map((item) => typeof item === 'object' && item !== null && 'message' in item && typeof item.message === 'string' ? item.message : '')
        .filter(Boolean)
      if (messages.length) return Response.json({ message: messages.join(' ') }, { status })
    }
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string' && /оплачен|тариф|бронювання/i.test(error.message)) {
      return Response.json({ message: error.message }, { status })
    }
    return Response.json({ message: 'Перевірте дату, час, тривалість, тариф та інші дані бронювання.' }, { status })
  }
  console.error('Admin booking mutation failed:', error)
  return Response.json({ message: 'Не вдалося зберегти бронювання через помилку сервера.' }, { status: 500 })
}

function dateOnly(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'string') return value.slice(0, 10)
  return null
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  const search = url.searchParams.get('search')?.trim() || ''
  const status = url.searchParams.get('status')?.trim() || ''
  const tariff = url.searchParams.get('tariff')?.trim() || ''
  const date = url.searchParams.get('date')?.trim() || ''
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 200)

  try {
    const payload = await getPayload({ config: configPromise })

    const whereConditions: Where[] = []

    if (status && status !== 'all') {
      whereConditions.push({ status: { equals: status } })
    }

    if (tariff && tariff !== 'all') {
      whereConditions.push({ tariff: { equals: tariff } })
    }

    if (date) {
      const targetDate = new Date(`${date}T00:00:00.000Z`)
      const nextDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
      whereConditions.push({
        and: [
          { date: { greater_than_equal: targetDate.toISOString() } },
          { date: { less_than: nextDate.toISOString() } },
        ],
      })
    }

    if (search) {
      const isNum = !isNaN(Number(search))
      const searchOr: Where[] = [
        { name: { like: search } },
        { phone: { like: search } },
      ]
      if (search.toUpperCase().startsWith('PC')) {
        searchOr.push({ computer: { equals: search.toUpperCase() } })
      }
      if (isNum) {
        searchOr.push({ id: { equals: Number(search) } })
      }
      whereConditions.push({ or: searchOr })
    }

    const bookings = await payload.find({
      collection: 'bookings',
      overrideAccess: true,
      depth: 0,
      limit,
      sort: '-createdAt',
      where: (whereConditions.length > 0 ? { and: whereConditions } : {}) as Where,
    })

    return Response.json({
      docs: bookings.docs,
      totalDocs: bookings.totalDocs,
      totalPages: bookings.totalPages,
    })
  } catch (err: unknown) {
    console.error('Admin bookings GET error:', err)
    return Response.json(
      { message: 'Не вдалося завантажити бронювання.' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ message: 'Некоректний JSON.' }, { status: 400 })
  }

  const id = Number(body.id)
  if (!Number.isSafeInteger(id) || id <= 0) {
    return Response.json({ message: 'Вкажіть ID бронювання.' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const existing = await payload.findByID({
      collection: 'bookings',
      id,
      overrideAccess: true,
    })

    if (!existing) {
      return Response.json({ message: 'Бронювання не знайдено.' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.status !== undefined) {
      if (typeof body.status !== 'string') return Response.json({ message: 'Неприпустимий статус.' }, { status: 400 })
      if (!['new', 'confirmed', 'cancelled'].includes(body.status)) {
        return Response.json({ message: 'Неприпустимий статус.' }, { status: 400 })
      }
      updateData.status = body.status
    }

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) return Response.json({ message: 'Вкажіть ім’я клієнта.' }, { status: 400 })
      updateData.name = body.name.trim()
    }
    if (body.phone !== undefined) {
      if (typeof body.phone !== 'string' || !body.phone.trim()) return Response.json({ message: 'Вкажіть номер телефону клієнта.' }, { status: 400 })
      updateData.phone = body.phone.trim()
    }
    if (body.tariff !== undefined) {
      if (!isBookingTariff(body.tariff)) return Response.json({ message: 'Оберіть коректний тариф.' }, { status: 400 })
      updateData.tariff = body.tariff
    }
    if (body.user !== undefined) {
      if (body.user === null || body.user === '') {
        updateData.user = null
      } else {
        const userId = Number(body.user)
        if (!Number.isSafeInteger(userId) || userId <= 0) return Response.json({ message: 'Оберіть коректного користувача.' }, { status: 400 })
        const linkedUser = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
        const currentUserId = existing.user && typeof existing.user === 'object' ? existing.user.id : existing.user
        if (!linkedUser || (linkedUser.isBlocked && String(currentUserId) !== String(userId))) return Response.json({ message: 'Користувача не знайдено або його обліковий запис заблокований.' }, { status: 400 })
        updateData.user = userId
      }
    }
    if (body.computer !== undefined) {
      if (typeof body.computer !== 'string' || !body.computer.trim()) return Response.json({ message: 'Вкажіть номер комп’ютера.' }, { status: 400 })
      updateData.computer = body.computer.trim().toUpperCase()
    }
    if (body.date !== undefined) {
      const currentDate = dateOnly(existing.date)
      if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || (body.date !== currentDate && !isValidBookingDate(body.date))) {
        return Response.json({ message: 'Оберіть коректну дату бронювання, не раніше сьогоднішньої.' }, { status: 400 })
      }
      updateData.date = body.date
    }
    if (body.time !== undefined) {
      if (typeof body.time !== 'string' || !isValidBookingTime(body.time)) return Response.json({ message: 'Вкажіть час у форматі ГГ:ХХ.' }, { status: 400 })
      updateData.time = body.time
    }
    if (body.duration !== undefined) {
      if (!isValidBookingDuration(body.duration)) return Response.json({ message: 'Тривалість має бути 1, 2, 3, 5 або 8 годин.' }, { status: 400 })
      updateData.duration = body.duration
    }

    const newStatus = (updateData.status ?? existing.status) as string
    const newComputer = (updateData.computer ?? existing.computer) as string
    const newDate = dateOnly(updateData.date ?? existing.date)
    const newTime = (updateData.time ?? existing.time) as string
    const newDuration = (updateData.duration ?? existing.duration) as number
    const scheduleChanged =
      (newDate !== dateOnly(existing.date)) ||
      (newTime !== existing.time) ||
      (newDuration !== existing.duration) ||
      (newComputer !== existing.computer) ||
      (updateData.tariff !== undefined && updateData.tariff !== existing.tariff) ||
      (newStatus !== existing.status)

    if (newStatus !== 'cancelled' && scheduleChanged) {
      const dateIsNotPast = newDate === dateOnly(existing.date) || (newDate !== null && isValidBookingDate(newDate))
      if (!newDate || !newTime || !isValidBookingTime(newTime) || !isValidBookingDuration(newDuration) || !dateIsNotPast) {
        return Response.json({ message: 'Перевірте дату, час і тривалість бронювання.' }, { status: 400 })
      }
      const requestedRange = getBookingRange(newDate, newTime, newDuration)
      if (!requestedRange) return Response.json({ message: 'Неможливо перевірити вибраний розклад.' }, { status: 400 })

      const conflicts = await payload.find({
        collection: 'bookings', depth: 0, overrideAccess: true, pagination: false,
        where: { and: [
          { id: { not_equals: existing.id } },
          { computer: { equals: newComputer } },
          { status: { not_equals: 'cancelled' } },
        ] },
      })
      const hasOverlap = conflicts.docs.some((other) => {
        const otherDate = dateOnly(other.date)
        if (!otherDate || !other.time || !other.duration) return false
        const otherRange = getBookingRange(otherDate, other.time, other.duration)
        return Boolean(otherRange && requestedRange.start < otherRange.end && otherRange.start < requestedRange.end)
      })
      if (hasOverlap) {
        return Response.json({ message: 'Цей комп’ютер уже зайнятий на вказаний час іншим бронюванням.' }, { status: 409 })
      }
    }

    const effectiveTariff = (updateData.tariff ?? existing.tariff) as string
    const tariff = await payload.find({ collection: 'tariffs', overrideAccess: true, limit: 1, where: { name: { equals: effectiveTariff } } })
    const selectedTariff = tariff.docs[0]
    if (body.tariff !== undefined && selectedTariff && isBookingCategory(selectedTariff.computerCategory)) {
      updateData.computerCategory = selectedTariff.computerCategory
    }
    if (body.tariff !== undefined) {
      if (!selectedTariff || selectedTariff.isActive === false || !isBookingCategory(selectedTariff.computerCategory)) {
        return Response.json({ message: 'Обраний тариф неактивний або має некоректну категорію.' }, { status: 400 })
      }
    }

    if (newStatus !== 'cancelled' && (body.tariff !== undefined || body.computer !== undefined || body.status === 'confirmed')) {
      const category = selectedTariff?.computerCategory
      const computer = await payload.find({ collection: 'computers', overrideAccess: true, limit: 1, where: { computerNumber: { equals: newComputer } } })
      const selectedComputer = computer.docs[0]
      if (!selectedTariff || selectedTariff.isActive === false || !isBookingCategory(category) || !selectedComputer || selectedComputer.category !== category || ['offline', 'maintenance'].includes(selectedComputer.status)) {
        return Response.json({ message: 'Вибраний комп’ютер не існує, не відповідає категорії тарифу або перебуває на обслуговуванні/офлайн.' }, { status: 400 })
      }
    }

    const updated = await payload.update({
      collection: 'bookings',
      id,
      overrideAccess: true,
      data: updateData,
    })

    return Response.json({ doc: updated, message: 'Бронювання успішно оновлено.' })
  } catch (err: unknown) {
    return bookingErrorResponse(err)
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  const id = url.searchParams.get('id')

  if (!id || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    return Response.json({ message: 'Вкажіть ID для скасування.' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config: configPromise })

    const bookingId = Number(id)
    const booking = await payload.findByID({ collection: 'bookings', id: bookingId, overrideAccess: true }).catch(() => null)
    if (!booking) return Response.json({ message: '\u0411\u0440\u043e\u043d\u044e\u0432\u0430\u043d\u043d\u044f \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e.' }, { status: 404 })

    const relatedPayments = await payload.find({
      collection: 'payments',
      overrideAccess: true,
      limit: 100,
      where: { booking: { equals: bookingId } },
    })

    // Payment rows have a required booking relation, so remove them before the booking.
    for (const payment of relatedPayments.docs) {
      await payload.delete({ collection: 'payments', id: payment.id, overrideAccess: true })
    }
    const deleted = await payload.delete({ collection: 'bookings', id: bookingId, overrideAccess: true })
    return Response.json({ doc: deleted, message: '\u0411\u0440\u043e\u043d\u044e\u0432\u0430\u043d\u043d\u044f \u0442\u0430 \u043f\u043e\u0432\u2019\u044f\u0437\u0430\u043d\u0438\u0439 \u043f\u043b\u0430\u0442\u0456\u0436 \u0432\u0438\u0434\u0430\u043b\u0435\u043d\u043e \u0437 \u0431\u0430\u0437\u0438 \u0434\u0430\u043d\u0438\u0445.' })
  } catch (err: unknown) {
    return bookingErrorResponse(err)
  }
}

