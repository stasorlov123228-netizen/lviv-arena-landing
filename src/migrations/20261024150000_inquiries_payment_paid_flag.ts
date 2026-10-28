import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "is_paid" boolean NOT NULL DEFAULT false`)
  await db.execute(sql`UPDATE "payments" SET "is_paid" = ("status" = 'paid')`)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "inquiries" (
      "id" serial PRIMARY KEY,
      "kind" varchar NOT NULL,
      "name" varchar NOT NULL,
      "email" varchar NOT NULL,
      "phone" varchar,
      "message" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'new',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "inquiries_id" integer`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {

}
