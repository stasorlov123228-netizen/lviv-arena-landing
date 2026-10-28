import { getPayload, type Where } from 'payload'
import configPromise from '@payload-config'
import { requireAdmin } from '@/utilities/auth'
import { syncComputerStatuses } from '@/utilities/syncComputerStatuses'

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  const category = url.searchParams.get('category')?.trim() || ''
  const status = url.searchParams.get('status')?.trim() || ''
  const search = url.searchParams.get('search')?.trim() || ''

  try {
    const payload = await getPayload({ config: configPromise })
    await syncComputerStatuses(payload)

    const whereConditions: Where[] = []

    if (category && category !== 'all') {
      whereConditions.push({ category: { equals: category } })
    }

    if (status && status !== 'all') {
      whereConditions.push({ status: { equals: status } })
    }

    if (search) {
      whereConditions.push({
        or: [
          { computerNumber: { like: search } },
          { description: { like: search } },
        ],
      })
    }

    const computers = await payload.find({
      collection: 'computers',
      overrideAccess: true,
      limit: 100,
      sort: 'computerNumber',
      where: (whereConditions.length > 0 ? { and: whereConditions } : {}) as Where,
    })

    return Response.json({
      docs: computers.docs,
      totalDocs: computers.totalDocs,
    })
  } catch (err: unknown) {
    console.error('Admin computers GET error:', err)
    return Response.json(
      { message: 'Не вдалося завантажити комп’ютери.' },
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
    return Response.json({ message: 'Вкажіть ID комп’ютера.' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const existing = await payload.findByID({
      collection: 'computers',
      id,
      overrideAccess: true,
    })

    if (!existing) {
      return Response.json({ message: 'Комп’ютер не знайдено.' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (typeof body.status === 'string') {
      if (!['available', 'occupied', 'maintenance', 'offline'].includes(body.status)) {
        return Response.json({ message: 'Неприпустимий статус комп’ютера.' }, { status: 400 })
      }
      updateData.status = body.status
      updateData.manualOccupied = body.status === 'occupied'

      if (['maintenance', 'offline'].includes(body.status)) {
        const todayStr = new Date().toISOString().slice(0, 10)
        const activeBookings = await payload.find({
          collection: 'bookings',
          overrideAccess: true,
          limit: 1,
          where: {
            and: [
              { computer: { equals: existing.computerNumber } },
              { status: { equals: 'confirmed' } },
              { date: { greater_than_equal: `${todayStr}T00:00:00.000Z` } },
            ],
          },
        })

        if (activeBookings.docs.length > 0) {
          return Response.json(
            {
              message: `Неможливо перевести ${existing.computerNumber} у статус "${body.status}": на нього є активні підтверджені бронювання. Спочатку скасуйте або перенесіть їх.`,
            },
            { status: 409 },
          )
        }
      }
    }

    if (typeof body.description === 'string') {
      updateData.description = body.description
    }

    if (typeof body.category === 'string') {
      if (!['STANDART', 'PRO', 'VIP', 'STREAMER'].includes(body.category)) {
        return Response.json({ message: 'Неприпустима категорія комп’ютера.' }, { status: 400 })
      }
      updateData.category = body.category
    }

    const updated = await payload.update({
      collection: 'computers',
      id,
      overrideAccess: true,
      data: updateData,
    })

    return Response.json({ doc: updated, message: 'Статус комп’ютера успішно оновлено.' })
  } catch (err: unknown) {
    console.error('Admin computers PATCH error:', err)
    return Response.json(
      { message: typeof err === 'object' && err !== null && 'status' in err && err.status === 409
        ? 'Неможливо змінити статус: для комп’ютера є активні підтверджені бронювання.'
        : 'Не вдалося оновити комп’ютер. Перевірте введені дані та спробуйте ще раз.' },
      { status: typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number' && err.status < 500 ? err.status : 500 },
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json({ message: 'Некоректний JSON.' }, { status: 400 })
  }

  const rawComputerNumber = typeof body.computerNumber === 'string' ? body.computerNumber.trim().toUpperCase() : ''
  const computerNumber = rawComputerNumber
    ? `PC-${rawComputerNumber.replace(/^(?:ПК-|PC-)/i, '')}`
    : ''
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const status = typeof body.status === 'string' ? body.status.trim() : 'available'
  const description = typeof body.description === 'string' ? body.description.trim() : ''

  if (!/^PC-\d+$/.test(computerNumber) || !category) {
    return Response.json(
      { message: 'Вкажіть номер у форматі PC- та цифри, а також категорію.' },
      { status: 400 },
    )
  }
  if (!['STANDART', 'PRO', 'VIP', 'STREAMER'].includes(category)) {
    return Response.json({ message: 'Оберіть коректну категорію комп’ютера.' }, { status: 400 })
  }
  if (!['available', 'occupied', 'maintenance', 'offline'].includes(status)) {
    return Response.json({ message: 'Оберіть коректний статус комп’ютера.' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config: configPromise })

    const existing = await payload.find({
      collection: 'computers',
      where: { computerNumber: { equals: computerNumber } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      return Response.json(
        { message: `Комп’ютер з номером ${computerNumber} вже існує.` },
        { status: 400 },
      )
    }

    const created = await payload.create({
      collection: 'computers',
      overrideAccess: true,
      data: {
        computerNumber,
        category: category as 'STANDART' | 'PRO' | 'VIP' | 'STREAMER',
        status: status as 'available' | 'occupied' | 'maintenance' | 'offline',
        manualOccupied: status === 'occupied',
        description,
      },
    })

    return Response.json({ doc: created, message: 'Комп’ютер успішно додано.' }, { status: 201 })
  } catch (err: unknown) {
    console.error('Admin computers POST error:', err)
    return Response.json(
      { message: 'Не вдалося додати комп’ютер.' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isSafeInteger(id) || id <= 0) {
    return Response.json({ message: 'Вкажіть ID комп’ютера.' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const computer = await payload.findByID({ collection: 'computers', id, overrideAccess: true }).catch(() => null)
    if (!computer) return Response.json({ message: 'Комп’ютер не знайдено.' }, { status: 404 })

    const bookings = await payload.find({
      collection: 'bookings',
      overrideAccess: true,
      limit: 1,
      where: { computer: { equals: computer.computerNumber } },
    })
    if (bookings.docs.length > 0) {
      return Response.json(
        { message: `Неможливо видалити ${computer.computerNumber}: з ним пов’язані бронювання. Спочатку скасуйте або перенесіть їх.` },
        { status: 409 },
      )
    }

    await payload.delete({ collection: 'computers', id, overrideAccess: true })
    return Response.json({ message: `Комп’ютер ${computer.computerNumber} видалено.` })
  } catch (err: unknown) {
    console.error('Admin computer DELETE error:', err)
    return Response.json({ message: 'Не вдалося видалити комп’ютер.' }, { status: 500 })
  }
}

