import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "booking_id" integer`)

  await db.execute(sql`
    DO $migration$
    BEGIN
      IF to_regclass('payments_rels') IS NOT NULL THEN
        IF EXISTS (
          SELECT 1
          FROM "payments_rels"
          WHERE "path" <> 'booking'
        ) THEN
          RAISE EXCEPTION 'Cannot reconcile payments: unexpected relationship paths exist.';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM "payments_rels"
          GROUP BY "parent_id"
          HAVING count(*) > 1
        ) THEN
          RAISE EXCEPTION 'Cannot reconcile payments: a payment has multiple booking relations.';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM "payments" AS payment
          JOIN "payments_rels" AS relation ON relation."parent_id" = payment."id"
          WHERE payment."booking_id" IS NOT NULL
            AND payment."booking_id" <> relation."bookings_id"
        ) THEN
          RAISE EXCEPTION 'Cannot reconcile payments: direct and relation-table booking IDs disagree.';
        END IF;

        UPDATE "payments" AS payment
        SET "booking_id" = relation."bookings_id"
        FROM "payments_rels" AS relation
        WHERE relation."parent_id" = payment."id"
          AND relation."path" = 'booking'
          AND payment."booking_id" IS NULL;
      END IF;

      IF EXISTS (SELECT 1 FROM "payments" WHERE "booking_id" IS NULL) THEN
        RAISE EXCEPTION 'Cannot reconcile payments: one or more payments have no linked booking.';
      END IF;

      IF EXISTS (
        SELECT 1 FROM "payments" GROUP BY "booking_id" HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'Cannot reconcile payments: a booking is linked to multiple payments.';
      END IF;
    END
    $migration$;
  `)

  await db.execute(sql`ALTER TABLE "payments" ALTER COLUMN "booking_id" SET NOT NULL`)
  await db.execute(sql`
    DO $migration$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'payments_booking_id_bookings_id_fk'
          AND conrelid = 'payments'::regclass
      ) THEN
        ALTER TABLE "payments"
          ADD CONSTRAINT "payments_booking_id_bookings_id_fk"
          FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END
    $migration$;
  `)
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "payments_booking_idx" ON "payments" USING btree ("booking_id")`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {

}
