import type { Footer, Header, Page, Post } from '../payload-types'
import type { Payload } from 'payload'

export type PublicPayload = Pick<Payload, 'find' | 'findGlobal'>

export interface PublicNavLink {
  label: string
  href: string
  newTab: boolean
}

export interface CommonResponse {
  data: {
    header: { navItems: PublicNavLink[] }
    footer: { navItems: PublicNavLink[] }
  }
}

interface ApiError {
  error: { code: string; message: string }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function referenceHref(value: number | Page | Post | null | undefined, relationTo: 'pages' | 'posts'): string | null {
  if (!isRecord(value) || typeof value.slug !== 'string' || !value.slug) return null
  const slug = value.slug
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) return null
  if ('_status' in value && value._status !== 'published') return null
  return relationTo === 'posts' ? `/news/${slug}` : slug === 'home' ? '/' : `/${slug}`
}

function navLinks(global: Header | Footer): PublicNavLink[] {
  return (global.navItems ?? []).flatMap(({ link }) => {
    const label = link.label.trim()
    if (!label) return []

    let href: string | null = null
    if (link.type === 'custom' && typeof link.url === 'string') {
      const url = link.url.trim()
      if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(url)) href = url
      else if (url.startsWith('/') && !url.startsWith('//')) href = url
      else {
        try {
          const parsed = new URL(url)
          if (parsed.protocol === 'https:' || parsed.protocol === 'http:') href = parsed.href
        } catch {
          href = null
        }
      }
    } else if (link.reference && typeof link.reference === 'object') {
      href = referenceHref(link.reference.value, link.reference.relationTo)
    }

    return href ? [{ label, href, newTab: link.newTab === true }] : []
  })
}

export function errorResponse(status: number, code: string, message: string): Response {
  const body: ApiError = { error: { code, message } }
  return Response.json(body, { status })
}

export function getValidatedPagePath(request: Request): string | null {
  const path = new URL(request.url).searchParams.get('path')
  return path && path === path.trim() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(path) ? path : null
}

export async function getCommonResponse(payload: PublicPayload): Promise<Response> {
  try {
    const [header, footer] = await Promise.all([
      payload.findGlobal({ slug: 'header', depth: 1, overrideAccess: false }),
      payload.findGlobal({ slug: 'footer', depth: 1, overrideAccess: false }),
    ])
    const body: CommonResponse = {
      data: {
        header: { navItems: navLinks(header as Header) },
        footer: { navItems: navLinks(footer as Footer) },
      },
    }
    return Response.json(body)
  } catch {
    return errorResponse(503, 'COMMON_UNAVAILABLE', 'Спільні дані тимчасово недоступні.')
  }
}

export async function getPageResponse(payload: PublicPayload, request: Request): Promise<Response> {
  const path = getValidatedPagePath(request)
  if (!path) {
    return errorResponse(400, 'INVALID_PATH', 'Параметр path відсутній або має некоректний формат.')
  }

  try {
    const result = await payload.find({
      collection: 'pages',
      depth: 2,
      limit: 1,
      overrideAccess: false,
      draft: false,
      where: { and: [{ slug: { equals: path } }, { _status: { equals: 'published' } }] },
    })
    const page = result.docs[0] as Page | undefined
    if (!page || page._status !== 'published') {
      return errorResponse(404, 'PAGE_NOT_FOUND', 'Сторінку не знайдено.')
    }
    return Response.json({ data: page })
  } catch {
    return errorResponse(503, 'PAGE_UNAVAILABLE', 'Сторінка тимчасово недоступна.')
  }
}
