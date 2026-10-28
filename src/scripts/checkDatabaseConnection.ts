import 'dotenv/config'

import { sql } from 'drizzle-orm'
import { getPayload } from 'payload'

interface ConnectionCheckRow {
  connectivity_check: number
  database: string
  server_address: string | null
  server_port: number | null
  version: string
  ssl: boolean | null
}

const connectionString = process.env.DATABASE_URI || process.env.DATABASE_URL
const selectedVariable = process.env.DATABASE_URI ? 'DATABASE_URI' : 'DATABASE_URL'

if (!connectionString) {
  console.error('Database check failed: DATABASE_URI or DATABASE_URL is not configured.')
  process.exitCode = 1
} else {
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined

  try {
    const parsedConnection = new URL(connectionString)

    process.env.PAYLOAD_DB_PUSH = 'false'
    const { default: config } = await import('../payload.config')
    payload = await getPayload({ config })

    const result = await payload.db.drizzle.execute(sql`
      SELECT
        1 AS connectivity_check,
        current_database() AS database,
        inet_server_addr()::text AS server_address,
        inet_server_port() AS server_port,
        version() AS version,
        (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS ssl
    `)
    const rows = (result as unknown as { rows: ConnectionCheckRow[] }).rows
    const row = rows[0]

    console.log(JSON.stringify({
      connected: row.connectivity_check === 1,
      selectedVariable,
      host: parsedConnection.hostname,
      database: row.database,
      serverAddress: row.server_address,
      serverPort: row.server_port,
      postgresVersion: row.version.match(/^PostgreSQL [^ ]+/)?.[0] ?? 'unknown',
      ssl: row.ssl,
      looksLikeNeon: /(^|\.)neon\.tech$/i.test(parsedConnection.hostname),
      schemaPushForcedOffForCheck: true,
    }))
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'UNKNOWN'
    console.error(JSON.stringify({
      connected: false,
      selectedVariable,
      errorCode: code,
      message: 'Database connection check failed; the connection string was not printed.',
    }))
    process.exitCode = 1
  } finally {
    await payload?.destroy()
  }
}

process.exit(process.exitCode ?? 0)
