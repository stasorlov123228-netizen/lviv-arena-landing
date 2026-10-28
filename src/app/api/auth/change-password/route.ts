import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCurrentUser } from '@/utilities/auth'

export async function POST(request: Request) {
  const user = await getCurrentUser(request)

  if (!user) {
    return Response.json(
      { message: 'Необхідна авторизація.' },
      { status: 401 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return Response.json(
      { message: 'Некоректний формат запиту.' },
      { status: 400 },
    )
  }

  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

  if (newPassword === 'admin') {
    return Response.json(
      { message: 'Пароль "admin" використовувати заборонено. Оберіть надійніший пароль.' },
      { status: 400 },
    )
  }

  if (!newPassword || newPassword.length < 8) {
    return Response.json(
      { message: 'Новий пароль повинен містити щонайменше 8 символів.' },
      { status: 400 },
    )
  }

  if (newPassword !== confirmPassword) {
    return Response.json(
      { message: 'Паролі не співпадають.' },
      { status: 400 },
    )
  }

  try {
    const payload = await getPayload({ config: configPromise })

    await payload.update({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      data: {
        password: newPassword,
        mustChangePassword: false,
      },
    })

    return Response.json(
      { message: 'Пароль успішно змінено!' },
      { status: 200 },
    )
  } catch (err: unknown) {
    console.error('Change password error:', err)
    return Response.json(
      { message: 'Не вдалося змінити пароль.' },
      { status: 500 },
    )
  }
}

