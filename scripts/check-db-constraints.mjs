import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config()
const client = new pg.Client({ connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL })
await client.connect()

const res = await client.query(`
  SELECT conname, contype, pg_get_constraintdef(oid) as def
  FROM pg_constraint
  WHERE conrelid = 'bookings'::regclass;
`)
console.log('Constraints on bookings:')
for (const row of res.rows) {
  console.log(`- ${row.conname} (${row.contype}): ${row.def}`)
}

await client.end()

