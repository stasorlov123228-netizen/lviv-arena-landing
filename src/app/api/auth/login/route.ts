import { getPayload } from 'payload'
import { sql } from 'drizzle-orm'
import configPromise from '@payload-config'
import {
  checkLoginRateLimit,
  createAuthCookieHeader,
  resetLoginRateLimit,
} from '@/utilities/auth'

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'

  if (!checkLoginRateLimit(ip)) {
    return Response.json(
      { message: 'Забагато спроб входу. Зачекайте 1 хвилину перед повторною спробою.' },
      { status: 429 },
    )
  }

  let parsedBody: unknown

  try {
    parsedBody = await request.json()
  } catch {
    return Response.json(
      { message: 'Некоректний формат запиту.' },
      { status: 400 },
    )
  }

  if (typeof parsedBody !== 'object' || parsedBody === null || Array.isArray(parsedBody)) {
    return Response.json(
      { message: 'Request body must be a JSON object.' },
      { status: 400 },
    )
  }

  const body = parsedBody as Record<string, unknown>

  const loginInput = typeof body.login === 'string' ? body.login.trim() : typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!loginInput || !password) {
    return Response.json(
      { message: 'Введіть логін (або email) та пароль.' },
      { status: 400 },
    )
  }

  try {
    const payload = await getPayload({ config: configPromise })

    let targetEmail = loginInput.toLowerCase()

    if (loginInput.toLowerCase() === 'admin') {
      const adminUsers = await payload.db.drizzle.execute(sql`
        SELECT email, is_blocked
        FROM users
        WHERE lower(name) = 'admin' OR lower(email) = 'admin@lviv-arena.ua'
        ORDER BY CASE WHEN lower(name) = 'admin' THEN 0 ELSE 1 END
        LIMIT 1
      `)
      const adminRows = (adminUsers as unknown as { rows?: Array<{ email: string; is_blocked: boolean | null }> }).rows ?? []
      if (adminRows[0]?.is_blocked) {
        return Response.json({ message: 'Обліковий запис заблоковано. Зверніться до адміністратора клубу.' }, { status: 403 })
      }
      if (adminRows[0]?.email) targetEmail = adminRows[0].email
    }

    let loginResult
    try {
      loginResult = await payload.login({
        collection: 'users',
        data: {
          email: targetEmail,
          password,
        },
      })
    } catch {
      return Response.json(
        { message: 'Невірний логін або пароль.' },
        { status: 401 },
      )
    }

    if (!loginResult || !loginResult.user || !loginResult.token) {
      return Response.json(
        { message: 'Невірний логін або пароль.' },
        { status: 401 },
      )
    }

    const blockStatus = await payload.db.drizzle.execute(sql`
      SELECT is_blocked FROM users WHERE id = ${Number(loginResult.user.id)} LIMIT 1
    `)
    const blockRows = (blockStatus as unknown as { rows?: Array<{ is_blocked: boolean | null }> }).rows ?? []
    if (blockRows[0]?.is_blocked) {
      return Response.json({ message: 'Обліковий запис заблоковано. Зверніться до адміністратора клубу.' }, { status: 403 })
    }

    resetLoginRateLimit(ip)

    const cookieHeader = createAuthCookieHeader(loginResult.token)
    const headers = new Headers({
      'Content-Type': 'application/json',
    })
    headers.append('Set-Cookie', cookieHeader)

    const u = loginResult.user

    return new Response(
      JSON.stringify({
        message: 'Успішний вхід!',
        user: {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
        },
        mustChangePassword: Boolean(u.mustChangePassword),
      }),
      { status: 200, headers },
    )
  } catch (err: unknown) {
    console.error('Login service failed')
    return Response.json(
      { message: 'Помилка сервера під час авторизації.' },
      { status: 500 },
    )
  }
}

