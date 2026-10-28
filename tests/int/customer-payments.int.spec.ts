import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { GET as getAvailability, POST as createBooking } from '@/app/api/bookings/route'
import { GET as myBookings } from '@/app/api/my/bookings/route'
import { patchMyBooking as editMyBooking, deleteMyBooking as cancelMyBooking } from '@/app/api/my/bookings/byId'
import { getMyBookingById } from '@/app/api/my/bookings/byId'

const suffix = randomUUID()
const userAEmail = `customer-a-${suffix}@example.com`
const userBEmail = `customer-b-${suffix}@example.com`
const password = `test-only-${suffix}!`
const label = `Isolated customer test ${suffix}`
let payload: Awaited<ReturnType<typeof getPayload>>
let ownerCookie = ''
let otherCookie = ''
let ownerId = 0
let bookingIds: number[] = []
let proTariffId: number | null = null
let originalProPrice: number | null = null
const uniqueDateOffset = 80 + Number.parseInt(suffix.slice(0, 8), 16) % 5000

function kyivTomorrow(days = 0) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' })
  const values = Object.fromEntries(formatter.formatToParts(new Date(Date.now() + (uniqueDateOffset + days) * 86400000)).map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function makeBooking(date: string, name = label) {
  return createBooking(new Request('http://localhost/api/bookings', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
    body: JSON.stringify({ name, phone: '+380501234567', tariff: 'PRO', computer: 'PC-36', date, time: '18:00', duration: 2 }),
  }))
}

