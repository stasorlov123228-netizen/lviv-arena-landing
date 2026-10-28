import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getPayload: vi.fn(), requireAdmin: vi.fn() }))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return { ...actual, getPayload: mocks.getPayload }
})
vi.mock('@/utilities/auth', () => ({ requireAdmin: mocks.requireAdmin }))

import { PATCH as patchBooking, DELETE as cancelBooking } from '@/app/api/admin/bookings/route'
import { PATCH as patchComputer } from '@/app/api/admin/computers/route'
import { PATCH as patchUser, DELETE as deleteUser } from '@/app/api/admin/users/route'

const existingBooking = {
  id: 5, name: 'Client', phone: '+380000000000', user: 2, tariff: 'DEFAULT',
  computerCategory: 'STANDART', computer: 'PC-01', date: '2026-11-06T00:00:00.000Z',
  time: '12:00', duration: 2, status: 'new', totalAmount: null,
}
const request = (url: string, method: string, body?: unknown) => new Request(url, {
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

const payload = {
  findByID: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

describe('administrative mutation routes (mocked Payload)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({ user: { id: 1, role: 'admin' } })
    mocks.getPayload.mockResolvedValue(payload)
    payload.findByID.mockImplementation(async ({ collection, id }: { collection: string; id: number }) => {
      if (collection === 'bookings') return { ...existingBooking }
      if (collection === 'computers') return { id, computerNumber: 'PC-01', category: 'STANDART', status: 'available' }
      if (collection === 'users') return { id, role: 'user', isBlocked: false }
      return null
    })
    payload.find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'computers') return { docs: [{ id: 8, computerNumber: 'PC-01', category: 'STANDART', status: 'available' }] }
      if (collection === 'tariffs') return { docs: [{ id: 1, name: 'PRO', computerCategory: 'PRO', pricePerHour: 120, isActive: true }] }
      return { docs: [], totalDocs: 0 }
    })
    payload.update.mockImplementation(async ({ id, data }: { id: number; data: Record<string, unknown> }) => ({ ...existingBooking, ...data, id }))
  })

  it('lets an administrator confirm a booking and persists the status', async () => {
    const response = await patchBooking(request('http://localhost/api/admin/bookings', 'PATCH', { id: 5, status: 'confirmed' }))
    expect(response.status).toBe(200)
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ id: 5, data: { status: 'confirmed' } }))
  })

  it('rejects invalid schedule values before update', async () => {
    const response = await patchBooking(request('http://localhost/api/admin/bookings', 'PATCH', { id: 5, duration: 4 }))
    expect(response.status).toBe(400)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('edits linked client, tariff, computer, and schedule fields without accepting a client-supplied total', async () => {
    payload.find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'computers') return { docs: [{ id: 31, computerNumber: 'PC-31', category: 'PRO', status: 'available' }] }
      if (collection === 'tariffs') return { docs: [{ id: 2, name: 'PRO', computerCategory: 'PRO', pricePerHour: 120, isActive: true }] }
      return { docs: [] }
    })
    const response = await patchBooking(request('http://localhost/api/admin/bookings', 'PATCH', {
      id: 5, user: 4, name: 'Updated Client', phone: '+380111111111', tariff: 'PRO',
      computer: 'PC-31', date: '2026-11-07', time: '13:00', duration: 2, totalAmount: 1,
    }))
    expect(response.status).toBe(200)
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      user: 4, name: 'Updated Client', tariff: 'PRO', computerCategory: 'PRO', computer: 'PC-31', duration: 2,
    }) }))
    expect(payload.update.mock.calls[0]?.[0].data).not.toHaveProperty('totalAmount')
  })

  it('returns a conflict response when Payload rejects an overlapping booking', async () => {
    payload.update.mockRejectedValueOnce(Object.assign(new Error('slot conflict'), { status: 409 }))
    const response = await patchBooking(request('http://localhost/api/admin/bookings', 'PATCH', { id: 5, status: 'confirmed' }))
    expect(response.status).toBe(409)
    expect((await response.json()).message).toContain('зайнятий')
  })

  it('cancels through the retained status rather than deleting the record', async () => {
    const response = await cancelBooking(request('http://localhost/api/admin/bookings?id=5', 'DELETE'))
    expect(response.status).toBe(200)
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ id: 5, data: { status: 'cancelled' } }))
    expect(payload.delete).not.toHaveBeenCalled()
  })

  it.each(['available', 'occupied', 'maintenance', 'offline'])('persists computer status %s', async (status) => {
    const response = await patchComputer(request('http://localhost/api/admin/computers', 'PATCH', { id: 8, status }))
    expect(response.status).toBe(200)
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'computers',
      id: 8,
      overrideAccess: true,
      data: { status, manualOccupied: status === 'occupied' },
    }))
  })

  it('blocks a user and prevents the administrator from blocking themself', async () => {
    const blocked = await patchUser(request('http://localhost/api/admin/users', 'PATCH', { id: 2, isBlocked: true }))
    expect(blocked.status).toBe(200)
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ id: 2, data: { isBlocked: true } }))

    payload.findByID.mockResolvedValueOnce({ id: 1, role: 'admin', isBlocked: false })
    const selfBlock = await patchUser(request('http://localhost/api/admin/users', 'PATCH', { id: 1, isBlocked: true }))
    expect(selfBlock.status).toBe(400)
  })

  it('prevents deleting the current administrator or blocking the last active administrator', async () => {
    payload.findByID.mockResolvedValueOnce({ id: 1, role: 'admin', isBlocked: false })
    const selfDelete = await deleteUser(request('http://localhost/api/admin/users?id=1', 'DELETE'))
    expect(selfDelete.status).toBe(400)
    expect(payload.delete).not.toHaveBeenCalled()

    payload.findByID.mockResolvedValueOnce({ id: 2, role: 'admin', isBlocked: false })
    payload.find.mockResolvedValueOnce({ docs: [{ id: 2, role: 'admin' }], totalDocs: 1 })
    const lastAdmin = await patchUser(request('http://localhost/api/admin/users', 'PATCH', { id: 2, isBlocked: true }))
    expect(lastAdmin.status).toBe(400)
    expect(payload.update).not.toHaveBeenCalledWith(expect.objectContaining({ id: 2, data: { isBlocked: true } }))
  })

  it('does not allow a non-administrator to mutate a booking', async () => {
    mocks.requireAdmin.mockResolvedValueOnce(Response.json({ message: 'forbidden' }, { status: 403 }))
    const response = await patchBooking(request('http://localhost/api/admin/bookings', 'PATCH', { id: 5, status: 'confirmed' }))
    expect(response.status).toBe(403)
    expect(mocks.getPayload).not.toHaveBeenCalled()
  })
})
