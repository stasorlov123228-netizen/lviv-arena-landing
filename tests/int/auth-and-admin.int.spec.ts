
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { getPayload, Payload } from 'payload'
import configPromise from '@/payload.config'
import { Users } from '@/collections/Users'
import { expectedAdminCollectionAccess, expectedAdminGlobalUpdates } from '@/utilities/adminAccessPolicy'
import { POST as registerHandler } from '@/app/api/auth/register/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { GET as meHandler } from '@/app/api/auth/me/route'
import { resetLoginRateLimit } from '@/utilities/auth'
import { POST as changePasswordHandler } from '@/app/api/auth/change-password/route'
import { GET as adminBookingsGet, PATCH as adminBookingsPatch } from '@/app/api/admin/bookings/route'
import { GET as adminComputersGet, PATCH as adminComputersPatch } from '@/app/api/admin/computers/route'
import { GET as adminTariffsGet, PATCH as adminTariffsPatch } from '@/app/api/admin/tariffs/route'
import { GET as adminUsersGet, PATCH as adminUsersPatch, DELETE as adminUsersDelete } from '@/app/api/admin/users/route'

let payload: Payload
const testUserEmail = `test-gamer-${Date.now()}@example.com`
const testUserPassword = 'Test-only-NotARealCredential-42!'
const testAdminEmail = `test-admin-${randomUUID()}@example.com`
const testAdminPassword = `Only-for-this-test-${randomUUID()}!`
const blockedUserEmail = `blocked-${randomUUID()}@example.com`
const blockedUserPassword = `Blocked-test-${randomUUID()}!`
let userCookie = ''
let adminCookie = ''

