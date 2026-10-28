
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { Server } from 'http'
import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { createServer } from '@/server'

let server: Server
let baseUrl = ''
let adminCookie = ''
let clientCookie = ''
let inquiryEmail = ''
const adminEmail = `express-admin-${randomUUID()}@example.com`
const adminPassword = `Safe-test-${randomUUID()}!`
const clientEmail = `express-user-${randomUUID()}@example.com`
const logoutEmail = `express-logout-${randomUUID()}@example.com`

describe('Express Server Integration Tests (Zero-React Server)', () => {
  beforeAll(async () => {
    const payload = await getPayload({ config })
    await payload.create({ collection: 'users', overrideAccess: true, context: { provisionAdmin: true }, data: { name: 'Express test admin', email: adminEmail, password: adminPassword, role: 'admin', isBlocked: false } })
    const app = await createServer()
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address()
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://localhost:${addr.port}`
        }
        resolve()
      })
    })
  })

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'users', where: { email: { equals: adminEmail } } }).catch(() => undefined)
    await payload.delete({ collection: 'users', where: { email: { equals: clientEmail } } }).catch(() => undefined)
    await payload.delete({ collection: 'users', where: { email: { equals: logoutEmail } } }).catch(() => undefined)
    if (inquiryEmail) await payload.delete({ collection: 'inquiries', where: { email: { equals: inquiryEmail } } }).catch(() => undefined)
  })

  describe('Static Assets', () => {
    it('serves /site.css with 200 OK and text/css', async () => {
      const res = await fetch(`${baseUrl}/site.css`)
      expect(res.status).toBe(200)
      const css = await res.text()
      expect(css).toContain('--accent-lime')
    })

    it('serves /booking.js with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/booking.js`)
      expect(res.status).toBe(200)
      const js = await res.text()
      expect(js).toContain('DOMContentLoaded')
    })
  })

  describe('Page Routing (Pure HTML / Vanilla JS)', () => {
    it('serves Home Page / with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/`)
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('LVIV ARENA')
      expect(html).toContain('70')
      expect(html).toContain('ігрових місць')
      expect(html).toContain('/booking')
    })

    it('serves Booking Page /booking with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/booking`)
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Бронювання')
      expect(html).toContain('booking-form')
    })

    it('serves Login Page /login with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/login`)
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Вхід до особистого кабінету')
      expect(html).toContain('login-form')
    })

    it('serves Register Page /register with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/register`)
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('Реєстрація акаунта')
      expect(html).toContain('register-form')
    })

    it('serves feedback and partnership forms without requiring CMS copy', async () => {
      for (const path of ['/feedback', '/partnership']) {
        const res = await fetch(`${baseUrl}${path}`)
        expect(res.status).toBe(200)
        const html = await res.text()
        expect(html).toContain('data-inquiry=')
        expect(html).toContain('/inquiry.js')
      }
    })

    it('redirects unauthenticated user from /dashboard to /login', async () => {
      const res = await fetch(`${baseUrl}/dashboard`, { redirect: 'manual' })
      expect([301, 302]).toContain(res.status)
      expect(res.headers.get('location')).toContain('/login?redirect=/dashboard')
    })

    it('serves 404 page for unknown routes', async () => {
      const res = await fetch(`${baseUrl}/some-unknown-path`)
      expect(res.status).toBe(404)
      const html = await res.text()
      expect(html).toContain('Сторінку не знайдено')
    })
  })

  describe('APIs & Auth via Express', () => {
    it('returns the available computer count from /api/bookings without exposing inventory numbers', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' })
      const res = await fetch(
        `${baseUrl}/api/bookings?tariff=DEFAULT&date=${tomorrow}&time=14:00&duration=2`,
      )
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.category).toBe('STANDART')
      expect(typeof data.availableCount).toBe('number')
      expect(data.availableCount).toBeGreaterThan(0)
      expect(data).not.toHaveProperty('computers')
    })

    it('authenticates admin via POST /api/auth/login and receives auth cookie', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: adminEmail,
          password: adminPassword,
        }),
      })

      expect(res.status).toBe(200)
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('payload-token=')
      adminCookie = setCookie!.split(';')[0]

      const data = await res.json()
      expect(data.user.role).toBe('admin')
    })

    it('creates a normal user and stores its cookie for access checks', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'HTTP test client', email: clientEmail, password: 'client-pass-123', confirmPassword: 'client-pass-123' }) })
      expect(res.status).toBe(201)
      clientCookie = res.headers.get('set-cookie')!.split(';')[0]
    })

    it('logs in the registered client and opens the personal dashboard with the returned cookie', async () => {
      const login = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: clientEmail, password: 'client-pass-123' }),
      })
      expect(login.status).toBe(200)
      const loginCookie = login.headers.get('set-cookie')?.split(';')[0]
      expect(loginCookie).toContain('payload-token=')

      const dashboard = await fetch(`${baseUrl}/dashboard`, { headers: { Cookie: loginCookie! } })
      expect(dashboard.status).toBe(200)
      expect(await dashboard.text()).toContain('client-dashboard.js')
    })

    it('revokes the authenticated session on logout', async () => {
      const registration = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Logout test client', email: logoutEmail, password: 'logout-pass-123', confirmPassword: 'logout-pass-123' }) })
      expect(registration.status).toBe(201)
      const logoutCookie = registration.headers.get('set-cookie')!.split(';')[0]
      const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { Cookie: logoutCookie } })
      expect(logout.status).toBe(200)
      expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
      const staleCookie = await fetch(`${baseUrl}/api/my/bookings`, { headers: { Cookie: logoutCookie } })
      expect(staleCookie.status).toBe(401)
    })

    it('persists valid feedback and partnership inquiries and rejects invalid form data', async () => {
      const invalid = await fetch(`${baseUrl}/api/inquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'feedback', name: '', email: 'bad', message: 'x' }) })
      expect(invalid.status).toBe(400)
      inquiryEmail = `inquiry-${randomUUID()}@example.com`
      const saved = await fetch(`${baseUrl}/api/inquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'partnership', name: 'Test Partner', email: inquiryEmail, message: 'Please contact our team.' }) })
      expect(saved.status).toBe(201)
      const payload = await getPayload({ config })
      const rows = await payload.find({ collection: 'inquiries', where: { email: { equals: inquiryEmail } }, limit: 1 })
      expect(rows.docs[0]).toMatchObject({ kind: 'partnership', name: 'Test Partner', status: 'new' })
    })

    it('checks guest, client, and admin access over HTTP for every administrative API method', async () => {
      const endpoints = [
        { path: '/api/admin/bookings', methods: ['GET', 'PATCH', 'DELETE'] },
        { path: '/api/admin/computers', methods: ['GET', 'PATCH', 'POST'] },
        { path: '/api/admin/tariffs', methods: ['GET', 'PATCH', 'POST'] },
        { path: '/api/admin/users', methods: ['GET', 'PATCH', 'DELETE'] },
      ]
      for (const { path, methods } of endpoints) for (const method of methods) {
        const options = (cookie?: string) => ({ method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}) }, ...(method !== 'GET' && method !== 'DELETE' ? { body: '{}' } : {}) })
        const guest = await fetch(`${baseUrl}${path}`, options())
        expect(guest.status, `guest ${method} ${path}`).toBe(401)
        const client = await fetch(`${baseUrl}${path}`, options(clientCookie))
        expect(client.status, `client ${method} ${path}`).toBe(403)
        const admin = await fetch(`${baseUrl}${path}`, options(adminCookie))
        expect(admin.status, `admin ${method} ${path}`).toBe(method === 'GET' ? 200 : 400)
      }
      const guestPage = await fetch(`${baseUrl}/club-admin`, { redirect: 'manual' })
      expect(guestPage.status).toBe(302)
      const clientPage = await fetch(`${baseUrl}/club-admin`, { headers: { Cookie: clientCookie } })
      expect(clientPage.status).toBe(403)
      const adminPage = await fetch(`${baseUrl}/club-admin`, { headers: { Cookie: adminCookie } })
      expect(adminPage.status).toBe(200)
      expect(await adminPage.text()).toContain('bookings-table')
      const payloadAdmin = await fetch(`${baseUrl}/admin`, { redirect: 'manual' })
      expect(payloadAdmin.status).toBe(302)
      expect(payloadAdmin.headers.get('location')).toContain('localhost:3100/admin')
    })

    it('persists an authorized club-admin change and restores the test computer', async () => {
      const payload = await getPayload({ config })
      const found = await payload.find({ collection: 'computers', where: { computerNumber: { equals: 'PC-70' } }, limit: 1 })
      expect(found.docs).toHaveLength(1)
      const computer = found.docs[0]
      const update = (status: string, cookie?: string) => fetch(`${baseUrl}/api/admin/computers`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify({ id: computer.id, status }),
      })
      const denied = await update('maintenance', clientCookie)
      expect(denied.status).toBe(403)
      const changed = await update('maintenance', adminCookie)
      expect(changed.status).toBe(200)
      expect((await payload.findByID({ collection: 'computers', id: computer.id, overrideAccess: true })).status).toBe('maintenance')
      const restored = await update(String(computer.status || 'available'), adminCookie)
      expect(restored.status).toBe(200)
    })

    it('allows admin to access /dashboard with auth cookie', async () => {
      const res = await fetch(`${baseUrl}/dashboard`, {
        headers: { Cookie: adminCookie },
      })
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('profile-form')
      expect(html).toContain('client-dashboard.js')
    })

    it('returns current user session via GET /api/auth/me', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: adminCookie },
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.user).toBeTruthy()
      expect(data.user.role).toBe('admin')
    })

    it('allows admin to fetch computers via GET /api/admin/computers', async () => {
      const res = await fetch(`${baseUrl}/api/admin/computers`, {
        headers: { Cookie: adminCookie },
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.docs.length).toBeGreaterThanOrEqual(70)
    })
  })
})

