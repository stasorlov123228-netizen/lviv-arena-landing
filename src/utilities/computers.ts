import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'

export async function findAvailableComputerNumbers(payload: Payload, category: string): Promise<string[]> {

  if (!payload.db?.drizzle) {
    const result = await payload.find({
      collection: 'computers', overrideAccess: true, pagination: false, limit: 500,
      where: { and: [
        { category: { equals: category } },
        { status: { equals: 'available' } },
        { manualOccupied: { equals: false } },
      ] },
      sort: 'computerNumber',
    })
    return result.docs.map((computer) => computer.computerNumber).filter((number): number is string => typeof number === 'string')
  }
  const flagResult = await payload.db.drizzle.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'computers'
        AND column_name = 'manual_occupied'
    ) AS present
  `)
  const hasManualOccupied = Boolean((flagResult as { rows?: Array<{ present?: boolean }> }).rows?.[0]?.present)
  const result = hasManualOccupied
    ? await payload.db.drizzle.execute(sql`
        SELECT computer_number AS "computerNumber"
        FROM computers
        WHERE category = ${category}
          AND status = 'available'
          AND manual_occupied = false
        ORDER BY computer_number
      `)
    : await payload.db.drizzle.execute(sql`
        SELECT computer_number AS "computerNumber"
        FROM computers
        WHERE category = ${category}
          AND status = 'available'
        ORDER BY computer_number
      `)

  return ((result as { rows?: Array<{ computerNumber?: string }> }).rows ?? [])
    .map((row) => row.computerNumber)
    .filter((number): number is string => typeof number === 'string')
}

export async function getComputerCategoryCounts(payload: Payload): Promise<Record<string, number>> {
  if (!payload.db?.drizzle) {
    const result = await payload.find({ collection: 'computers', overrideAccess: true, pagination: false, limit: 1000 })
    return result.docs.reduce<Record<string, number>>((counts, computer) => {
      counts[computer.category] = (counts[computer.category] ?? 0) + 1
      return counts
    }, {})
  }
  const result = await payload.db.drizzle.execute(sql`
    SELECT category, COUNT(*)::int AS count
    FROM computers
    GROUP BY category
  `)
  const rows = (result as { rows?: Array<{ category?: string; count?: number | string }> }).rows ?? []
  return rows.reduce<Record<string, number>>((counts, row) => {
    if (typeof row.category === 'string') counts[row.category] = Number(row.count) || 0
    return counts
  }, {})
}
