import { getPayload } from 'payload'
import config from '@payload-config'
import { validateInquiry } from '@/utilities/inquiry'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ message: 'Некоректний JSON.' }, { status: 400 })
  }

  const inquiry = validateInquiry(body)
  if (!inquiry) {
    return Response.json({ message: 'Перевірте тип звернення, ім’я, email, телефон і повідомлення (5–5000 символів).' }, { status: 400 })
  }

  try {
    const payload = await getPayload({ config })
    const doc = await payload.create({ collection: 'inquiries', overrideAccess: true, data: { ...inquiry, status: 'new' } })
    return Response.json({ id: doc.id, message: 'Повідомлення надіслано.' }, { status: 201 })
  } catch (error) {
    console.error('Inquiry creation failed:', error)
    return Response.json({ message: 'Не вдалося надіслати повідомлення. Спробуйте пізніше.' }, { status: 503 })
  }
}
