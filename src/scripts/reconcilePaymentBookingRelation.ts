import 'dotenv/config'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'

const migrationName = '20261026100000_payment_booking_fk'
const initialMigrationName = '20261018000000_initial_payload_schema'
const requiredPreviousMigrations = [
  '20261019140000_booking_computer_overlap',
  '20261020200000_auth_roles_computers_tariffs',
  '20261024120000_customer_payments',
  '20261024150000_inquiries_payment_paid_flag',
  '20261024160000_booking_user_relation',
  '20261024170000_tariff_hourly_prices',
]

async function main() {
  if (!process.argv.includes('--apply')) {
    throw new Error('Pass --apply to run the reviewed Neon migration.')
  }

  const connectionString = process.env.DATABASE_URI || process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URI or DATABASE_URL must be configured.')
  const databaseURL = new URL(connectionString)
  const databaseName = decodeURIComponent(databaseURL.pathname.slice(1))
  if (!databaseURL.hostname.endsWith('.neon.tech') || /(^|[_-])test([_-]|$)/i.test(databaseName)) {
    throw new Error('Refusing to run: the active database must be the intended non-test Neon database.')
  }

  process.env.PAYLOAD_DB_PUSH = 'false'
  const [{ default: config }, { getPayload }, { sql }, schemaText, { up }] = await Promise.all([
    import('../payload.config'),
    import('payload'),
    import('@payloadcms/db-postgres'),
    readFile(path.resolve(process.cwd(), 'src/migrations/20261018000000_initial_payload_schema.json'), 'utf8'),
    import('../migrations/20261026100000_payment_booking_fk'),
  ])
  const initialSchema = JSON.parse(schemaText) as {
    tables: Record<string, { columns: Record<string, unknown> }>
  }
  const payload = await getPayload({ config })

  try {
    const schemaResult = await payload.db.drizzle.execute(sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `)
    const actualColumns = new Map<string, Set<string>>()
    for (const row of schemaResult.rows as Array<{ table_name: string; column_name: string }>) {
      if (!actualColumns.has(row.table_name)) actualColumns.set(row.table_name, new Set())
      actualColumns.get(row.table_name)!.add(row.column_name)
    }

    const missingTables: string[] = []
    const missingColumns: string[] = []
    for (const [qualifiedName, definition] of Object.entries(initialSchema.tables)) {
      const tableName = qualifiedName.split('.').at(-1)!
      const columns = actualColumns.get(tableName)
      if (!columns) {
        missingTables.push(tableName)
        continue
      }
      for (const columnName of Object.keys(definition.columns)) {
        if (!columns.has(columnName)) missingColumns.push(`${tableName}.${columnName}`)
      }
    }

    const { docs } = await payload.find({
      collection: 'payload-migrations',
      depth: 0,
      limit: 1000,
      pagination: false,
      overrideAccess: true,
    })
    const applied = new Set(docs.map((migration) => migration.name))
    const needsBaseline = !applied.has(initialMigrationName)
    const missingPrevious = requiredPreviousMigrations.filter((name) => !applied.has(name))
    const expectedGap = needsBaseline && !applied.has(migrationName) ? ['payments.booking_id'] : []
    const unexpectedMissingColumns = missingColumns.filter((name) => !expectedGap.includes(name))

    if (missingTables.length || unexpectedMissingColumns.length || missingPrevious.length) {
      throw new Error('Refusing to migrate: the live schema or migration history differs from the reviewed baseline.')
    }
    if (needsBaseline && missingColumns.length !== expectedGap.length) {
      throw new Error('Refusing to baseline: the initial schema is not complete except for payments.booking_id.')
    }

    const migrations = []
    if (needsBaseline) {
      payload.logger.info({ msg: 'Recording the already-present initial schema as the migration baseline.' })
      migrations.push({ name: initialMigrationName, up: async () => {}, down: async () => {} })
    }
    if (!applied.has(migrationName)) {
      migrations.push({ name: migrationName, up: (args: unknown) => up(args as MigrateUpArgs), down: async () => {} })
    }
    if (migrations.length) await payload.db.migrate({ migrations })

    const verification = await payload.db.drizzle.execute(sql`
      SELECT
        column_name,
        is_nullable,
        EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'payments_booking_id_bookings_id_fk'
            AND conrelid = 'payments'::regclass
        ) AS has_foreign_key,
        EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public' AND indexname = 'payments_booking_idx'
        ) AS has_unique_index
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'booking_id'
    `)
    const verified = verification.rows[0] as {
      column_name?: string
      is_nullable?: string
      has_foreign_key?: boolean
      has_unique_index?: boolean
    } | undefined
    if (
      verified?.column_name !== 'booking_id' ||
      verified.is_nullable !== 'NO' ||
      verified.has_foreign_key !== true ||
      verified.has_unique_index !== true
    ) {
      throw new Error('Migration ran, but the booking relationship did not pass its schema verification.')
    }

    await payload.find({
      collection: 'payments',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { booking: { equals: 28 } },
    })
    const booking = await payload.findByID({ collection: 'bookings', id: 28, depth: 0, overrideAccess: true }).catch(() => null)
    console.log(JSON.stringify({
      database: databaseName,
      paymentBookingColumn: 'present and not null',
      foreignKey: verified.has_foreign_key,
      uniqueIndex: verified.has_unique_index,
      payloadRelationshipQuery: 'passed',
      booking28Status: booking?.status ?? 'not found',
    }))
  } finally {
    await payload.destroy()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Payment relationship migration failed.')
  process.exitCode = 1
}).finally(() => {

  process.exit(process.exitCode ?? 0)
})
