import { describe, expect, it, vi } from 'vitest'
import type { Page } from '@/payload-types'
import {
  getCommonResponse,
  getPageResponse,
  type PublicPayload,
} from '@/utilities/publicCmsApi'

function payloadMock(overrides: Partial<PublicPayload> = {}): PublicPayload {
  return {
    findGlobal: vi.fn(async ({ slug }: { slug: 'header' | 'footer' }) => ({
      id: 1,
      navItems: [{ link: { type: 'custom', url: `/${slug}`, label: slug } }],
    })) as unknown as PublicPayload['findGlobal'],
    find: vi.fn(async () => ({ docs: [] })) as unknown as PublicPayload['find'],
    ...overrides,
  }
}

function responseRequest(path?: string): Request {
  const url = new URL('http://localhost/api/page')
  if (path !== undefined) url.searchParams.set('path', path)
  return new Request(url)
}

describe('public CMS API', () => {
  it('returns public header and footer navigation in a stable shape', async () => {
    const payload = payloadMock()
    const response = await getCommonResponse(payload)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      data: {
        header: { navItems: [{ label: 'header', href: '/header', newTab: false }] },
        footer: { navItems: [{ label: 'footer', href: '/footer', newTab: false }] },
      },
    })
    expect(payload.findGlobal).toHaveBeenCalledWith({ slug: 'header', depth: 1, overrideAccess: false })
    expect(payload.findGlobal).toHaveBeenCalledWith({ slug: 'footer', depth: 1, overrideAccess: false })
  })

  it('returns a sanitized service error when globals cannot be read', async () => {
    const payload = payloadMock({
      findGlobal: vi.fn().mockRejectedValue(new Error('private database details')) as unknown as PublicPayload['findGlobal'],
    })
    const response = await getCommonResponse(payload)

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'COMMON_UNAVAILABLE', message: 'Спільні дані тимчасово недоступні.' } })
  })

  it('returns a published page with its typed content and explicitly excludes drafts', async () => {
    const page = { id: 9, title: 'Про клуб', slug: 'about', hero: { type: 'none' }, layout: [], _status: 'published', updatedAt: '2026-10-26T00:00:00.000Z', createdAt: '2026-10-26T00:00:00.000Z' } satisfies Page
    const find = vi.fn().mockResolvedValue({ docs: [page] }) as unknown as PublicPayload['find']
    const response = await getPageResponse(payloadMock({ find }), responseRequest('about'))

    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual(page)
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'pages',
      overrideAccess: false,
      draft: false,
      where: { and: [{ slug: { equals: 'about' } }, { _status: { equals: 'published' } }] },
    }))
  })

  it('returns 404 when the page does not exist', async () => {
    const response = await getPageResponse(payloadMock(), responseRequest('missing'))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: { code: 'PAGE_NOT_FOUND', message: 'Сторінку не знайдено.' } })
  })

  it.each([undefined, '', '../private', 'a/b', '  about', 'about '])('returns 400 for missing or invalid path %s', async (path) => {
    const find = vi.fn() as unknown as PublicPayload['find']
    const response = await getPageResponse(payloadMock({ find }), responseRequest(path))
    expect(response.status).toBe(400)
    expect(find).not.toHaveBeenCalled()
  })

  it('never returns a draft even if a mocked query unexpectedly includes one', async () => {
    const draft = { id: 7, title: 'Draft', slug: 'about', hero: { type: 'none' }, layout: [], _status: 'draft', updatedAt: '2026-10-26T00:00:00.000Z', createdAt: '2026-10-26T00:00:00.000Z' } satisfies Page
    const find = vi.fn().mockResolvedValue({ docs: [draft] }) as unknown as PublicPayload['find']
    const response = await getPageResponse(payloadMock({ find }), responseRequest('about'))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: { code: 'PAGE_NOT_FOUND', message: 'Сторінку не знайдено.' } })
  })
})
