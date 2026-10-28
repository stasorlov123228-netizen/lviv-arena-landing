import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

const computerCategories = ['STANDART', 'PRO', 'VIP', 'STREAMER']
const computers = Array.from(
  { length: 70 },
  (_, index) => `PC-${String(index + 1).padStart(2, '0')}`,
)

const createEnumType = (name: string, values: string[]) => {
  const enumValues = values.map((value) => `'${value}'`).join(', ')

  return sql.raw(`
    DO $$
    BEGIN
      CREATE TYPE "${name}" AS ENUM (${enumValues});
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    $$
  `)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS btree_gist`)

  await db.execute(createEnumType('enum_bookings_computer_category', computerCategories))
  await db.execute(createEnumType('enum_bookings_computer', computers))
  await db.execute(
    sql`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "computer_category" "enum_bookings_computer_category"`,
  )
  await db.execute(
    sql`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "computer" "enum_bookings_computer"`,
  )
  await db.execute(sql`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "booking_start" timestamptz`)
  await db.execute(sql`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "booking_end" timestamptz`)
  await db.execute(sql`
    ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_no_overlapping_computer"
    EXCLUDE USING gist (
      "computer" WITH =,
      tstzrange("booking_start", "booking_end", '[)') WITH &&
    )
    WHERE (
      "status" <> 'cancelled'
      AND "computer" IS NOT NULL
      AND "booking_start" IS NOT NULL
      AND "booking_end" IS NOT NULL
    )
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql`ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_no_overlapping_computer"`,
  )
}
