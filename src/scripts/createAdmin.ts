import 'dotenv/config'
import config from '../payload.config'
import { getPayload } from 'payload'

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME?.trim() || 'Club administrator'
  if (!email || !password || password.length < 12) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in the process environment.')
  }

  const payload = await getPayload({ config })
  const existing = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, overrideAccess: true })
  if (existing.docs.length) {
    const user = existing.docs[0]
    if (user.role === 'admin' && !user.isBlocked) {
      payload.logger.info(`An active administrator already exists for ${email}; no changes made.`)
      process.exit(0)
    }
    throw new Error(`An account already exists for ${email}. No duplicate was created and its password/role were not changed. Promote it through an existing administrator.`)
  }

  await payload.create({
    collection: 'users',
    overrideAccess: true,
    context: { provisionAdmin: true },
    data: { name, email, password, role: 'admin', isBlocked: false, mustChangePassword: false },
  })
  payload.logger.info(`Administrator ${email} created.`)
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
