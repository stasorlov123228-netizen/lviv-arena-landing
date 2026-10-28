import { getPayload } from 'payload'
import { sql } from 'drizzle-orm'
import configPromise from '@payload-config'
import { createAuthCookieHeader } from '@/utilities/auth'

function getErrorCode(error: unknown): string | undefined {
  const visited = new Set<object>()
  let current: unknown = error
  while (typeof current === 'object' && current !== null && !visited.has(current)) {
    visited.add(current)
    if ('code' in current && typeof current.code === 'string') return current.code
    current = 'cause' in current ? current.cause : undefined
  }
  return undefined
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return Response.json({ message: 'Перевірте формат надісланих даних.' }, { status: 400 })
    }
    body = parsed as Record<string, unknown>
  } catch {
    return Response.json({ message: 'Не вдалося прочитати дані форми. Спробуйте ще раз.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''
  if (!name || name.length > 100) return Response.json({ message: 'Вкажіть ім’я завдовжки до 100 символів.' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return Response.json({ message: 'Введіть коректну адресу електронної пошти.' }, { status: 400 })
  if (password.length < 8) return Response.json({ message: 'Пароль має містити щонайменше 8 символів.' }, { status: 400 })
  if (password !== confirmPassword) return Response.json({ message: 'Паролі не збігаються.' }, { status: 400 })

  const duplicate = () => Response.json({ message: 'Цю адресу електронної пошти вже зареєстровано. Увійдіть або використайте іншу адресу.' }, { status: 409 })
  try {
    const payload = await getPayload({ config: configPromise })
    const existing = await payload.db.drizzle.execute(sql`
      SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1
    `)
    if (((existing as { rows?: unknown[] }).rows ?? []).length > 0) return duplicate()

    const newUser = await payload.create({
      collection: 'users', overrideAccess: true,
      data: { name, email, password, role: 'user', isBlocked: false, mustChangePassword: false },
    })
    let token: string | undefined
    try {
      const loginResult = await payload.login({ collection: 'users', data: { email, password } })
      token = loginResult.token ?? undefined
    } catch { token = undefined }
    const headers = new Headers({ 'Content-Type': 'application/json' })
    if (token) headers.append('Set-Cookie', createAuthCookieHeader(token))
    return new Response(JSON.stringify({
      message: token ? 'Акаунт створено. Ви увійшли до системи.' : 'Акаунт створено. Увійдіть, щоб продовжити.',
      authenticated: Boolean(token),
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    }), { status: 201, headers })
  } catch (error: unknown) {
    if (getErrorCode(error) === '23505') return duplicate()
    console.error('Registration failed:', { code: getErrorCode(error) ?? 'unknown' })
    return Response.json({ message: 'Не вдалося створити акаунт через тимчасову помилку. Спробуйте пізніше.' }, { status: 503 })
  }
}
