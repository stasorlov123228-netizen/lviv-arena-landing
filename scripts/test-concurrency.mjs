import { spawn } from 'node:child_process'
import dotenv from 'dotenv'

dotenv.config()

const PORT = 3095
const BASE = `http://localhost:${PORT}`

console.log('Testing concurrency with 5 parallel requests on port', PORT)
const server = spawn('node', ['dist/server.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let stdout = ''
server.stdout.on('data', (d) => { stdout += d.toString() })

for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 400))
  if (stdout.includes(`http://localhost:${PORT}`)) break
}

const testPc = 'PC-25'
const testDate = '2026-12-01'
const testTime = '16:00'

console.log(`Sending 5 simultaneous bookings for ${testPc} on ${testDate} at ${testTime}...`)

const requests = Array.from({ length: 5 }, (_, i) =>
  fetch(`${BASE}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Concurrent_Gamer_${i + 1}`,
      phone: `+38067111223${i}`,
      tariff: 'DEFAULT',
      computer: testPc,
      date: testDate,
      time: testTime,
      duration: 2,
    }),
  }).then(async (res) => ({
    index: i + 1,
    status: res.status,
    data: await res.json().catch(() => ({})),
  }))
)

const results = await Promise.all(requests)
server.kill()

console.log('Concurrency results:')
for (const r of results) {
  console.log(`Request #${r.index}: HTTP ${r.status}`)
}

const successCount = results.filter((r) => r.status === 201).length
const conflictCount = results.filter((r) => r.status === 409).length

console.log(`Successes: ${successCount}, Conflicts (409): ${conflictCount}`)

if (successCount === 1 && conflictCount === 4) {
  console.log('CONCURRENCY TEST PASSED: Exactly 1 booking succeeded and 4 were rejected with 409!')
} else {
  console.error('CONCURRENCY TEST FAILED!')
  process.exit(1)
}

