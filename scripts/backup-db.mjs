import { Client } from 'pg'
import fs from 'fs'
import path from 'path'

const connectionString = process.env.DATABASE_URI || process.env.DATABASE_URL
if (!connectionString) {
  console.error('Set DATABASE_URI or DATABASE_URL explicitly before creating a backup.')
  process.exit(1)
}
const client = new Client({ connectionString })

async function runBackup() {
  await client.connect()
  console.log('Connected to PostgreSQL for backup...')

  const backupDir = path.resolve('backups')
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const tablesRes = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)

  const tables = tablesRes.rows.map((r) => r.table_name)
  console.log(`Found ${tables.length} tables to back up:`, tables)

  const backupData = {
    timestamp: new Date().toISOString(),
    tables: {},
    schema: {},
  }

  for (const table of tables) {

    const colsRes = await client.query(
      `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
      [table],
    )
    backupData.schema[table] = colsRes.rows

    const dataRes = await client.query(`SELECT * FROM "${table}"`)
    backupData.tables[table] = dataRes.rows
    console.log(`Backed up table "${table}": ${dataRes.rows.length} rows`)
  }

  const backupFile = path.join(backupDir, `db_backup_${Date.now()}.json`)
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8')
  console.log(`Backup completed successfully! Saved to: ${backupFile}`)

  await client.end()
}

runBackup().catch((err) => {
  console.error('Backup failed:', err)
  process.exit(1)
})

