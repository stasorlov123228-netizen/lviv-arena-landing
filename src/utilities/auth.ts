import { getPayload } from 'payload'
import { sql } from 'drizzle-orm'
import configPromise from '@payload-config'

export interface AuthenticatedUser {
  id: number | string
  email: string
  name?: string | null
  phone?: string | null
  role: 'user' | 'admin'
  isBlocked?: boolean | null
  mustChangePassword?: boolean | null
}

export const AUTH_COOKIE_NAME = 'payload-token'

export async function getCurrentUser(request: Request): Promise<AuthenticatedUser | null> {
  try {
    const payload = await getPayload({ config: configPromise })
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) return null

    const result = await payload.db.drizzle.execute(sql`
      SELECT id, email, name, phone, role, is_blocked, must_change_password
      FROM users
      WHERE id = ${Number(user.id)}
      LIMIT 1
    `)
    const rows = (result as unknown as { rows?: Array<{
      id: number
      email: string
      name: string | null
      phone: string | null
      role: string | null
      is_blocked: boolean | null
      must_change_password: boolean | null
    }> }).rows ?? []
    const current = rows[0]
    if (!current || current.is_blocked) return null

    return {
      id: current.id,
      email: current.email,
      name: current.name,
      phone: current.phone,
      role: current.role === 'admin' ? 'admin' : 'user',
      isBlocked: current.is_blocked,
      mustChangePassword: current.must_change_password,
    }
  } catch {
    console.error('Current user lookup failed')
    return null
  }
}

export async function requireAdmin(
  request: Request,
): Promise<{ user: AuthenticatedUser } | Response> {
  const user = await getCurrentUser(request)

  if (!user) {
    return Response.json(
      { message: 'Необхідна авторизація.' },
      { status: 401 },
    )
  }

  if (user.role !== 'admin') {
    return Response.json(
      { message: 'Доступ заборонено. Потрібні права адміністратора.' },
      { status: 403 },
    )
  }

  return { user }
}

export function createAuthCookieHeader(token: string): string {
  const isProd = process.env.NODE_ENV === 'production'
  const maxAge = 14 * 24 * 60 * 60
  return `${AUTH_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`
}

export function clearAuthCookieHeader(): string {
  const isProd = process.env.NODE_ENV === 'production'
  return `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`
}

const loginAttempts = new Map<string, { count: number; resetTime: number }>()

export function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (!entry || now > entry.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + 60 * 1000 })
    return true
  }

  if (entry.count >= 5) {
    return false
  }

  entry.count += 1
  return true
}

export function resetLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip)
}

