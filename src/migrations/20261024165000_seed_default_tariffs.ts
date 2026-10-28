import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    INSERT INTO "tariffs" (
      "name",
      "title",
      "description",
      "is_active",
      "computer_category"
    )
    VALUES
      ('DEFAULT', 'Для комфортної гри', 'Монітори від 144 Гц, 32 GB RAM, Швидкісні SSD', true, 'STANDART'),
      ('PRO', 'Для перемог', 'Монітори від 165 Гц, Потужне ігрове залізо, Механічні клавіатури', true, 'PRO'),
      ('VIP', 'Максимум комфорту', 'Монітори до 240 Гц, Преміальні крісла, Окрема VIP-зона', true, 'VIP'),
      ('STREAM', 'Створи свій контент', 'Стримінгове обладнання, Камера та мікрофон, Місце для трансляцій', true, 'STREAMER')
    ON CONFLICT ("name") DO NOTHING
  `)
}

// Seed rows are retained on rollback because they may have real bookings.
export async function down(_args: MigrateDownArgs): Promise<void> {}
