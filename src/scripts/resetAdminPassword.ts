import 'dotenv/config'
import { stdin, stdout } from 'node:process'
import config from '../payload.config'
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { Users } from '../collections/Users'

function getArgument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1]?.trim() : undefined
  if (!value) throw new Error(`Pass ${name} with the intended value.`)
  return value
}

async function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal so passwords are not echoed.')
  }

  stdout.write(prompt)
  stdin.setRawMode(true)
  stdin.resume()
  stdin.setEncoding('utf8')

  return new Promise((resolve, reject) => {
    let value = ''
    const cleanup = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onData)
      stdout.write('\n')
    }
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup()
          reject(new Error('Cancelled.'))
          return
        }
        if (character === '\r' || character === '\n') {
          cleanup()
          resolve(value)
          return
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1)
        } else if (character >= ' ') {
          value += character
        }
      }
    }
    stdin.on('data', onData)
  })
}

async function main() {
  const expectedDatabase = getArgument('--database-name')
  const email = getArgument('--email').toLowerCase()
  const payload = await getPayload({ config })
  try {
  if (!payload.db?.drizzle) throw new Error('Database adapter unavailable.')

  const result = await payload.db.drizzle.execute(sql`SELECT current_database() AS name`)
  const actualDatabase = (result as unknown as { rows?: Array<{ name: string }> }).rows?.[0]?.name
  if (actualDatabase !== expectedDatabase) throw new Error('Refusing password reset: database name does not match.')

  const matches = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 2,
    overrideAccess: true,
  })
  if (matches.docs.length !== 1) throw new Error('Expected exactly one matching administrator; no changes made.')
  const user = matches.docs[0]
  if (user.role !== 'admin' || user.isBlocked) throw new Error('The selected account is not an active administrator; no changes made.')

  const password = await readHidden('New password (hidden): ')
  const confirmation = await readHidden('Confirm password (hidden): ')
  if (password.length < 12) throw new Error('Password must be at least 12 characters; no changes made.')
  if (password !== confirmation) throw new Error('Passwords did not match; no changes made.')

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { password },
    overrideAccess: true,
  })

  let localLogin
  try {
    localLogin = await payload.login({ collection: 'users', data: { email, password } })
  } catch {
    throw new Error('Payload password update completed, but the configured Payload API rejected the new credentials.')
  }

  const localAuth = await payload.auth({
    headers: new Headers({ Authorization: `JWT ${localLogin.token}` }),
  })
  if (localAuth.user?.role !== 'admin' || String(localAuth.user.id) !== String(user.id)) {
    throw new Error('Payload accepted credentials but returned an unexpected account or role.')
  }

  const canAccessAdmin = Users.access?.admin as unknown as (args: {
    req: { user: typeof localAuth.user; payload: typeof payload }
  }) => boolean | Promise<boolean>
  if (!(await canAccessAdmin({ req: { user: localAuth.user, payload } }))) {
    throw new Error('Payload authenticated the account but denied its current Admin access check.')
  }

  let nextLoginResponse: Response
  try {
    nextLoginResponse = await fetch('http://localhost:3100/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new Error('Payload authentication passed locally, but the Next.js Payload login endpoint on port 3100 could not be reached.')
  }
  if (!nextLoginResponse.ok) {
    throw new Error(`Payload authentication passed locally, but Next.js on port 3100 rejected the same credentials (HTTP ${nextLoginResponse.status}). Check its runtime database/configuration.`)
  }

  const nextLogin = await nextLoginResponse.json() as { token?: unknown }
  if (typeof nextLogin.token !== 'string' || !nextLogin.token) {
    throw new Error('Next.js accepted login but returned no Payload token.')
  }
  const nextMeResponse = await fetch('http://localhost:3100/api/users/me', {
    headers: { Authorization: `JWT ${nextLogin.token}` },
  })
  if (!nextMeResponse.ok) throw new Error(`Next.js accepted login but /api/users/me failed (HTTP ${nextMeResponse.status}).`)
  const nextMe = await nextMeResponse.json() as { user?: { id?: unknown; role?: unknown } | null }
  if (String(nextMe.user?.id) !== String(user.id) || nextMe.user?.role !== 'admin') {
    throw new Error('Next.js authenticated a different account or did not return the administrator role.')
  }

  console.info('Password updated. Payload login, Admin access, Next.js login, and current-user verification all passed.')
  } finally {
    await payload.destroy()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Password reset failed.')
  process.exitCode = 1
})
