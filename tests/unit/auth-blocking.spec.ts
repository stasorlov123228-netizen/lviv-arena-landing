import { beforeEach, describe, expect, it, vi } from 'vitest'

const payloadMock = vi.hoisted(() => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return { ...actual, getPayload: payloadMock.getPayload }
})

import { getCurrentUser } from '@/utilities/auth'
import { POST as login } from '@/app/api/auth/login/route'

describe('blocked account access', () => {
  const execute = vi.fn()
  const payload = {
    auth: vi.fn(),
    login: vi.fn(),
    db: { drizzle: { execute } },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    payloadMock.getPayload.mockResolvedValue(payload)
    payload.auth.mockResolvedValue({ user: { id: 9, email: 'blocked@example.test', role: 'admin' } })
    payload.login.mockResolvedValue({ user: { id: 9, email: 'blocked@example.test', role: 'admin' }, token: 'mock-token' })
  })

  it('denies an existing session immediately after the account is blocked', async () => {
    execute.mockResolvedValue({ rows: [{ id: 9, email: 'blocked@example.test', name: 'Blocked', role: 'admin', is_blocked: true }] })
    const user = await getCurrentUser(new Request('http://localhost/api/admin/bookings', { headers: { Cookie: 'payload-token=test-token' } }))
    expect(user).toBeNull()
  })

  it('continues to authorize an active account using current database role data', async () => {
    execute.mockResolvedValue({ rows: [{ id: 9, email: 'admin@example.test', name: 'Admin', role: 'admin', is_blocked: false, must_change_password: false }] })
    const user = await getCurrentUser(new Request('http://localhost/api/admin/bookings', { headers: { Cookie: 'payload-token=test-token' } }))
    expect(user).toMatchObject({ id: 9, role: 'admin', isBlocked: false })
  })

  it('does not issue a login cookie to an account that is blocked in PostgreSQL', async () => {
    execute.mockResolvedValue({ rows: [{ is_blocked: true }] })
    const response = await login(new Request('http://localhost/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': '203.0.113.91' },
      body: JSON.stringify({ login: 'blocked@example.test', password: 'mock-password' }),
    }))
    expect(response.status).toBe(403)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect((await response.json()).message).toContain('заблоковано')
  })
})
