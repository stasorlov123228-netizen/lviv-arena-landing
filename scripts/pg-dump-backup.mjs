import { execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import dotenv from 'dotenv'

dotenv.config()

const dbUri = process.env.DATABASE_URI || process.env.DATABASE_URL
if (!dbUri) {
  console.error('DATABASE_URI / DATABASE_URL is not set')
  process.exit(1)
}

const url = new URL(dbUri)
const host = url.hostname || '127.0.0.1'
const port = url.port || '5432'
const user = url.username || 'postgres'
const password = url.password || ''
const database = url.pathname.replace(/^\//, '') || 'lviv-arena-cms'

const pgDumpPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe'

const timestamp = Date.now()
const backupDir = path.resolve('backups')
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true })
}
const outputFile = path.join(backupDir, `db_backup_pg_dump_${timestamp}.sql`)

console.log(`Starting real PostgreSQL pg_dump for database "${database}"...`)

try {
  execSync(
    `"${pgDumpPath}" -h ${host} -p ${port} -U ${user} -d ${database} --clean --if-exists --format=plain --file="${outputFile}"`,
    {
      env: {
        ...process.env,
        PGPASSWORD: password,
      },
      stdio: 'pipe',
    }
  )

  const stats = fs.statSync(outputFile)
  console.log(`Real PostgreSQL pg_dump completed successfully!`)
  console.log(`Saved to: ${outputFile} (Size: ${(stats.size / 1024).toFixed(2)} KB)`)
} catch (err) {
  console.error('Failed to run pg_dump:', err.message)
  process.exit(1)
}

