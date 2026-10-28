import { getCurrentUser } from '@/utilities/auth'

export async function GET(request: Request) {
  const user = await getCurrentUser(request)

  if (!user) {
    return Response.json({ user: null }, { status: 200 })
  }

  return Response.json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        role: user.role,
        mustChangePassword: Boolean(user.mustChangePassword),
      },
    },
    { status: 200 },
  )
}

