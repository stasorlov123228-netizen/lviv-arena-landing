import { spawn } from 'node:child_process'

const PORT = 3096
const env = { ...process.env, PORT: String(PORT) }

console.log('Testing production server launch (dist/server.js)...')
const proc = spawn('node', ['dist/server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] })

let stdout = ''
let stderr = ''
proc.stdout.on('data', (d) => { stdout += d.toString(); process.stdout.write(d) })
proc.stderr.on('data', (d) => { stderr += d.toString(); process.stderr.write(d) })

async function test() {

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if (stdout.includes(`http://localhost:${PORT}`)) break
  }

  console.log('\nTesting GET http://localhost:' + PORT)
  const resHome = await fetch(`http://localhost:${PORT}`)
  console.log('GET / status:', resHome.status)
  const homeText = await resHome.text()
  console.log('GET / contains "Lviv Arena":', homeText.includes('Lviv Arena'))

  console.log('\nTesting GET http://localhost:' + PORT + '/booking')
  const resBookingPage = await fetch(`http://localhost:${PORT}/booking`)
  console.log('GET /booking status:', resBookingPage.status)

  console.log('\nTesting GET http://localhost:' + PORT + '/api/bookings?tariff=DEFAULT&date=2026-11-20&time=14:00&duration=3')
  const resApi = await fetch(`http://localhost:${PORT}/api/bookings?tariff=DEFAULT&date=2026-11-20&time=14:00&duration=3`)
  console.log('GET /api/bookings status:', resApi.status)
  const apiData = await resApi.json()
  console.log('Computers count returned:', apiData.computers?.length)
  console.log('Available computers count:', apiData.availableComputers?.length)

  proc.kill()
  console.log('\nProduction server run verification: SUCCESS!')
}

test().catch((err) => {
  console.error('\nProduction server run verification: FAILED!', err)
  proc.kill()
  process.exit(1)
})
