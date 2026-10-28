
export function toMinorUnits(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'number' && !Number.isFinite(value)) return null

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim())
  if (!match) return null

  const whole = Number(match[1])
  const fraction = Number((match[2] ?? '').padEnd(2, '0'))
  const result = whole * 100 + fraction
  return Number.isSafeInteger(result) ? result : null
}

export function calculateBookingTotal(pricePerHour: unknown, duration: unknown): number | null {
  const hourlyMinorUnits = toMinorUnits(pricePerHour)
  const hours = Number(duration)
  if (hourlyMinorUnits === null || !Number.isSafeInteger(hours) || hours <= 0) return null

  const totalMinorUnits = hourlyMinorUnits * hours
  if (!Number.isSafeInteger(totalMinorUnits)) return null
  return Number(`${Math.floor(totalMinorUnits / 100)}.${String(totalMinorUnits % 100).padStart(2, '0')}`)
}
