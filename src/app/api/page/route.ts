import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { errorResponse, getPageResponse, getValidatedPagePath } from '@/utilities/publicCmsApi'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  if (!getValidatedPagePath(request)) {
    return errorResponse(400, 'INVALID_PATH', 'Параметр path відсутній або має некоректний формат.')
  }
  try {
    const payload = await getPayload({ config: configPromise })
    return await getPageResponse(payload, request)
  } catch {
    return errorResponse(503, 'PAGE_UNAVAILABLE', 'Сторінка тимчасово недоступна.')
  }
}
