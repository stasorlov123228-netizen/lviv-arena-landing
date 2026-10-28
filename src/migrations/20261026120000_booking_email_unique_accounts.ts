import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "email" varchar`)
  await db.execute(sql`
    DO $migration$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM "users"
        GROUP BY lower("email")
        HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'Cannot enforce unique account emails: case-insensitive duplicates exist.';
      END IF;
    END
    $migration$;
  `)
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_unique_idx" ON "users" USING btree (lower("email"))`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {

}
