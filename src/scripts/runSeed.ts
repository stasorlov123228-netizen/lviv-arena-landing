import 'dotenv/config'
import config from '../payload.config'
import { getPayload } from 'payload'
import { seedLvivArena } from './seedLvivArena'

async function run() {
  const payload = await getPayload({ config })
  await seedLvivArena(payload)
  process.exit(0)
}

run().catch((err) => {
  console.error('Seed execution error:', err)
  process.exit(1)
})