describe('Auth & Admin System Integration Tests', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: configPromise })

    await payload.create({
      collection: 'users', overrideAccess: true, context: { provisionAdmin: true },
      data: { name: 'Temporary test administrator', email: testAdminEmail, password: testAdminPassword, role: 'admin', isBlocked: false, mustChangePassword: true },
    })
    await payload.create({
      collection: 'users', overrideAccess: true, context: { provisionAdmin: true },
      data: { name: 'Blocked test account', email: blockedUserEmail, password: blockedUserPassword, role: 'user', isBlocked: true },
    })
  })

  afterAll(async () => {

    try {
      await payload.delete({
        collection: 'users',
        where: { email: { in: [testUserEmail, testAdminEmail, blockedUserEmail] } },
      })
    } catch {

    }
  })

  describe('Registration (/api/auth/register)', () => {
    it('creates a new user with role: user and returns auth cookie', async () => {
      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'CyberGamer',
          email: testUserEmail,
          password: testUserPassword,
          confirmPassword: testUserPassword,
        }),
      })

      const res = await registerHandler(req)
      expect(res.status).toBe(201)

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('payload-token=')
      userCookie = setCookie!.split(';')[0]

      const data = await res.json()
      expect(data.user.email).toBe(testUserEmail)
      expect(data.user.role).toBe('user')

      const inDb = await payload.findByID({
        collection: 'users',
        id: data.user.id,
      })
      expect(inDb?.role).toBe('user')
      expect(inDb?.isBlocked).toBe(false)
    })

    it('rejects registration with duplicate email', async () => {
      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Another Gamer',
          email: testUserEmail,
          password: testUserPassword,
          confirmPassword: testUserPassword,
        }),
      })

      const res = await registerHandler(req)
      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.message).toContain('вже зареєстровано')
    })

    it('rejects registration with password shorter than 6 characters', async () => {
      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Short PW',
          email: 'short-pw@example.com',
          password: '123',
          confirmPassword: '123',
        }),
      })

      const res = await registerHandler(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain('8')
    })

    it('rejects registration with mismatched confirmPassword', async () => {
      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Mismatch',
          email: 'mismatch@example.com',
          password: 'password123',
          confirmPassword: 'password999',
        }),
      })

      const res = await registerHandler(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain('не збігаються')
    })
  })

  describe('Login (/api/auth/login)', () => {
    it('puts the current role in Payload auth context and only grants admin access to admins', async () => {
      const adminLogin = await payload.login({
        collection: 'users',
        data: { email: testAdminEmail, password: testAdminPassword },
      })
      const adminAuth = await payload.auth({
        headers: new Headers({ Authorization: `JWT ${adminLogin.token}` }),
      })
      const clientLogin = await payload.login({
        collection: 'users',
        data: { email: testUserEmail, password: testUserPassword },
      })
      const clientAuth = await payload.auth({
        headers: new Headers({ Authorization: `JWT ${clientLogin.token}` }),
      })
      const canAccessAdmin = Users.access?.admin as unknown as (args: {
        req: { user: { id: number; role?: string }; payload: Payload }
      }) => boolean | Promise<boolean>

      expect(adminAuth.user?.role).toBe('admin')
      expect(await canAccessAdmin({ req: { user: adminAuth.user as { id: number; role?: string }, payload } })).toBe(true)

      expect(await canAccessAdmin({ req: { user: { id: Number(adminAuth.user?.id) }, payload } })).toBe(true)
      expect(clientAuth.user?.role).toBe('user')
      expect(await canAccessAdmin({ req: { user: clientAuth.user as { id: number; role?: string }, payload } })).toBe(false)
      expect(await canAccessAdmin({
        req: { user: { id: Number(clientAuth.user?.id), role: 'admin' }, payload },
      })).toBe(false)
      expect(await canAccessAdmin({ req: { user: undefined as never, payload } })).toBe(false)
    })

    it('matches administrator access across collections and editable globals', async () => {
      const adminLogin = await payload.login({
        collection: 'users',
        data: { email: testAdminEmail, password: testAdminPassword },
      })
      const { user } = await payload.auth({
        headers: new Headers({ Authorization: `JWT ${adminLogin.token}` }),
      })
      expect(user?.role).toBe('admin')

      for (const [slug, operations] of Object.entries(expectedAdminCollectionAccess)) {
        const collection = payload.config.collections.find((item) => item.slug === slug)
        expect(collection, `Missing configured collection ${slug}`).toBeTruthy()
        for (const [operation, expected] of Object.entries(operations)) {
          const access = collection?.access?.[operation as 'read' | 'create' | 'update' | 'delete']
          expect(typeof access, `Missing ${slug}.${operation} access function`).toBe('function')
          const result = await (access as (args: unknown) => unknown)({ req: { user, payload } })
          expect(result, `${slug}.${operation}`).toBe(expected)
        }
      }

      for (const slug of expectedAdminGlobalUpdates) {
        const global = payload.config.globals.find((item) => item.slug === slug)
        expect(global, `Missing configured global ${slug}`).toBeTruthy()
        const access = global?.access?.update
        expect(typeof access, `${slug}.update access function`).toBe('function')
        expect(await (access as (args: unknown) => unknown)({ req: { user, payload } }), `${slug}.update`).toBe(true)
      }
    })

    it('authenticates the isolated test administrator', async () => {
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: testAdminEmail,
          password: testAdminPassword,
        }),
      })

      const res = await loginHandler(req)
      expect(res.status).toBe(200)

      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('payload-token=')
      adminCookie = setCookie!.split(';')[0]

      const data = await res.json()
      expect(data.user.role).toBe('admin')
      expect(data.mustChangePassword).toBe(true)
    })

    it('authenticates user using email and password', async () => {
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUserEmail,
          password: testUserPassword,
        }),
      })

      const res = await loginHandler(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.user.role).toBe('user')
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('payload-token=')
      const loginCookie = setCookie!.split(';')[0]
      const session = await meHandler(new Request('http://localhost/api/auth/me', { headers: { Cookie: loginCookie } }))
      expect((await session.json()).user.email).toBe(testUserEmail)
    })

    it('rejects invalid password with HTTP 401', async () => {
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: testAdminEmail,
          password: 'wrong-password',
        }),
      })

      const res = await loginHandler(req)
      expect(res.status).toBe(401)
    })

    it('rejects a nonexistent account with HTTP 401', async () => {
      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: `missing-${randomUUID()}@example.com`, password: 'not-a-real-password' }),
      })
      const res = await loginHandler(req)
      expect(res.status).toBe(401)
      expect(await res.text()).not.toContain('missing-')
    })

    it('rejects malformed and incomplete login payloads with HTTP 400', async () => {
      const malformed = await loginHandler(new Request('http://localhost/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
      }))
      const incomplete = await loginHandler(new Request('http://localhost/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: ' ', password: '' }),
      }))
      const nonObject = await loginHandler(new Request('http://localhost/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null',
      }))
      expect(malformed.status).toBe(400)
      expect(incomplete.status).toBe(400)
      expect(nonObject.status).toBe(400)
    })

    it('denies login for a blocked account before issuing an auth cookie', async () => {
      resetLoginRateLimit('127.0.0.1')
      const res = await loginHandler(new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: blockedUserEmail, password: blockedUserPassword }),
      }))
      expect(res.status).toBe(403)
      expect(res.headers.get('set-cookie')).toBeNull()
    })
  })

  describe('Session State (/api/auth/me)', () => {
    it('returns null user for unauthenticated guest', async () => {
      const req = new Request('http://localhost/api/auth/me')
      const res = await meHandler(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.user).toBeNull()
    })

    it('returns current user when valid cookie is provided', async () => {
      const req = new Request('http://localhost/api/auth/me', {
        headers: { Cookie: userCookie },
      })
      const res = await meHandler(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.user).toBeTruthy()
      expect(data.user.email).toBe(testUserEmail)
      expect(data.user.role).toBe('user')
    })
  })

  describe('Password Change (/api/auth/change-password)', () => {
    it('rejects setting password to "admin"', async () => {
      const req = new Request('http://localhost/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          newPassword: 'admin',
          confirmPassword: 'admin',
        }),
      })

      const res = await changePasswordHandler(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toContain('заборонено')
    })
  })

  describe('Access Control & Admin Endpoints', () => {
    it('denies unauthenticated access to /api/admin/bookings with 401', async () => {
      const req = new Request('http://localhost/api/admin/bookings')
      const res = await adminBookingsGet(req)
      expect(res.status).toBe(401)
    })

    it('denies regular user access to /api/admin/bookings with 403', async () => {
      const req = new Request('http://localhost/api/admin/bookings', {
        headers: { Cookie: userCookie },
      })
      const res = await adminBookingsGet(req)
      expect(res.status).toBe(403)
    })

    it('allows admin to access /api/admin/bookings', async () => {
      const req = new Request('http://localhost/api/admin/bookings', {
        headers: { Cookie: adminCookie },
      })
      const res = await adminBookingsGet(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(Array.isArray(data.docs)).toBe(true)
    })

    it('allows admin to access /api/admin/computers and see 70 computers', async () => {
      const req = new Request('http://localhost/api/admin/computers', {
        headers: { Cookie: adminCookie },
      })
      const res = await adminComputersGet(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.docs.length).toBeGreaterThanOrEqual(70)
    })

    it('allows admin to access /api/admin/tariffs', async () => {
      const req = new Request('http://localhost/api/admin/tariffs', {
        headers: { Cookie: adminCookie },
      })
      const res = await adminTariffsGet(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.docs.length).toBeGreaterThanOrEqual(4)
    })

    it('allows admin to access /api/admin/users', async () => {
      const req = new Request('http://localhost/api/admin/users', {
        headers: { Cookie: adminCookie },
      })
      const res = await adminUsersGet(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.docs.length).toBeGreaterThanOrEqual(2)

      data.docs.forEach((u: Record<string, unknown>) => {
        expect(u.hash).toBeUndefined()
        expect(u.salt).toBeUndefined()
        expect(u.password).toBeUndefined()
      })
    })

    it('prevents demoting or deleting the last active admin', async () => {

      const admins = await payload.find({
        collection: 'users',
        where: { role: { equals: 'admin' } },
      })
      expect(admins.docs.length).toBeGreaterThanOrEqual(1)
      const adminId = admins.docs[0].id

      if (admins.docs.length === 1) {
        const patchReq = new Request('http://localhost/api/admin/users', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: adminCookie,
          },
          body: JSON.stringify({
            id: adminId,
            role: 'user',
          }),
        })
        const patchRes = await adminUsersPatch(patchReq)
        expect(patchRes.status).toBe(400)

        const delReq = new Request(`http://localhost/api/admin/users?id=${adminId}`, {
          method: 'DELETE',
          headers: { Cookie: adminCookie },
        })
        const delRes = await adminUsersDelete(delReq)
        expect(delRes.status).toBe(400)
      }
    })

    it('allows admin to update computer status in PostgreSQL', async () => {
      const pc1 = await payload.find({
        collection: 'computers',
        where: { computerNumber: { equals: 'PC-01' } },
        limit: 1,
      })
      expect(pc1.docs.length).toBe(1)
      const pcId = pc1.docs[0].id

      const patchReq = new Request('http://localhost/api/admin/computers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          id: pcId,
          status: 'occupied',
        }),
      })

      const patchRes = await adminComputersPatch(patchReq)
      expect(patchRes.status).toBe(200)

      const updated = await payload.findByID({
        collection: 'computers',
        id: pcId,
      })
      expect(updated?.status).toBe('occupied')

      await payload.update({
        collection: 'computers',
        id: pcId,
        data: { status: 'available' },
      })
    })

    it('allows admin to update tariff price and activity', async () => {
      const tariffs = await payload.find({
        collection: 'tariffs',
        where: { name: { equals: 'DEFAULT' } },
        limit: 1,
      })
      expect(tariffs.docs.length).toBe(1)
      const tariffId = tariffs.docs[0].id

      const patchReq = new Request('http://localhost/api/admin/tariffs', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          id: tariffId,
          pricePerHour: 95,
        }),
      })

      const patchRes = await adminTariffsPatch(patchReq)
      expect(patchRes.status).toBe(200)

      const updated = await payload.findByID({
        collection: 'tariffs',
        id: tariffId,
      })
      expect(updated?.pricePerHour).toBe(95)

      await payload.update({
        collection: 'tariffs',
        id: tariffId,
        data: { pricePerHour: 80 },
      })
    })
  })
})
