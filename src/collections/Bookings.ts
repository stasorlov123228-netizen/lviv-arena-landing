import { APIError, ValidationError, type CollectionConfig } from 'payload'
import { getBookingRange, isBookingCategory, isBookingTariff, isValidBookingDuration } from '@/utilities/booking'
import { calculateBookingTotal } from '@/utilities/money'

const bookingConflictMessage =
  'Цей комп’ютер уже заброньовано на вибраний час. Оберіть інший комп’ютер або час'

const hasBookingConflict = (error: Error): boolean => {
  const visited = new Set<object>()
  let current: unknown = error

  while (typeof current === 'object' && current !== null && !visited.has(current)) {
    visited.add(current)

    if (
      'code' in current &&
      current.code === '23P01' &&
      'constraint' in current &&
      current.constraint === 'bookings_no_overlapping_computer'
    ) {
      return true
    }

    current = 'cause' in current ? current.cause : undefined
  }

  return false
}

export const handleBookingAfterError = ({
  error,
  result,
}: {
  error: Error
  result?: {
    errors: { field?: string; message?: string; name?: string }[]
    message?: string
  }
}) => {
  if (hasBookingConflict(error)) {
    return {
      status: 409,
      response: {
        message: bookingConflictMessage,
        errors: [
          {
            field: 'computer',
            message: bookingConflictMessage,
          },
        ],
      },
    }
  }

  if (
    typeof error === 'object' &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status < 500
  ) {
    return {
      status: error.status,
      response: {
        message: result?.message,
        errors:
          result?.errors.map(({ field, message, name }) => ({
            ...(field ? { field } : {}),
            ...(message ? { message } : {}),
            ...(name ? { name } : {}),
          })) ?? [],
      },
    }
  }

  return {
    status: 500,
    response: {
      message: 'Не вдалося створити бронювання через помилку сервера.',
      errors: [],
    },
  }
}

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  labels: {
    singular: 'Бронювання',
    plural: 'Бронювання',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name',
      'email',
      'phone',
      'computerCategory',
      'computer',
      'tariff',
      'date',
      'time',
      'status',
    ],
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin' || (req.user ? { user: { equals: req.user.id } } : false),

    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  hooks: {
    afterError: [handleBookingAfterError],
    beforeChange: [
      async ({ data, operation, originalDoc, req, context }) => {
        if (data.paymentStatus !== undefined && context?.syncPayment !== true && data.paymentStatus !== originalDoc?.paymentStatus && !(operation === 'create' && data.paymentStatus === 'unpaid')) {
          throw new ValidationError({ collection: 'bookings', errors: [{ path: 'paymentStatus', message: 'Статус оплати змінюється тільки через пов’язаний платіж.' }], req })
        }
        if (operation === 'update' && originalDoc?.paymentStatus === 'paid' && context?.syncPayment !== true) {
          throw new ValidationError({ collection: 'bookings', errors: [{ path: 'paymentStatus', message: 'Оплачене бронювання не можна змінювати.' }], req })
        }
        const change = operation === 'create'
          ? { ...data, status: 'new' as const, user: context?.bookingOwnerId ?? req.user?.id ?? null, paymentStatus: 'unpaid' as const }
          : data
        const booking = {
          ...originalDoc,
          ...change,
          status: change.status ?? originalDoc?.status,
        }

        const bookingTariff: unknown = booking.tariff
        if (isBookingTariff(bookingTariff)) {
          const tariffResult = await req.payload.find({
            collection: 'tariffs',
            overrideAccess: true,
            limit: 1,
            where: { name: { equals: bookingTariff } },
            req,
          })
          const tariff = tariffResult.docs[0]
          if (!tariff || !isBookingCategory(tariff.computerCategory)) {
            throw new ValidationError({
              collection: 'bookings',
              errors: [{ path: 'tariff', message: 'Оберіть наявний тариф.' }],
              req,
            })
          }
          const category = tariff.computerCategory
          change.computerCategory = category
          booking.computerCategory = category

          if (operation === 'create' || change.tariff !== undefined || change.duration !== undefined) {
            const total = calculateBookingTotal(tariff.pricePerHour, booking.duration)
            if (total === null) {
              throw new ValidationError({
                collection: 'bookings',
                errors: [{ path: 'totalAmount', message: 'Для обраного тарифу не налаштовано коректну ціну за годину.' }],
                req,
              })
            }
            change.totalAmount = total
            booking.totalAmount = total
          }
        }

        if (
          booking.status !== 'cancelled' &&
          (typeof booking.computerCategory !== 'string' || typeof booking.computer !== 'string')
        ) {
          throw new ValidationError({
            collection: 'bookings',
            errors: [
              {
                path: 'computer',
                message: 'Оберіть категорію та номер комп’ютера.',
              },
            ],
            req,
          })
        }

        if (
          booking.status === 'cancelled' ||
          typeof booking.computer !== 'string' ||
          typeof booking.date !== 'string' ||
          typeof booking.time !== 'string' ||
          typeof booking.duration !== 'number'
        ) {
          return change
        }

        const requestedRange = getBookingRange(booking.date, booking.time, booking.duration)

        if (!requestedRange || !isValidBookingDuration(String(booking.duration))) {
          throw new ValidationError({
            collection: 'bookings',
            errors: [
              {
                path: 'time',
                message: 'Перевірте дату, час початку та тривалість бронювання.',
              },
            ],
            req,
          })
        }

        const existingBookings = await req.payload.find({
          collection: 'bookings',
          depth: 0,
          overrideAccess: true,
          pagination: false,
          req,
          where: {
            and: [
              { computer: { equals: booking.computer } },
              { status: { not_equals: 'cancelled' } },
            ],
          },
        })

        const hasOverlap = existingBookings.docs.some((existingBooking) => {
          if (existingBooking.id === originalDoc?.id) return false
          if (
            !existingBooking.computer ||
            !existingBooking.date ||
            !existingBooking.time ||
            !existingBooking.duration
          ) {
            return false
          }

          const existingRange = getBookingRange(
            existingBooking.date,
            existingBooking.time,
            existingBooking.duration,
          )

          return Boolean(
            existingRange &&
            requestedRange.start < existingRange.end &&
            existingRange.start < requestedRange.end,
          )
        })

        if (hasOverlap) {
          throw new APIError(bookingConflictMessage, 409)
        }

        return {
          ...change,
          bookingStart: new Date(requestedRange.start).toISOString(),
          bookingEnd: new Date(requestedRange.end).toISOString(),
        }
      },
    ],
    afterChange: [async ({ doc, operation, req, context }) => {
      if (context?.syncPayment === true) return doc
      const existing = await req.payload.find({ collection: 'payments', overrideAccess: true, limit: 1, req, where: { booking: { equals: doc.id } } })
      const data = {
        booking: doc.id,
        amount: doc.totalAmount ?? 0,
        method: doc.paymentMethod ?? 'cash',
        status: doc.paymentStatus ?? 'unpaid',
      }
      if (existing.docs[0]) {
        await req.payload.update({ collection: 'payments', id: existing.docs[0].id, overrideAccess: true, req, context: { syncBooking: true }, data })
      } else if (operation === 'create') {
        await req.payload.create({ collection: 'payments', overrideAccess: true, req, data })
      }
      return doc
    }],
    beforeDelete: [async ({ id, req }) => {
      const booking = await req.payload.findByID({ collection: 'bookings', id, overrideAccess: true, req })
      if (booking.paymentStatus === 'paid') {
        throw new ValidationError({ collection: 'bookings', errors: [{ path: 'id', message: 'Оплачене бронювання не можна видалити.' }], req })
      }
    }],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      label: 'Клієнт',
      admin: { readOnly: true },
      access: { update: ({ req }) => req.user?.role === 'admin' },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Ім’я',
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      label: 'Номер телефону',
    },
    { name: 'email', type: 'email', label: 'Email' },
    { name: 'paymentMethod', type: 'select', defaultValue: 'cash', options: [
      { label: 'Готівка', value: 'cash' }, { label: 'Картка (демо)', value: 'card' },
    ] },
    { name: 'paymentStatus', type: 'select', defaultValue: 'unpaid', options: [
      { label: 'Не оплачено', value: 'unpaid' }, { label: 'Оплачено', value: 'paid' },
    ], access: { update: ({ req }) => req.user?.role === 'admin' } },
    { name: 'totalAmount', type: 'number', min: 0, admin: { readOnly: true } },
    {
      name: 'tariff',
      type: 'text',
      required: true,
      label: 'Тариф',
      admin: { description: 'Код тарифу з каталогу тарифів.' },
    },
    {
      name: 'computerCategory',
      type: 'select',
      label: 'Категорія комп’ютера',
      admin: {
        description:
          'Обов’язково для нових активних бронювань; старі записи можуть бути без категорії.',
      },
      options: [
        { label: 'STANDART', value: 'STANDART' },
        { label: 'PRO', value: 'PRO' },
        { label: 'VIP', value: 'VIP' },
        { label: 'STREAM', value: 'STREAMER' },
      ],
    },
    {
      name: 'computer',
      type: 'text',
      label: 'Номер комп’ютера',
      admin: {
        description: 'Обов’язково для нових активних бронювань; старі записи можуть бути без ПК.',
      },
    },
    {
      name: 'date',
      type: 'date',
      required: true,
      label: 'Дата бронювання',
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'dd.MM.yyyy',
        },
      },
    },
    {
      name: 'time',
      type: 'text',
      required: true,
      label: 'Час початку',
    },
    {
      name: 'duration',
      type: 'number',
      required: true,
      min: 1,
      label: 'Тривалість (години)',
    },
    {
      name: 'bookingStart',
      type: 'date',
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'bookingEnd',
      type: 'date',
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      label: 'Статус бронювання',
      options: [
        { label: 'Нове', value: 'new' },
        { label: 'Підтверджено', value: 'confirmed' },
        { label: 'Скасовано', value: 'cancelled' },
      ],
    },
  ],
}
