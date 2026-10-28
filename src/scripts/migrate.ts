import 'dotenv/config'

process.env.PAYLOAD_DB_PUSH = 'false'
if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URI = process.env.DATABASE_URL_UNPOOLED
}

if (!process.env.DATABASE_URI && !process.env.DATABASE_URL) {
  console.error('Migration failed: configure DATABASE_URL or DATABASE_URL_UNPOOLED first.')
  process.exit(1)
}

const [{ getPayload }, { default: config }] = await Promise.all([
  import('payload'),
  import('../payload.config'),
])

let payload: Awaited<ReturnType<typeof getPayload>> | undefined

try {
  payload = await getPayload({ config })
  await payload.db.migrate()
  console.log('Payload migrations completed.')
} catch (error) {
  const details = error instanceof Error ? error.message : 'Unknown migration error.'
  console.error(`Payload migrations failed: ${details}`)
  process.exitCode = 1
} finally {
  await payload?.destroy()
}

process.exit(process.exitCode ?? 0)
