import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bookings"
    ADD COLUMN IF NOT EXISTS "user_id" integer
    CONSTRAINT "bookings_user_id_users_id_fk"
    REFERENCES "users"("id") ON DELETE SET NULL
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "bookings_user_idx" ON "bookings" ("user_id")
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {

}
