import { describe, expect, it } from 'vitest'
import { calculateBookingTotal, toMinorUnits } from '@/utilities/money'
import { Bookings } from '@/collections/Bookings'

describe('booking money arithmetic', () => {
  it('converts decimal prices to integer kopecks', () => {
    expect(toMinorUnits('120')).toBe(12000)
    expect(toMinorUnits('1.25')).toBe(125)
  })

  it('calculates PRO at 120 UAH per hour for two hours exactly', () => {
    expect(calculateBookingTotal('120.00', 2)).toBe(240)
  })

  it('handles fractional tariff prices without binary floating point multiplication', () => {
    expect(calculateBookingTotal('1.25', 3)).toBe(3.75)
  })

  it('rejects invalid price precision and duration', () => {
    expect(calculateBookingTotal('1.001', 2)).toBeNull()
    expect(calculateBookingTotal(120, 0)).toBeNull()
  })

  it('recalculates an edited booking from the stored active tariff rate', async () => {
    const hook = Bookings.hooks?.beforeChange?.[0] as (args: any) => Promise<Record<string, unknown>>
    const result = await hook({
      operation: 'update',
      data: { tariff: 'PRO', duration: 2, status: 'cancelled' },
      originalDoc: { id: 5, tariff: 'DEFAULT', duration: 1, status: 'cancelled', totalAmount: 80 },
      req: { payload: { find: async () => ({ docs: [{ pricePerHour: 120 }] }) } },
      context: {},
    })
    expect(result).toMatchObject({ tariff: 'PRO', duration: 2, totalAmount: 240, computerCategory: 'PRO' })
  })
})
