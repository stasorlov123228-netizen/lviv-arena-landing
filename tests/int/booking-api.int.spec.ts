import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => {
  const payload = await importOriginal<typeof import('payload')>()
  return { ...payload, getPayload: vi.fn() }
})
vi.mock('@/utilities/auth', () => ({ getCurrentUser: vi.fn(async () => null) }))

import { GET, POST } from '@/app/api/bookings/route'
import { getPayload } from 'payload'
import { getBookingRange, isValidBookingDuration } from '@/utilities/booking'

const payload = {
  create: vi.fn(),
  find: vi.fn(),
}

const request = (url: string) => new Request(url)

const bookingRequest = (data: Record<string, unknown>) =>
  new Request('http://localhost/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

const validBooking = {
  name: 'Олена',
  email: 'olena@example.com',
  phone: '+380000000000',
  tariff: 'DEFAULT',
  date: '2026-10-20',
  time: '12:00',
  duration: 2,
}

describe('booking API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T08:00:00.000Z'))
    vi.mocked(getPayload).mockResolvedValue(payload as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the supported booking durations and interprets selected times in Kyiv', () => {
    expect([1, 2, 3, 5, 8].every(isValidBookingDuration)).toBe(true)
    expect([0, 4, 24].some(isValidBookingDuration)).toBe(false)
    expect(getBookingRange('2026-01-15', '12:00', 2)?.start).toBe(
      Date.parse('2026-01-15T10:00:00.000Z'),
    )
    expect(getBookingRange('2026-07-15', '12:00', 2)?.start).toBe(
      Date.parse('2026-07-15T09:00:00.000Z'),
    )
  })

  it('returns only an availability count without exposing computer numbers', async () => {
    payload.find
      .mockResolvedValueOnce({ docs: [{ name: 'DEFAULT', computerCategory: 'STANDART', isActive: true }] })
      .mockResolvedValueOnce({ docs: [
        { computerNumber: 'PC-01' }, { computerNumber: 'PC-02' }, { computerNumber: 'PC-03' },
      ] })
      .mockResolvedValueOnce({ docs: [
        {
          computer: 'PC-01',
          date: '2026-10-20T00:00:00.000Z',
          time: '13:30',
          duration: 1,
        },
        {
          computer: 'PC-02',
          date: '2026-10-20T00:00:00.000Z',
          time: '10:00',
          duration: 2,
        },
        {
          computer: 'PC-03',
          date: '2026-10-19T00:00:00.000Z',
          time: '23:00',
          duration: 24,
        },
      ] })

    const response = await GET(
      request(
        'http://localhost/api/bookings?tariff=DEFAULT&date=2026-10-20&time=12%3A00&duration=2',
      ),
    )
    const body = (await response.json()) as { category: string; availableCount: number }

    expect(response.status).toBe(200)
    expect(body.category).toBe('STANDART')
    expect(body.availableCount).toBe(1)
    expect(body).not.toHaveProperty('computers')
  })

  it('uses the matching computer range for PRO, VIP, and STREAM tariffs', async () => {
    payload.find.mockImplementation(async (args: any) => {
      if (args.collection === 'tariffs') return { docs: [{ name: args.where.and[0].name.equals, computerCategory: args.where.and[2].computerCategory.equals, isActive: true }] }
      if (args.collection === 'computers') return { docs: [{ computerNumber: 'DB-PC-1' }] }
      return { docs: [] }
    })

    for (const [tariff, category, count] of [
      ['PRO', 'PRO', 1],
      ['VIP', 'VIP', 1],
      ['STREAM', 'STREAMER', 1],
    ] as const) {
      const response = await GET(
        request(
          `http://localhost/api/bookings?tariff=${tariff}&date=2026-10-20&time=12%3A00&duration=2`,
        ),
      )
      const body = (await response.json()) as { category: string; availableCount: number }

      expect(response.status).toBe(200)
      expect(body.category).toBe(category)
      expect(body.availableCount).toBe(count)
      expect(body).not.toHaveProperty('computers')
    }
  })

  it('creates a booking with its category derived from the tariff', async () => {
    payload.find
      .mockResolvedValueOnce({ docs: [{ name: 'STREAM', computerCategory: 'STREAMER', isActive: true, pricePerHour: 80 }] })
      .mockResolvedValueOnce({ docs: [{ computerNumber: 'PC-63', category: 'STREAMER', status: 'available', manualOccupied: false }] })
      .mockResolvedValueOnce({ docs: [] })
    payload.create.mockResolvedValueOnce({ id: 42, ...validBooking, computerCategory: 'STREAMER' })

    const response = await POST(
      bookingRequest({
        ...validBooking,
        tariff: 'STREAM',
        computer: 'PC-63',
      computerCategory: 'VIP',
      }),
    )
    const body = (await response.json()) as { doc: { id: number } }

    expect(response.status).toBe(201)
    expect(body.doc.id).toBe(42)
    expect(payload.create.mock.calls[0]?.[0].data).toMatchObject({
      tariff: 'STREAM',
      computerCategory: 'STREAMER',
      computer: 'PC-63',
      totalAmount: 160,
    })
  })

  it.each([
    ['DEFAULT', 'STANDART', 'PC-01', 80],
    ['PRO', 'PRO', 'PC-31', 120],
    ['VIP', 'VIP', 'PC-51', 150],
    ['STREAM', 'STREAMER', 'PC-63', 140],
  ] as const)('calculates %s booking cost using its hourly tariff price', async (tariff, category, computer, price) => {
    payload.find.mockImplementation(async (args: any) => {
      if (args.collection === 'tariffs') return { docs: [{ name: tariff, computerCategory: category, isActive: true, pricePerHour: price }] }
      if (args.collection === 'computers') return { docs: [{ computerNumber: computer, category, status: 'available', manualOccupied: false }] }
      return { docs: [] }
    })
    payload.create.mockResolvedValueOnce({ id: 43 })

    const response = await POST(bookingRequest({ ...validBooking, tariff, computer }))

    expect(response.status).toBe(201)
    expect(payload.create.mock.calls[0]?.[0].data).toMatchObject({
      tariff,
      computerCategory: category,
      totalAmount: price * 2,
    })
  })

  it('assigns a free computer from the tariff category regardless of a submitted number', async () => {
    payload.find
      .mockResolvedValueOnce({ docs: [{ name: 'PRO', computerCategory: 'PRO', isActive: true, pricePerHour: 80 }] })
      .mockResolvedValueOnce({ docs: [{ computerNumber: 'PC-31', category: 'PRO', status: 'available', manualOccupied: false }] })
      .mockResolvedValueOnce({ docs: [] })
    const response = await POST(
      bookingRequest({ ...validBooking, tariff: 'PRO', computer: 'PC-01' }),
    )

    expect(response.status).toBe(201)
    expect(payload.create.mock.calls[0]?.[0].data.computer).toBe('PC-31')
  })

  it('ignores a client submitted total and calculates PRO at 120 UAH per hour for two hours as 240 UAH', async () => {
    payload.find.mockImplementation(async (args: any) => {
      if (args.collection === 'tariffs') return { docs: [{ name: 'PRO', computerCategory: 'PRO', isActive: true, pricePerHour: 120 }] }
      if (args.collection === 'computers') return { docs: [{ computerNumber: 'PC-31', category: 'PRO', status: 'available', manualOccupied: false }] }
      return { docs: [] }
    })
    payload.create.mockResolvedValueOnce({ id: 44 })

    const response = await POST(bookingRequest({ ...validBooking, tariff: 'PRO', computer: 'PC-31', totalAmount: 1 }))

    expect(response.status).toBe(201)
    expect(payload.create.mock.calls[0]?.[0].data.totalAmount).toBe(240)
  })

  it('returns HTTP 409 when a concurrent booking conflicts', async () => {
    const postgresError = Object.assign(new Error('internal database detail'), {
      code: '23P01',
      constraint: 'bookings_no_overlapping_computer',
    })
    payload.create.mockRejectedValue(Object.assign(new Error('database conflict'), {
      cause: postgresError,
    }))

    payload.find
      .mockResolvedValueOnce({ docs: [{ name: 'DEFAULT', computerCategory: 'STANDART', isActive: true, pricePerHour: 80 }] })
      .mockResolvedValueOnce({ docs: [{ computerNumber: 'PC-01', category: 'STANDART', status: 'available', manualOccupied: false }] })
      .mockResolvedValueOnce({ docs: [] })
    const response = await POST(bookingRequest(validBooking))
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(JSON.stringify(body)).toContain('зайняли')
    expect(JSON.stringify(body)).not.toContain('internal database detail')
  })

  it('rejects malformed availability parameters', async () => {
    const response = await GET(
      request(
        'http://localhost/api/bookings?tariff=DEFAULT&date=2026-02-30&time=12%3A00&duration=2',
      ),
    )

    expect(response.status).toBe(400)
    expect(payload.find).not.toHaveBeenCalled()
  })
})
