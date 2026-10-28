import { getPayload, type Where } from 'payload'
import configPromise from '@payload-config'
import { requireAdmin } from '@/utilities/auth'

export async function GET(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  const search = url.searchParams.get('search')?.trim() || ''

  try {
    const payload = await getPayload({ config: configPromise })

    const whereConditions: Where[] = []

    if (search) {
      whereConditions.push({
        or: [
          { name: { like: search } },
          { email: { like: search } },
        ],
      })
    }

    const users = await payload.find({
      collection: 'users',
      overrideAccess: true,
      limit: 100,
      sort: '-createdAt',
      where: (whereConditions.length > 0 ? { and: whereConditions } : {}) as Where,
    })

    const safeDocs = users.docs.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isBlocked: Boolean(u.isBlocked),
      mustChangePassword: Boolean(u.mustChangePassword),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }))

    return Response.json({
      docs: safeDocs,
      totalDocs: users.totalDocs,
    })
  } catch (err: unknown) {
    console.error('Admin users GET error:', err)
    return Response.json(
      { message: 'Не вдалося завантажити список користувачів.' },
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
    return Response.json({ message: 'Вкажіть ID користувача.' }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })

  try {
    const existing = await payload.findByID({
      collection: 'users',
      id,
      overrideAccess: true,
    })

    if (!existing) {
      return Response.json({ message: 'Користувача не знайдено.' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (body.isBlocked === true && String(auth.user.id) === String(existing.id)) {
      return Response.json({ message: 'Не можна заблокувати власний обліковий запис адміністратора.' }, { status: 400 })
    }

    if (typeof body.role === 'string') {
      if (!['user', 'admin'].includes(body.role)) {
        return Response.json({ message: 'Неприпустима роль.' }, { status: 400 })
      }

      if (existing.role === 'admin' && body.role === 'user') {
        const admins = await payload.find({
          collection: 'users',
          where: {
            and: [
              { role: { equals: 'admin' } },
              { isBlocked: { not_equals: true } },
            ],
          },
          limit: 2,
        })

        if (admins.totalDocs <= 1) {
          return Response.json(
            { message: 'Неможливо змінити роль: це останній активний адміністратор системи.' },
            { status: 400 },
          )
        }
      }

      updateData.role = body.role
    }

    if (typeof body.isBlocked === 'boolean') {

      if (existing.role === 'admin' && body.isBlocked === true) {
        const admins = await payload.find({
          collection: 'users',
          where: {
            and: [
              { role: { equals: 'admin' } },
              { isBlocked: { not_equals: true } },
            ],
          },
          limit: 2,
        })

        if (admins.totalDocs <= 1) {
          return Response.json(
            { message: 'Неможливо заблокувати останнього активного адміністратора.' },
            { status: 400 },
          )
        }
      }

      updateData.isBlocked = body.isBlocked
    }

    if (typeof body.name === 'string') {
      updateData.name = body.name.trim()
    }

    const updated = await payload.update({
      collection: 'users',
      id,
      overrideAccess: true,
      data: updateData,
    })

    return Response.json({
      message: 'Дані користувача оновлено.',
      doc: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        isBlocked: updated.isBlocked,
      },
    })
  } catch (err: unknown) {
    console.error('Admin users PATCH error:', err)
    return Response.json(
      { message: 'Не вдалося оновити дані користувача.' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id'))

  if (!Number.isSafeInteger(id) || id <= 0) {
    return Response.json({ message: 'Вкажіть ID користувача.' }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })

  try {
    const existing = await payload.findByID({
      collection: 'users',
      id,
      overrideAccess: true,
    })

    if (!existing) {
      return Response.json({ message: 'Користувача не знайдено.' }, { status: 404 })
    }

    if (String(auth.user.id) === String(existing.id)) {
      return Response.json({ message: 'Не можна видалити власний обліковий запис адміністратора.' }, { status: 400 })
    }

    if (existing.role === 'admin') {
      const admins = await payload.find({
        collection: 'users',
        where: {
          and: [
            { role: { equals: 'admin' } },
            { isBlocked: { not_equals: true } },
          ],
        },
        limit: 2,
      })

      if (admins.totalDocs <= 1) {
        return Response.json(
          { message: 'Неможливо видалити останнього активного адміністратора системи.' },
          { status: 400 },
        )
      }
    }

    await payload.delete({
      collection: 'users',
      id,
      overrideAccess: true,
    })

    return Response.json({ message: 'Користувача успішно видалено.' })
  } catch (err: unknown) {
    console.error('Admin users DELETE error:', err)
    return Response.json(
      { message: 'Не вдалося видалити користувача.' },
      { status: 500 },
    )
  }
}

