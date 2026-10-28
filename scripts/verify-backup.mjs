import fs from 'fs'
import path from 'path'

const backupDir = path.resolve('backups')
const backupFiles = fs.readdirSync(backupDir).filter((f) => f.endsWith('.json'))

if (backupFiles.length === 0) {
  console.error('No backup files found!')
  process.exit(1)
}

const latestBackup = path.join(backupDir, backupFiles.sort().reverse()[0])
console.log(`Verifying backup file: ${latestBackup}`)

const content = fs.readFileSync(latestBackup, 'utf8')
const backup = JSON.parse(content)

console.log(`Backup timestamp: ${backup.timestamp}`)
const tableNames = Object.keys(backup.tables)
console.log(`Total tables in backup: ${tableNames.length}`)

const keyTables = ['bookings', 'computers', 'tariffs', 'users']
for (const table of keyTables) {
  if (!backup.tables[table]) {
    console.error(`ERROR: Key table "${table}" is missing from backup!`)
    process.exit(1)
  }
  const count = backup.tables[table].length
  console.log(`- ${table}: ${count} rows backed up`)
}

console.log('Backup structure verification PASSED. No database connection or writes were made.')

