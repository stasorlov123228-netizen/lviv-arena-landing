import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { errorResponse, getCommonResponse } from '@/utilities/publicCmsApi'
import { corsOptions, withCors } from '@/utilities/cors'

export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })
    return withCors(request, await getCommonResponse(payload))
  } catch {
    return errorResponse(503, 'COMMON_UNAVAILABLE', 'Спільні дані тимчасово недоступні.')
  }
}
