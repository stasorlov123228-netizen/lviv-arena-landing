import { getPayload } from 'payload'
import { sql } from 'drizzle-orm'
import config from '@payload-config'
import { getCurrentUser } from '@/utilities/auth'

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  const visited = new Set<object>()
  while (typeof current === 'object' && current !== null && !visited.has(current)) {
    visited.add(current)
    if ('code' in current && current.code === '23505') return true
    current = 'cause' in current ? current.cause : undefined
  }
  return false
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request)
  if (!user) return Response.json({ message: 'Увійдіть до акаунта.' }, { status: 401 })
  const payload = await getPayload({ config })
  const doc = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true })
  return Response.json({ profile: { name: doc.name, email: doc.email, phone: doc.phone ?? '' } })
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser(request)
  if (!user) return Response.json({ message: 'Увійдіть до акаунта.' }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> } catch { return Response.json({ message: 'Некоректний JSON.' }, { status: 400 }) }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ message: 'Перевірте правильність email.' }, { status: 400 })
  if (!/^\+380\d{9}$/.test(phone)) return Response.json({ message: 'Введіть номер у форматі +380 і 9 цифр, наприклад +380501234567.' }, { status: 400 })
  const payload = await getPayload({ config })
  const duplicate = () => Response.json({ message: 'Цей email уже зареєстрований іншим користувачем. Вкажіть іншу адресу.' }, { status: 409 })
  const phoneInUse = () => Response.json({ message: 'Цей номер телефону вже прив’язаний до іншого акаунта. Вкажіть інший номер.' }, { status: 409 })
  const existing = await payload.db.drizzle.execute(sql`
    SELECT id FROM users WHERE lower(email) = ${email} AND id <> ${user.id} LIMIT 1
  `)
  if (((existing as { rows?: unknown[] }).rows ?? []).length > 0) return duplicate()
  const existingPhone = await payload.db.drizzle.execute(sql`
    SELECT id FROM users WHERE phone = ${phone} AND id <> ${user.id} LIMIT 1
  `)
  if (((existingPhone as { rows?: unknown[] }).rows ?? []).length > 0) return phoneInUse()
  try {
    const doc = await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { email, phone } })
    return Response.json({ profile: { name: doc.name, email: doc.email, phone: doc.phone ?? '' } })
  } catch (error) {
    if (isUniqueViolation(error)) return duplicate()
    throw error
  }
}
