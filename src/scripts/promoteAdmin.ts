import 'dotenv/config'
import { stdin, stdout } from 'node:process'
import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'
import config from '../payload.config'

function argument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1]?.trim() : undefined
  if (!value) throw new Error(`Pass ${name} with the intended value.`)
  return value
}

function readConfirmation(prompt: string): Promise<string> {
  if (!stdin.isTTY) throw new Error('Run this command in an interactive terminal.')
  stdout.write(prompt)
  return new Promise((resolve) => {
    stdin.resume()
    stdin.setEncoding('utf8')
    stdin.once('data', (input: string) => {
      stdin.pause()
      resolve(input.trim())
    })
  })
}

async function main() {
  const expectedDatabase = argument('--database-name')
  const email = argument('--email').trim().toLowerCase()
  const payload = await getPayload({ config })

  try {
    if (!payload.db?.drizzle) throw new Error('Database adapter unavailable.')

    const current = await payload.db.drizzle.execute(sql`SELECT current_database() AS name`)
    const databaseName = (current as unknown as { rows?: Array<{ name: string }> }).rows?.[0]?.name
    if (databaseName !== expectedDatabase) throw new Error('Database name mismatch; no changes made.')

    const matches = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 2,
      overrideAccess: true,
    })
    if (matches.docs.length !== 1) throw new Error('Expected exactly one account; no changes made.')
    const user = matches.docs[0]
    if (user.isBlocked) throw new Error('This account is blocked. Unblock it through an existing administrator first.')
    if (user.role === 'admin') {
      console.info('This account is already an administrator; no changes made.')
      return
    }

    const confirmation = await readConfirmation(`Promote ${email} to administrator in ${databaseName}? Type the email to confirm: `)
    if (confirmation.toLowerCase() !== email) throw new Error('Confirmation did not match; no changes made.')

    const result = await payload.db.drizzle.execute(sql`
      UPDATE users SET role = 'admin', updated_at = NOW()
      WHERE id = ${Number(user.id)} AND lower(email) = ${email} AND role <> 'admin' AND is_blocked IS NOT TRUE
      RETURNING id
    `)
    const updated = (result as unknown as { rows?: Array<{ id: number }> }).rows ?? []
    if (updated.length !== 1) throw new Error('Account was not updated; no changes made.')
    console.info(`Administrator access enabled for ${email}. Log out and sign in again to refresh the session.`)
  } finally {
    await payload.destroy()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Promotion failed.')
  process.exitCode = 1
})

