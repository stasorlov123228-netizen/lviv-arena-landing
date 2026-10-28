import { createLocalReq, getPayload, logoutOperation } from 'payload'
import config from '@payload-config'
import { clearAuthCookieHeader } from '@/utilities/auth'

export async function POST(request?: Request) {
  const headers = new Headers({
    'Content-Type': 'application/json',
  })
  if (request) {
    try {
      const payload = await getPayload({ config })
      const { user } = await payload.auth({ headers: request.headers })
      if (user) {
        const req = await createLocalReq({ req: { headers: request.headers }, user }, payload)
        await logoutOperation({ collection: payload.collections.users, req })
      }
    } catch {
      return Response.json({ message: 'Не вдалося завершити сесію. Спробуйте знову.' }, { status: 400 })
    }
  }
  headers.append('Set-Cookie', clearAuthCookieHeader())

  return new Response(
    JSON.stringify({ message: 'Ви успішно вийшли з системи.' }),
    { status: 200, headers },
  )
}

