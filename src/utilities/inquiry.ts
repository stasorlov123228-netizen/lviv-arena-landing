export interface InquiryInput {
  kind: 'feedback' | 'partnership'
  name: string
  email: string
  phone: string
  message: string
}

export function validateInquiry(input: Record<string, unknown>): InquiryInput | null {
  const kind = input.kind
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (!['feedback', 'partnership'].includes(String(kind)) || !name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || phone.length > 40 || message.length < 5 || message.length > 5000) return null
  return { kind: kind as InquiryInput['kind'], name, email, phone, message }
}