describe('customer ownership and payment records on isolated PostgreSQL', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    const tariff = await payload.find({ collection: 'tariffs', where: { name: { equals: 'PRO' } }, limit: 1 })
    if (!tariff.docs[0]) throw new Error('The isolated catalog seed must include PRO tariff.')
    proTariffId = Number(tariff.docs[0].id)
    originalProPrice = typeof tariff.docs[0].pricePerHour === 'number' ? tariff.docs[0].pricePerHour : null
    await payload.update({ collection: 'tariffs', id: proTariffId, overrideAccess: true, data: { pricePerHour: 120, isActive: true } })
    const owner = await payload.create({ collection: 'users', overrideAccess: true, data: { name: 'Test Owner', email: userAEmail, password, role: 'user' } })
    await payload.create({ collection: 'users', overrideAccess: true, data: { name: 'Test Other', email: userBEmail, password, role: 'user' } })
    ownerId = owner.id
    ownerCookie = `payload-token=${(await payload.login({ collection: 'users', data: { email: userAEmail, password } })).token}`
    otherCookie = `payload-token=${(await payload.login({ collection: 'users', data: { email: userBEmail, password } })).token}`
  })

  afterAll(async () => {
    for (const id of bookingIds) {
      const payment = await payload.find({ collection: 'payments', where: { booking: { equals: id } }, limit: 1, overrideAccess: true }).catch(() => null)
      if (payment?.docs[0]?.status === 'paid') await payload.update({ collection: 'payments', id: payment.docs[0].id, overrideAccess: true, data: { status: 'unpaid' } }).catch(() => undefined)
      if (payment?.docs[0]) await payload.delete({ collection: 'payments', id: payment.docs[0].id, overrideAccess: true }).catch(() => undefined)
      await payload.delete({ collection: 'bookings', id, overrideAccess: true }).catch(() => undefined)
    }
    await payload.delete({ collection: 'users', where: { email: { in: [userAEmail, userBEmail] } }, overrideAccess: true }).catch(() => undefined)
    if (proTariffId !== null) {
      await payload.update({ collection: 'tariffs', id: proTariffId, overrideAccess: true, data: { pricePerHour: originalProPrice } }).catch(() => undefined)
    }
  })

  it('creates a database-backed booking and one-to-one payment at the tariff price', async () => {
    const response = await makeBooking(kyivTomorrow())
    expect(response.status, await response.clone().text()).toBe(201)
    const { doc } = await response.json()
    bookingIds.push(doc.id)
    expect(typeof doc.user === 'object' ? doc.user.id : doc.user).toBe(ownerId)
    expect(doc.totalAmount).toBe(240)
    const payments = await payload.find({ collection: 'payments', where: { booking: { equals: doc.id } }, limit: 2 })
    expect(payments.docs).toHaveLength(1)
    expect(payments.docs[0]).toMatchObject({ amount: 240, method: 'cash', status: 'unpaid', isPaid: false })
  })

  it('rejects missing fields, auto-assigns another computer, and updates availability from PostgreSQL', async () => {
    const date = kyivTomorrow()
    const missingFields = await createBooking(new Request('http://localhost/api/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ phone: '+380501234567', tariff: 'PRO', computer: 'PC-36', date, time: '18:00', duration: 2 }),
    }))
    expect(missingFields.status).toBe(400)

    const availability = await getAvailability(new Request(`http://localhost/api/bookings?tariff=PRO&date=${date}&time=18:00&duration=2`))
    expect(availability.status).toBe(200)
    const availableBody = await availability.json()
    expect(typeof availableBody.availableCount).toBe('number')
    expect(availableBody).not.toHaveProperty('computers')
    const previousBooking = await payload.findByID({ collection: 'bookings', id: bookingIds[0], overrideAccess: true })

    const overlap = await makeBooking(date, `${label} overlap`)
    expect(overlap.status, await overlap.clone().text()).toBe(201)
    const { doc } = await overlap.json()
    bookingIds.push(doc.id)
    expect(doc.computer).not.toBe(previousBooking.computer)

    const updatedAvailability = await getAvailability(new Request(`http://localhost/api/bookings?tariff=PRO&date=${date}&time=18:00&duration=2`))
    expect(updatedAvailability.status).toBe(200)
    expect((await updatedAvailability.json()).availableCount).toBe(availableBody.availableCount - 1)
  })

  it('restricts booking lists and details to their owner', async () => {
    const bookingId = bookingIds[0]
    const ownList = await myBookings(new Request('http://localhost/api/my/bookings', { headers: { Cookie: ownerCookie } }))
    expect((await ownList.json()).docs.map((doc: { id: number }) => doc.id)).toContain(bookingId)
    const otherList = await myBookings(new Request('http://localhost/api/my/bookings', { headers: { Cookie: otherCookie } }))
    expect((await otherList.json()).docs.map((doc: { id: number }) => doc.id)).not.toContain(bookingId)
    const ownDetail = await getMyBookingById(new Request('http://localhost/api/my/bookings/1', { headers: { Cookie: ownerCookie } }), String(bookingId))
    expect(ownDetail.status).toBe(200)
    const otherDetail = await getMyBookingById(new Request('http://localhost/api/my/bookings/1', { headers: { Cookie: otherCookie } }), String(bookingId))
    expect(otherDetail.status).toBe(404)
  })

  it('edits future unpaid booking and synchronizes its payment amount', async () => {
    const id = bookingIds[0]
    const response = await editMyBooking(new Request(`http://localhost/api/my/bookings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
      body: JSON.stringify({ date: kyivTomorrow(2), time: '19:00', duration: 3, paymentStatus: 'paid' }),
    }), String(id))
    expect(response.status).toBe(200)
    const updated = await payload.findByID({ collection: 'bookings', id, overrideAccess: true })
    expect(updated.totalAmount).toBe(360)
    expect(updated.paymentStatus).toBe('unpaid')
    const payment = await payload.find({ collection: 'payments', where: { booking: { equals: id } }, limit: 1 })
    expect(payment.docs[0].amount).toBe(360)
  })

  it('canceled booking no longer blocks its slot and paid booking cannot be edited or canceled', async () => {
    const firstId = bookingIds[0]
    const canceled = await cancelMyBooking(new Request(`http://localhost/api/my/bookings/${firstId}`, { method: 'DELETE', headers: { Cookie: ownerCookie } }), String(firstId))
    expect(canceled.status).toBe(200)
    const replacement = await makeBooking(kyivTomorrow(2), `${label} replacement`)
    expect(replacement.status).toBe(201)
    const replacementDoc = (await replacement.json()).doc
    bookingIds.push(replacementDoc.id)
    const payment = await payload.find({ collection: 'payments', where: { booking: { equals: replacementDoc.id } }, limit: 1 })
    await payload.update({ collection: 'payments', id: payment.docs[0].id, overrideAccess: true, data: { status: 'paid' } })
    const edit = await editMyBooking(new Request(`http://localhost/api/my/bookings/${replacementDoc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: ownerCookie }, body: JSON.stringify({ duration: 1 }) }), String(replacementDoc.id))
    const cancel = await cancelMyBooking(new Request(`http://localhost/api/my/bookings/${replacementDoc.id}`, { method: 'DELETE', headers: { Cookie: ownerCookie } }), String(replacementDoc.id))
    expect(edit.status).toBe(409)
    expect(cancel.status).toBe(409)
    expect((await payload.findByID({ collection: 'bookings', id: replacementDoc.id, overrideAccess: true })).paymentStatus).toBe('paid')
  })
})
