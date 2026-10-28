import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tariffs"
    ALTER COLUMN "name" TYPE varchar USING "name"::text
  `)
  await db.execute(sql`
    ALTER TABLE "bookings"
    ALTER COLUMN "tariff" TYPE varchar USING "tariff"::text
  `)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_tariffs_name"`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_bookings_tariff"`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`CREATE TYPE "public"."enum_tariffs_name" AS ENUM('DEFAULT', 'PRO', 'VIP', 'STREAM')`)
  await db.execute(sql`CREATE TYPE "public"."enum_bookings_tariff" AS ENUM('DEFAULT', 'PRO', 'VIP', 'STREAM')`)
  await db.execute(sql`
    ALTER TABLE "tariffs"
    ALTER COLUMN "name" TYPE "public"."enum_tariffs_name" USING "name"::"public"."enum_tariffs_name"
  `)
  await db.execute(sql`
    ALTER TABLE "bookings"
    ALTER COLUMN "tariff" TYPE "public"."enum_bookings_tariff" USING "tariff"::"public"."enum_bookings_tariff"
  `)
}
