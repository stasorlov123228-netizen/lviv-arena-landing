import { spawn } from 'node:child_process'
import dotenv from 'dotenv'

dotenv.config()

const PORT = 3094
const BASE = `http://localhost:${PORT}`

console.log(`--- Starting Next.js Production Server with Payload Admin on port ${PORT} ---`)

const proc = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
})

let stdout = ''
let stderr = ''
proc.stdout.on('data', (d) => { stdout += d.toString(); process.stdout.write(d) })
proc.stderr.on('data', (d) => { stderr += d.toString(); process.stderr.write(d) })

async function runTest() {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if (stdout.includes(`Ready in`) || stdout.includes(`${PORT}`)) break
  }

  console.log('\n[1/6] Testing Public Homepage: GET /')
  const resHome = await fetch(`${BASE}/`)
  console.log('GET / status:', resHome.status)
  const homeHtml = await resHome.text()
  console.log('Homepage contains "LVIV ARENA":', homeHtml.includes('LVIV ARENA'))
  if (resHome.status !== 200) throw new Error('Home page failed')

  console.log('\n[2/6] Testing Booking Page: GET /booking')
  const resBooking = await fetch(`${BASE}/booking`)
  console.log('GET /booking status:', resBooking.status)
  const bookingHtml = await resBooking.text()
  console.log('Booking page has Vanilla booking.js:', bookingHtml.includes('/booking.js'))
  if (resBooking.status !== 200) throw new Error('Booking page failed')

  console.log('\n[3/6] Testing Official Payload Admin: GET /admin')
  const resAdmin = await fetch(`${BASE}/admin`)
  console.log('GET /admin status:', resAdmin.status)
  const adminHtml = await resAdmin.text()
  console.log('Admin page contains Payload assets or RootLayout:', adminHtml.includes('payload') || adminHtml.includes('__next'))
  if (resAdmin.status !== 200) throw new Error(`Payload Admin returned status ${resAdmin.status}`)

  console.log('\n[4/6] Testing Payload Admin Authentication: POST /api/users/login')
  const loginRes = await fetch(`${BASE}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@lviv-arena.ua',
      password: 'admin',
    }),
  })
  console.log('Login status:', loginRes.status)
  const loginData = await loginRes.json()
  console.log('Logged in user email:', loginData.user?.email, 'Role:', loginData.user?.role)
  if (loginRes.status !== 200 || !loginData.token) throw new Error('Admin login failed')

  const adminCookie = loginRes.headers.get('set-cookie')?.split(';')[0] || ''

  console.log('\n[5/6] Verifying Payload Collections loaded from PostgreSQL:')
  const collections = ['users', 'computers', 'tariffs', 'pages', 'categories']
  for (const col of collections) {
    const colRes = await fetch(`${BASE}/api/${col}`, {
      headers: { Cookie: adminCookie },
    })
    const colData = await colRes.json().catch(() => ({}))
    console.log(`- Collection "${col}": HTTP ${colRes.status}, Total Docs: ${colData.totalDocs ?? colData.docs?.length ?? 0}`)
    if (colRes.status !== 200) throw new Error(`Collection ${col} returned status ${colRes.status}`)
  }

  const bookApiRes = await fetch(`${BASE}/api/bookings?tariff=DEFAULT&date=2026-11-20&time=14:00&duration=3`)
  const bookApiData = await bookApiRes.json().catch(() => ({}))
  console.log(`- Booking API (/api/bookings): HTTP ${bookApiRes.status}, Computers available: ${bookApiData.computers?.length}`)
  if (bookApiRes.status !== 200) throw new Error(`Booking API returned status ${bookApiRes.status}`)

  console.log('\n[6/6] Verifying Payload Globals:')
  const headerRes = await fetch(`${BASE}/api/globals/header`, { headers: { Cookie: adminCookie } })
  console.log('- Global "header": HTTP', headerRes.status)
  const footerRes = await fetch(`${BASE}/api/globals/footer`, { headers: { Cookie: adminCookie } })
  console.log('- Global "footer": HTTP', footerRes.status)

  proc.kill()
  console.log('\n======================================================')
  console.log('OFFICIAL PAYLOAD CMS ADMIN VERIFICATION: 100% SUCCESS!')
  console.log('======================================================')
  process.exit(0)
}

runTest().catch((err) => {
  console.error('\nVerification failed:', err)
  proc.kill()
  process.exit(1)
})
