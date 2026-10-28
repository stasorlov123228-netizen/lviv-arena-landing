import type { Payload } from 'payload'

export async function syncComputerStatuses(payload: Payload, now = new Date()): Promise<void> {
  const nowIso = now.toISOString()
  const [computers, activeBookings] = await Promise.all([
    payload.find({
      collection: 'computers',
      overrideAccess: true,
      pagination: false,
      limit: 1000,
    }),
    payload.find({
      collection: 'bookings',
      overrideAccess: true,
      pagination: false,
      limit: 2000,
      where: {
        and: [
          { status: { not_equals: 'cancelled' } },
          { bookingStart: { less_than_equal: nowIso } },
          { bookingEnd: { greater_than: nowIso } },
        ],
      },
    }),
  ])

  const computersWithActiveBookings = new Set(
    activeBookings.docs
      .map((booking) => booking.computer)
      .filter((computer): computer is string => typeof computer === 'string' && Boolean(computer)),
  )

  await Promise.all(computers.docs.map(async (computer) => {
    if (computer.status === 'maintenance' || computer.status === 'offline') return

    const nextStatus = computer.manualOccupied || computersWithActiveBookings.has(computer.computerNumber)
      ? 'occupied'
      : 'available'

    if (computer.status === nextStatus) return

    await payload.update({
      collection: 'computers',
      id: computer.id,
      overrideAccess: true,
      context: { syncComputerStatus: true },
      data: { status: nextStatus },
    })
  }))
}
