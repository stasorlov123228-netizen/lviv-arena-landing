import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

const createEnum = (name: string, values: string[]) => sql.raw(`
  DO $$ BEGIN
    CREATE TYPE "${name}" AS ENUM (${values.map((value) => `'${value}'`).join(', ')});
  EXCEPTION WHEN duplicate_object THEN NULL; END $$
`)

export async function up({ db }: MigrateUpArgs): Promise<void> {

  await db.execute(sql`ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_no_overlapping_computer"`)
  await db.execute(sql`ALTER TABLE "bookings" ALTER COLUMN "computer" TYPE varchar USING "computer"::text`)
  await db.execute(sql`
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlapping_computer"
    EXCLUDE USING gist (
      "computer" WITH =,
      tstzrange("booking_start", "booking_end", '[)') WITH &&
    ) WHERE ("status" <> 'cancelled' AND "computer" IS NOT NULL AND "booking_start" IS NOT NULL AND "booking_end" IS NOT NULL)
  `)
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar`)
  await db.execute(sql`ALTER TABLE "computers" ADD COLUMN IF NOT EXISTS "manual_occupied" boolean NOT NULL DEFAULT false`)
  await db.execute(createEnum('enum_bookings_payment_method', ['cash', 'card']))
  await db.execute(createEnum('enum_bookings_payment_status', ['unpaid', 'paid']))
  await db.execute(createEnum('enum_payments_method', ['cash', 'card']))
  await db.execute(createEnum('enum_payments_status', ['unpaid', 'paid']))
  await db.execute(sql`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "payment_method" "enum_bookings_payment_method" NOT NULL DEFAULT 'cash'`)
  await db.execute(sql`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "payment_status" "enum_bookings_payment_status" NOT NULL DEFAULT 'unpaid'`)
  await db.execute(sql`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "total_amount" numeric`)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "bookings_rels" (
      "id" serial PRIMARY KEY, "order" integer, "parent_id" integer NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
      "path" varchar NOT NULL, "users_id" integer REFERENCES "users"("id") ON DELETE SET NULL
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "bookings_rels_parent_idx" ON "bookings_rels" ("parent_id")`)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payments" (
      "id" serial PRIMARY KEY,
      "amount" numeric NOT NULL,
      "method" "enum_payments_method" NOT NULL DEFAULT 'cash',
      "status" "enum_payments_status" NOT NULL DEFAULT 'unpaid',
      "paid_at" timestamptz,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "payments_rels" (
      "id" serial PRIMARY KEY, "order" integer, "parent_id" integer NOT NULL REFERENCES "payments"("id") ON DELETE CASCADE,
      "path" varchar NOT NULL, "bookings_id" integer NOT NULL UNIQUE REFERENCES "bookings"("id") ON DELETE CASCADE
    )
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "payments_rels_parent_idx" ON "payments_rels" ("parent_id")`)
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "payments_id" integer`)
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "bookings_id" integer`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {

}
