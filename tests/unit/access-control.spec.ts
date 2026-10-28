import { describe, expect, it } from 'vitest'
import { Users } from '@/collections/Users'
import { Bookings } from '@/collections/Bookings'
import { Payments } from '@/collections/Payments'
import { Pages } from '@/collections/Pages'
import { Posts } from '@/collections/Posts'
import { Categories } from '@/collections/Categories'
import { Media } from '@/collections/Media'
import { Header } from '@/Header/config'
import { Footer } from '@/Footer/config'
import { Inquiries } from '@/collections/Inquiries'
import { validateInquiry } from '@/utilities/inquiry'

const access = (fn: unknown, user: unknown) => (fn as (args: { req: { user: unknown; payload: { findByID: () => Promise<unknown> } } }) => unknown)({ req: { user, payload: { findByID: async () => user } } })

describe('collection access boundaries', () => {
  it('limits client reads to the current active user and denies guests or blocked accounts', async () => {
    expect(await access(Users.access?.read, null)).toBe(false)
    expect(await access(Users.access?.read, { id: 12, role: 'user', isBlocked: false })).toEqual({ id: { equals: 12 } })
    expect(await access(Users.access?.read, { id: 12, role: 'admin', isBlocked: false })).toBe(true)
    expect(await access(Users.access?.read, { id: 12, role: 'admin', isBlocked: true })).toBe(false)
  })

  it('does not allow direct client creation or mutation of bookings', () => {
    expect(access(Bookings.access?.create, null)).toBe(false)
    expect(access(Bookings.access?.create, { id: 2, role: 'user' })).toBe(false)
    expect(access(Bookings.access?.create, { id: 3, role: 'admin' })).toBe(true)
    expect(access(Bookings.access?.update, { id: 2, role: 'user' })).toBe(false)
    expect(access(Bookings.access?.update, { id: 3, role: 'admin' })).toBe(true)
  })

  it('keeps payments private to administrators', () => {
    expect(access(Payments.access?.read, null)).toBe(false)
    expect(access(Payments.access?.read, { id: 2, role: 'user' })).toBe(false)
    expect(access(Payments.access?.read, { id: 3, role: 'admin' })).toBe(true)
    expect(access(Payments.access?.create, { id: 3, role: 'admin' })).toBe(true)
    expect(access(Payments.access?.update, { id: 3, role: 'admin' })).toBe(true)
    expect(access(Payments.access?.delete, { id: 3, role: 'admin' })).toBe(false)
    expect(access(Payments.access?.delete, { id: 2, role: 'user' })).toBe(false)
  })

  it('allows public inquiry submission only through the validated endpoint', () => {
    expect(access(Inquiries.access?.create, null)).toBe(false)
    expect(access(Inquiries.access?.read, { id: 5, role: 'user' })).toBe(false)
    expect(access(Inquiries.access?.read, { id: 6, role: 'admin' })).toBe(true)
    expect(validateInquiry({ kind: 'feedback', name: 'Test Client', email: 'TEST@example.com', message: 'A valid message' })).toEqual({ kind: 'feedback', name: 'Test Client', email: 'test@example.com', phone: '', message: 'A valid message' })
    expect(validateInquiry({ kind: 'feedback', name: '', email: 'bad', message: 'x' })).toBeNull()
    expect(validateInquiry({ kind: 'admin', name: 'Test', email: 'test@example.com', message: 'A valid message' })).toBeNull()
  })

  it('prevents clients from managing CMS content and limits them to published pages', () => {
    const client = { id: 8, role: 'user' }
    expect(access(Pages.access?.create, client)).toBe(false)
    expect(access(Posts.access?.update, client)).toBe(false)
    expect(access(Categories.access?.delete, client)).toBe(false)
    expect(access(Media.access?.create, client)).toBe(false)
    expect(access(Pages.access?.read, client)).toEqual({ _status: { equals: 'published' } })
    expect(access(Pages.access?.create, { id: 1, role: 'admin' })).toBe(true)
    expect(access(Header.access?.update, client)).toBe(false)
    expect(access(Footer.access?.update, { id: 1, role: 'admin' })).toBe(true)
  })

  it('forces public user creation to the user role', async () => {
    const hook = Users.hooks?.beforeChange?.[0] as (args: unknown) => Promise<Record<string, unknown>>
    const data = { name: 'Client', role: 'admin', isBlocked: true, mustChangePassword: true }
    const result = await hook({ data, operation: 'create', req: { user: null }, context: {} })
    expect(result).toMatchObject({ role: 'user', isBlocked: false, mustChangePassword: false })
  })
})
