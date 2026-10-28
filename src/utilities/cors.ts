function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`)
    return url.origin
  } catch {
    return null
  }
}

function allowedOrigins(): Set<string> {
  const configured = [
    process.env.NEXT_PUBLIC_SERVER_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    ...(process.env.FRONTEND_URLS ?? '').split(','),
  ]

  return new Set(
    configured
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .map(normalizeOrigin)
      .filter((value): value is string => Boolean(value)),
  )
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers()
  const requestOrigin = request.headers.get('origin')
  const normalizedOrigin = requestOrigin ? normalizeOrigin(requestOrigin) : null

  if (!normalizedOrigin || !allowedOrigins().has(normalizedOrigin)) return headers

  headers.set('Access-Control-Allow-Origin', normalizedOrigin)
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type, Authorization')
  headers.set('Access-Control-Max-Age', '86400')
  headers.set('Vary', 'Origin')

  return headers
}

export function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers)
  const cors = corsHeaders(request)

  cors.forEach((value, key) => headers.set(key, value))

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

export function corsOptions(request: Request): Response {
  const headers = corsHeaders(request)

  if (!headers.has('Access-Control-Allow-Origin')) {
    return new Response(null, { status: 403 })
  }

  return new Response(null, { headers, status: 204 })
}
