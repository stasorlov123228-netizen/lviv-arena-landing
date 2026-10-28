import type { CollectionConfig } from 'payload'

export const Payments: CollectionConfig = {
  slug: 'payments',
  admin: { useAsTitle: 'id', defaultColumns: ['booking', 'amount', 'method', 'status', 'paidAt'] },
  access: {
    read: ({ req }) => req.user?.role === 'admin',
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',

    delete: () => false,
  },
  fields: [
    { name: 'booking', type: 'relationship', relationTo: 'bookings', required: true, unique: true },
    { name: 'amount', type: 'number', required: true, min: 0, admin: { readOnly: true } },
    { name: 'method', type: 'select', required: true, defaultValue: 'cash', options: [{ label: 'Готівка', value: 'cash' }, { label: 'Картка (демо)', value: 'card' }] },
    { name: 'status', type: 'select', required: true, defaultValue: 'unpaid', options: [{ label: 'Не оплачено', value: 'unpaid' }, { label: 'Оплачено', value: 'paid' }] },
    { name: 'isPaid', type: 'checkbox', defaultValue: false, admin: { readOnly: true } },
    { name: 'paidAt', type: 'date' },
  ],
  hooks: {
    beforeChange: [async ({ data, originalDoc, req }) => {
      const relation = data.booking ?? originalDoc?.booking
      const bookingId = typeof relation === 'object' ? relation?.id : relation
      if (!bookingId) throw new Error('Платіж має бути пов’язаний із бронюванням.')
      const booking = await req.payload.findByID({ collection: 'bookings', id: bookingId, overrideAccess: true, depth: 0, req })
      const nextStatus = data.status ?? originalDoc?.status ?? 'unpaid'
      if (booking.status === 'cancelled' && nextStatus === 'paid') throw new Error('Не можна оплатити скасоване бронювання.')
      const tariffResult = await req.payload.find({ collection: 'tariffs', overrideAccess: true, limit: 1, req, where: { name: { equals: booking.tariff } } })
      const price = tariffResult.docs[0]?.pricePerHour
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) throw new Error('Для бронювання не налаштовано тариф.')
      data.status = nextStatus
      data.amount = Math.round(price * Number(booking.duration) * 100) / 100
      data.method = booking.paymentMethod ?? data.method ?? originalDoc?.method ?? 'cash'
      data.isPaid = nextStatus === 'paid'
      data.paidAt = data.isPaid ? (originalDoc?.paidAt || new Date().toISOString()) : null
      return data
    }],
    afterChange: [async ({ doc, req }) => {
      if (!doc.booking) return doc
      const bookingId = typeof doc.booking === 'object' ? doc.booking.id : doc.booking
      const booking = await req.payload.findByID({ collection: 'bookings', id: bookingId, overrideAccess: true, depth: 0, req })
      const status = doc.method === 'card' ? (doc.status === 'paid' ? 'confirmed' : 'new') : undefined
      await req.payload.update({
        collection: 'bookings', id: bookingId,
        overrideAccess: true, req,
        context: { syncPayment: true },
        data: { paymentStatus: doc.status, totalAmount: doc.amount, ...(status && booking.status !== 'cancelled' ? { status } : {}) },
      })
      return doc
    }],
  },
  timestamps: true,
}
