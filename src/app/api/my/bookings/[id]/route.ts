import { getMyBookingById, patchMyBooking, deleteMyBooking } from '../byId'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Context) {
  const { id } = await params
  return getMyBookingById(request, id)
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params
  return patchMyBooking(request, id)
}

export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params
  return deleteMyBooking(request, id)
}
