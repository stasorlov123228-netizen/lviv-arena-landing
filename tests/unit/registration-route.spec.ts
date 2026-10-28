import { beforeEach, describe, expect, it, vi } from 'vitest'

const payloadMocks = vi.hoisted(() => ({ getPayload: vi.fn() }))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return { ...actual, getPayload: payloadMocks.getPayload }
})

import { POST as registerHandler } from '@/app/api/auth/register/route'

const makeRequest = (body: unknown) => new Request('http://localhost/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

describe('registration route failures', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects invalid email and missing required fields before connecting to the database', async () => {
    const invalidEmail = await registerHandler(makeRequest({
      name: 'Test User', email: 'not-an-email', password: 'safe-password', confirmPassword: 'safe-password',
    }))
    const missingName = await registerHandler(makeRequest({
      email: 'valid@example.com', password: 'safe-password', confirmPassword: 'safe-password',
    }))

    expect(invalidEmail.status).toBe(400)
    expect(missingName.status).toBe(400)
    expect(payloadMocks.getPayload).not.toHaveBeenCalled()
  })

  it('returns a generic 503 when the database is unavailable and does not expose driver details', async () => {
    const dbError = Object.assign(new Error('private database connection detail'), { code: '08006' })
    const execute = vi.fn().mockRejectedValue(dbError)
    payloadMocks.getPayload.mockResolvedValue({ db: { drizzle: { execute } } })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      const response = await registerHandler(makeRequest({
        name: 'Test User', email: 'test@example.com', password: 'safe-password', confirmPassword: 'safe-password',
      }))
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.message).toBeTruthy()
      expect(JSON.stringify(data)).not.toContain('private database connection detail')
      expect(log).toHaveBeenCalledWith('Registration failed:', { code: '08006' })
    } finally {
      log.mockRestore()
    }
  })
})
