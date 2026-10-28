import 'dotenv/config'
import config from '../payload.config'
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { applyTariffPrices } from '../migrations/20261024170000_tariff_hourly_prices'

const expectedPrices = [
  ['DEFAULT', 80],
  ['PRO', 120],
  ['VIP', 150],
  ['STREAM', 140],
] as const

function getExpectedDatabaseName(): string {
  const index = process.argv.indexOf('--database-name')
  const supplied = index >= 0 ? process.argv[index + 1] : undefined
  if (!supplied) {
    throw new Error('Pass --database-name with the intended local PostgreSQL database name.')
  }
  return supplied
}

async function main() {
  const connectionString = process.env.DATABASE_URI || process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URI or DATABASE_URL must be configured.')

  const actualDatabaseName = new URL(connectionString).pathname.replace(/^\//, '')
  if (actualDatabaseName !== getExpectedDatabaseName()) {
    throw new Error(`Refusing to update tariffs: the configured database is "${actualDatabaseName}".`)
  }

  const payload = await getPayload({ config })
  if (!payload.db?.drizzle) throw new Error('The configured Payload database adapter is unavailable.')

  await applyTariffPrices(payload.db.drizzle)

  const result = await payload.db.drizzle.execute(sql`
    SELECT "name"::text AS name, "price_per_hour"::text AS price
    FROM "tariffs"
    WHERE "name"::text IN ('DEFAULT', 'PRO', 'VIP', 'STREAM')
    ORDER BY "name"::text
  `)
  const rows = (result as unknown as { rows?: Array<{ name: string; price: string }> }).rows ?? []
  const actualPrices = new Map(rows.map(({ name, price }) => [name, Number(price)]))
  if (rows.length !== expectedPrices.length || expectedPrices.some(([name, price]) => actualPrices.get(name) !== price)) {
    throw new Error('Tariff price verification failed after the update.')
  }

  payload.logger.info(`Hourly tariff prices verified: ${rows.map(({ name, price }) => `${name}=${price}`).join(', ')}.`)
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unable to set tariff prices.')
  process.exit(1)
})
