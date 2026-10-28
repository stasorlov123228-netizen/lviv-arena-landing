import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {

  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar DEFAULT 'user';
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_blocked" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "computers" (
      "id" serial PRIMARY KEY,
      "computer_number" varchar NOT NULL UNIQUE,
      "category" varchar NOT NULL,
      "status" varchar NOT NULL DEFAULT 'available',
      "description" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "tariffs" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL UNIQUE,
      "title" varchar NOT NULL,
      "description" text,
      "price_per_hour" numeric,
      "is_active" boolean NOT NULL DEFAULT true,
      "computer_category" varchar NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    );
  `)

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "computers_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "tariffs_id" integer;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {

}
