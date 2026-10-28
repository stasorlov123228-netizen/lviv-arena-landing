import 'dotenv/config'
import { stdin, stdout } from 'node:process'
import config from '../payload.config'
import { getPayload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { Users } from '../collections/Users'
import { expectedAdminCollectionAccess, expectedAdminGlobalUpdates } from '../utilities/adminAccessPolicy'

function argument(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1]?.trim() : undefined
  if (!value) throw new Error(`Pass ${name} with the intended value.`)
  return value
}

function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal; password input must not be echoed.')
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
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1)
        else if (character >= ' ') value += character
      }
    }
    stdin.on('data', onData)
  })
}

async function main() {
  const expectedDatabase = argument('--database-name')
  const email = argument('--email').toLowerCase()
  const payload = await getPayload({ config })

  try {
    const dbResult = await payload.db.drizzle.execute(sql`SELECT current_database() AS name`)
    const databaseName = (dbResult as unknown as { rows?: Array<{ name: string }> }).rows?.[0]?.name
    if (databaseName !== expectedDatabase) throw new Error('Configured Payload database does not match --database-name.')

    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 2,
      overrideAccess: true,
    })
    if (users.docs.length !== 1) throw new Error('Expected exactly one account; no login was attempted.')
    const target = users.docs[0]
    if (target.role !== 'admin' || target.isBlocked) throw new Error('Target is not an active administrator; no login was attempted.')

    const password = await readHidden('Current password (hidden): ')
    let localLogin
    try {
      localLogin = await payload.login({ collection: 'users', data: { email, password } })
    } catch {
      throw new Error('The configured Payload process rejected the credentials. Password, token, and hashes were not displayed.')
    }

    const localAuth = await payload.auth({
      headers: new Headers({ Authorization: `JWT ${localLogin.token}` }),
    })
    if (localAuth.user?.role !== 'admin' || String(localAuth.user.id) !== String(target.id)) {
      throw new Error('Payload login succeeded, but the authenticated account/role did not match the target administrator.')
    }

    const accessReq = { user: localAuth.user, payload } as never
    const adminAccess = Users.access?.admin as unknown as (args: { req: never }) => boolean | Promise<boolean>
    if (!(await adminAccess({ req: accessReq }))) throw new Error('Payload authenticated the account but denied Admin access.')

    let nextLoginResponse: Response
    try {
      nextLoginResponse = await fetch('http://localhost:3100/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    } catch {
      throw new Error('Local Payload login passed, but the Payload login endpoint on port 3100 is unreachable.')
    }
    if (!nextLoginResponse.ok) {
      throw new Error(`Local Payload login passed, but Next.js/Payload on port 3100 rejected it (HTTP ${nextLoginResponse.status}); runtime configuration/database differs or that process is stale.`)
    }

    const nextLogin = await nextLoginResponse.json() as { token?: unknown }
    if (typeof nextLogin.token !== 'string' || !nextLogin.token) throw new Error('Next.js login returned no token.')
    const meResponse = await fetch('http://localhost:3100/api/users/me', {
      headers: { Authorization: `JWT ${nextLogin.token}` },
    })
    if (!meResponse.ok) throw new Error(`Next.js login succeeded but current-user lookup failed (HTTP ${meResponse.status}).`)
    const me = await meResponse.json() as { user?: { id?: unknown; role?: unknown } | null }
    if (String(me.user?.id) !== String(target.id) || me.user?.role !== 'admin') {
      throw new Error('Next.js current-user response did not identify the target administrator with role admin.')
    }

    const roleAccess: Record<string, boolean> = {}
    for (const collection of payload.config.collections) {
      for (const operation of ['read', 'create', 'update', 'delete'] as const) {
        const access = collection.access?.[operation]
        if (typeof access === 'function') {
          roleAccess[`${collection.slug}.${operation}`] = (await access({ req: { user: me.user } as never })) === true
        }
      }
    }
    const globalUpdates: Record<string, boolean> = {}
    for (const global of payload.config.globals) {
      const access = global.access?.update
      if (typeof access === 'function') {
        globalUpdates[global.slug] = (await access({ req: { user: me.user } as never })) === true
      }
    }

    const accessMismatches = Object.entries(expectedAdminCollectionAccess).flatMap(([slug, operations]) =>
      Object.entries(operations)
        .filter(([operation, expected]) => roleAccess[`${slug}.${operation}`] !== expected)
        .map(([operation, expected]) => `${slug}.${operation} (expected ${expected})`),
    )
    const globalMismatches = expectedAdminGlobalUpdates
      .filter((slug) => globalUpdates[slug] !== true)
      .map((slug) => `${slug}.update (expected true)`)
    if (accessMismatches.length || globalMismatches.length) {
      throw new Error(`Login passed, but admin access checks differ from project policy: ${[...accessMismatches, ...globalMismatches].join(', ')}.`)
    }

    console.info(JSON.stringify({
      database: databaseName,
      payloadLogin: 'passed',
      nextLoginOn3100: 'passed',
      currentUser: 'target active administrator',
      collectionAccess: roleAccess,
      editableGlobals: expectedAdminGlobalUpdates,
    }))
  } finally {
    await payload.destroy()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Admin login verification failed.')
  process.exitCode = 1
})
