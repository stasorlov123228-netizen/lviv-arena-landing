import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireAdmin } from '@/utilities/auth'

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  try {
    const payload = await getPayload({ config: configPromise })

    const tariffs = await payload.find({
      collection: 'tariffs',
      overrideAccess: true,
      pagination: false,
      limit: 1000,
      sort: 'id',
    })

    return Response.json({
      docs: tariffs.docs,
      totalDocs: tariffs.totalDocs,
    })
  } catch (err: unknown) {
    console.error('Admin tariffs GET error:', err)
    return Response.json(
      { message: 'Не вдалося завантажити тарифи.' },
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

  const id = body.id
  if (!id) {
    return Response.json({ message: 'Вкажіть ID тарифу.' }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })

  try {
    const existing = await payload.findByID({
      collection: 'tariffs',
      id: Number(id),
      overrideAccess: true,
    })

    if (!existing) {
      return Response.json({ message: 'Тариф не знайдено.' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (typeof body.title === 'string') {
      updateData.title = body.title.trim()
    }

    if (typeof body.description === 'string') {
      updateData.description = body.description.trim()
    }

    if (body.pricePerHour !== undefined) {
      if (body.pricePerHour === null || body.pricePerHour === '') {
        updateData.pricePerHour = null
      } else {
        const num = Number(body.pricePerHour)
        if (!Number.isFinite(num) || num < 0) {
          return Response.json({ message: 'Ціна повинна бути невід’ємним числом.' }, { status: 400 })
        }
        updateData.pricePerHour = num
      }
    }

    if (typeof body.isActive === 'boolean') {
      updateData.isActive = body.isActive
    }

    if (typeof body.computerCategory === 'string') {
      if (!['STANDART', 'PRO', 'VIP', 'STREAMER'].includes(body.computerCategory)) {
        return Response.json({ message: 'Неприпустима категорія комп’ютерів.' }, { status: 400 })
      }
      updateData.computerCategory = body.computerCategory
    }

    const updated = await payload.update({
      collection: 'tariffs',
      id: Number(id),
      overrideAccess: true,
      data: updateData,
    })

    return Response.json({ doc: updated, message: 'Тариф успішно оновлено.' })
  } catch (err: unknown) {
    console.error('Admin tariffs PATCH error:', err)
    return Response.json(
      { message: 'Не вдалося оновити тариф.' },
      { status: 500 },
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

  const name = typeof body.name === 'string' ? body.name.trim().toUpperCase() : ''
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const computerCategory = typeof body.computerCategory === 'string' ? body.computerCategory.trim() : ''
  const hasPrice = body.pricePerHour !== undefined && body.pricePerHour !== null && body.pricePerHour !== ''
  const pricePerHour = hasPrice ? Number(body.pricePerHour) : undefined
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : true

  if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(name)) {
    return Response.json(
      { message: 'Код має містити від 1 до 40 латинських літер, цифр, дефісів або підкреслень.' },
      { status: 400 },
    )
  }

  if (!name || !title || !computerCategory) {
    return Response.json(
      { message: 'Вкажіть код тарифу, заголовок та категорію комп’ютерів.' },
      { status: 400 },
    )
  }

  if (hasPrice && (!Number.isFinite(pricePerHour) || pricePerHour! < 0)) {
    return Response.json(
      { message: 'Ціна повинна бути невід’ємним числом.' },
      { status: 400 },
    )
  }

  try {
    const payload = await getPayload({ config: configPromise })

    const existing = await payload.find({
      collection: 'tariffs',
      where: { name: { equals: name } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      return Response.json(
        { message: `Тариф з назвою ${name} вже існує.` },
        { status: 409 },
      )
    }

    const created = await payload.create({
      collection: 'tariffs',
      overrideAccess: true,
      data: {
        name,
        title,
        description,
        computerCategory: computerCategory as 'STANDART' | 'PRO' | 'VIP' | 'STREAMER',
        ...(hasPrice ? { pricePerHour } : {}),
        isActive,
      },
    })

    return Response.json({ doc: created, message: 'Тариф успішно додано.' }, { status: 201 })
  } catch (err: unknown) {
    console.error('Admin tariffs POST error:', err)
    return Response.json(
      { message: 'Не вдалося додати тариф.' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isSafeInteger(id) || id <= 0) {
    return Response.json({ message: 'Вкажіть ID тарифу.' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config: configPromise })
    const tariff = await payload.findByID({ collection: 'tariffs', id, overrideAccess: true }).catch(() => null)
    if (!tariff) return Response.json({ message: 'Тариф не знайдено.' }, { status: 404 })

    const bookings = await payload.find({
      collection: 'bookings',
      overrideAccess: true,
      limit: 1,
      where: { tariff: { equals: tariff.name } },
    })
    if (bookings.docs.length > 0) {
      return Response.json(
        { message: `Не можна видалити тариф ${tariff.name}: з ним пов’язані бронювання.` },
        { status: 409 },
      )
    }

    await payload.delete({ collection: 'tariffs', id, overrideAccess: true })
    return Response.json({ message: `Тариф ${tariff.name} видалено.` })
  } catch (error) {
    console.error('Admin tariff DELETE error:', error)
    return Response.json({ message: 'Не вдалося видалити тариф.' }, { status: 500 })
  }
}

