import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/utilities/auth'
import { getBookingRange, isValidBookingDate, isValidBookingDuration, isValidBookingTime } from '@/utilities/booking'

const json = (message: string, status: number) => Response.json({ message }, { status })

export async function getMyBookingById(request: Request, id: string) {
  const user = await getCurrentUser(request)
  if (!user) return Response.json({ message: 'Увійдіть, щоб переглянути бронювання.' }, { status: 401 })
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'bookings', overrideAccess: true, depth: 0, limit: 1,
    where: { and: [{ id: { equals: Number(id) } }, { user: { equals: Number(user.id) } }] },
  })
  if (!result.docs[0]) return Response.json({ message: 'Бронювання не знайдено.' }, { status: 404 })
  return Response.json({ doc: result.docs[0] })
}

export async function patchMyBooking(request: Request, id: string) {
  const user = await getCurrentUser(request)
  if (!user) return json('Увійдіть, щоб змінити бронювання.', 401)
  const payload = await getPayload({ config })
  const existing = await payload.findByID({ collection: 'bookings', id: Number(id), overrideAccess: true }).catch(() => null)
  const ownerId = existing?.user && typeof existing.user === 'object' ? existing.user.id : existing?.user
  if (!existing || String(ownerId) !== String(user.id)) return json('Бронювання не знайдено.', 404)
  if (existing.paymentStatus === 'paid' || existing.status === 'cancelled') return json('Це бронювання не можна змінити.', 409)
  const start = existing.bookingStart ? new Date(existing.bookingStart).getTime() : getBookingRange(existing.date, existing.time, Number(existing.duration))?.start
  if (!start || start <= Date.now()) return json('Минуле бронювання не можна змінити.', 409)
  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> } catch { return json('Некоректний JSON.', 400) }
  const date = typeof body.date === 'string' ? body.date : existing.date.slice(0, 10)
  const time = typeof body.time === 'string' ? body.time : existing.time
  const duration = body.duration === undefined ? Number(existing.duration) : Number(body.duration)
  if (!isValidBookingDate(date) || !isValidBookingTime(time) || !isValidBookingDuration(String(duration))) return json('Перевірте дату, час і тривалість (1, 2, 3, 5 або 8 годин).', 400)
  const range = getBookingRange(date, time, duration)
  if (!range || range.start <= Date.now()) return json('Бронювання має починатися в майбутньому.', 400)
  const tariff = await payload.find({ collection: 'tariffs', overrideAccess: true, limit: 1, where: { and: [{ name: { equals: existing.tariff } }, { isActive: { equals: true } }] } })
  const price = tariff.docs[0]?.pricePerHour
  if (typeof price !== 'number') return json('Ціну тарифу ще не налаштовано. Зверніться до адміністратора.', 409)
  const updated = await payload.update({ collection: 'bookings', id: Number(id), overrideAccess: true, data: { date: `${date}T00:00:00.000Z`, time, duration, totalAmount: price * duration } })
  return Response.json({ doc: updated })
}


export async function deleteMyBooking(request: Request, id: string) {
  const user = await getCurrentUser(request)
  if (!user) return json('Увійдіть, щоб скасувати бронювання.', 401)
  const payload = await getPayload({ config })
  const existing = await payload.findByID({ collection: 'bookings', id: Number(id), overrideAccess: true }).catch(() => null)
  const ownerId = existing?.user && typeof existing.user === 'object' ? existing.user.id : existing?.user
  if (!existing || String(ownerId) !== String(user.id)) return json('Бронювання не знайдено.', 404)
  if (existing.paymentStatus === 'paid') return json('Оплачене бронювання не можна скасувати.', 409)
  if (existing.paymentMethod === 'card') return json('Скасування бронювання з методом «картка» доступне через адміністратора.', 409)
  const start = existing.bookingStart ? new Date(existing.bookingStart).getTime() : getBookingRange(existing.date, existing.time, Number(existing.duration))?.start
  if (!start || start <= Date.now()) return json('Бронювання можна скасувати лише до початку.', 409)
  const doc = await payload.update({ collection: 'bookings', id: Number(id), overrideAccess: true, data: { status: 'cancelled' } })
  return Response.json({ doc, message: 'Бронювання скасовано.' })
}
