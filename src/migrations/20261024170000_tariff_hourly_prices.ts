import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function applyTariffPrices(db: MigrateUpArgs['db']): Promise<void> {
  await db.execute(sql`
    DO $migration$
    DECLARE missing_tariffs text;
    BEGIN
      SELECT string_agg(expected.name, ', ')
      INTO missing_tariffs
      FROM (VALUES
        ('DEFAULT'),
        ('PRO'),
        ('VIP'),
        ('STREAM')
      ) AS expected(name)
      LEFT JOIN "tariffs" AS actual ON actual."name"::text = expected.name
      WHERE actual."id" IS NULL;

      IF missing_tariffs IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot set tariff prices; missing tariff rows: %', missing_tariffs;
      END IF;

      UPDATE "tariffs" AS tariff
      SET "price_per_hour" = prices.price,
          "updated_at" = now()
      FROM (VALUES
        ('DEFAULT', 80::numeric),
        ('PRO', 120::numeric),
        ('VIP', 150::numeric),
        ('STREAM', 140::numeric)
      ) AS prices(name, price)
      WHERE tariff."name"::text = prices.name
        AND tariff."price_per_hour" IS DISTINCT FROM prices.price;
    END
    $migration$;
  `)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await applyTariffPrices(db)
}

export async function down(_args: MigrateDownArgs): Promise<void> {

}
