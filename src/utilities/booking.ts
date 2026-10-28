import type { Booking } from '@/payload-types'

export type BookingTariff = Booking['tariff']
export type BookingCategory = NonNullable<Booking['computerCategory']>
export type BookingComputer = string

export const isBookingTariff = (value: unknown): value is BookingTariff =>
  typeof value === 'string' && /^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(value)

export const isBookingCategory = (value: unknown): value is BookingCategory =>
  ['STANDART', 'PRO', 'VIP', 'STREAMER'].includes(String(value))

export const isComputerInCategory = (
  _category: BookingCategory,
  value: unknown,
): value is BookingComputer => typeof value === 'string' && value.trim().length > 0

export const isValidBookingDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const date = new Date(`${value}T00:00:00.000Z`)

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return false
  }

  const kyivDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  return value >= kyivDate
}

export const isValidBookingTime = (value: string): boolean =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

export const isValidBookingDuration = (value: unknown): boolean =>
  [1, 2, 3, 5, 8].includes(Number(value))

export const getBookingRange = (date: string, time: string, duration: number) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.slice(0, 10))
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)

  if (
    !match ||
    !timeMatch ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return null
  }

  const [, year, month, day] = match
  const [, hour, minute] = timeMatch
  const wallClock = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))

  if (
    new Date(wallClock).toISOString().slice(0, 10) !== `${year}-${month}-${day}`
  ) {
    return null
  }

  let start = wallClock
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zone = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Kyiv',
      timeZoneName: 'longOffset',
    }).formatToParts(new Date(start)).find((part) => part.type === 'timeZoneName')?.value
    const offset = /^GMT([+-])(\d{2}):(\d{2})$/.exec(zone ?? '')
    if (!offset) return null
    const sign = offset[1] === '+' ? 1 : -1
    const offsetMilliseconds = sign * (Number(offset[2]) * 60 + Number(offset[3])) * 60_000
    start = wallClock - offsetMilliseconds
  }

  const localParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(start))
  const local = (type: Intl.DateTimeFormatPartTypes) =>
    localParts.find((part) => part.type === type)?.value
  if (
    `${local('year')}-${local('month')}-${local('day')}` !== `${year}-${month}-${day}` ||
    `${local('hour')}:${local('minute')}` !== `${hour}:${minute}`
  ) {
    return null
  }

  return { start, end: start + duration * 60 * 60 * 1000 }
}

export const bookingRangesOverlap = (
  first: { start: number; end: number },
  second: { start: number; end: number },
) => first.start < second.end && second.start < first.end
