import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { errorResponse, getCommonResponse } from '@/utilities/publicCmsApi'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })
    return await getCommonResponse(payload)
  } catch {
    return errorResponse(503, 'COMMON_UNAVAILABLE', 'Спільні дані тимчасово недоступні.')
  }
}
