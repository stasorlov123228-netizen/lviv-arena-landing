import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentUser } from '@/utilities/auth'
import { getBookingRange, isValidBookingDate, isValidBookingDuration, isValidBookingTime } from '@/utilities/booking'

const json = (message: string, status: number) => Response.json({ message }, { status })

export async function GET(request: Request) {
  const user = await getCurrentUser(request)
  if (!user) return json('Увійдіть, щоб переглянути бронювання.', 401)
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'bookings', overrideAccess: true, depth: 0, limit: 100, sort: '-createdAt',
    where: { user: { equals: user.id } },
  })
  return Response.json({ docs: result.docs })
}

