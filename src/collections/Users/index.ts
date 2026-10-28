import { ValidationError, type CollectionConfig, type PayloadRequest } from 'payload'

async function getActiveAccount(req: PayloadRequest) {
  if (!req.user?.id) return null
  try {
    const user = await req.payload.findByID({ collection: 'users', id: req.user.id, overrideAccess: true, req })
    return user.isBlocked ? null : user
  } catch {
    return null
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Користувач',
    plural: 'Користувачі',
  },
  access: {

    admin: async ({ req }) => (await getActiveAccount(req))?.role === 'admin',
    create: () => true,
    delete: async ({ req }) => (await getActiveAccount(req))?.role === 'admin',

    read: async ({ req }) => {
      const current = await getActiveAccount(req)
      return current?.role === 'admin' ? true : current ? { id: { equals: current.id } } : false
    },
    update: async ({ req }) => {
      const current = await getActiveAccount(req)
      return current?.role === 'admin' ? true : current ? { id: { equals: current.id } } : false
    },
  },
  admin: {
    defaultColumns: ['name', 'email', 'phone', 'role', 'isBlocked', 'createdAt'],
    useAsTitle: 'name',
  },
  auth: {
    maxLoginAttempts: 10,
    lockTime: 10 * 60 * 1000,
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        if ((operation === 'create' || operation === 'update') && typeof data?.password === 'string' && data.password.length < 8) {
          throw new ValidationError({
            collection: 'users',
            errors: [{ path: 'password', message: 'Password must contain at least 8 characters.' }],
            req,
          })
        }
        return data
      },
    ],
    beforeChange: [
      async ({ data, operation, req, originalDoc, context }) => {
        if (typeof data.email === 'string') data.email = data.email.trim().toLowerCase()

        if (operation === 'create') {
          if (req.user?.role !== 'admin' && context?.provisionAdmin !== true) {
            data.role = 'user'
            data.isBlocked = false
            data.mustChangePassword = false
          }
        }

        if (operation === 'update') {
          if (data.isBlocked === true && String(originalDoc?.id) === String(req.user?.id)) {
            throw new Error('Не можна заблокувати власний обліковий запис адміністратора.')
          }

          if (req.user?.role !== 'admin') {
            data.role = originalDoc?.role ?? 'user'
            data.isBlocked = originalDoc?.isBlocked ?? false
            data.mustChangePassword = originalDoc?.mustChangePassword ?? false
          }

          if (
            originalDoc?.role === 'admin' &&
            data.role === 'user' &&
            req.user?.role === 'admin'
          ) {
            const adminCount = await req.payload.find({
              collection: 'users',
              where: {
                and: [
                  { role: { equals: 'admin' } },
                  { isBlocked: { not_equals: true } },
                ],
              },
              limit: 2,
            })

            if (adminCount.totalDocs <= 1) {
              throw new Error('Неможливо змінити роль: це останній діючий адміністратор.')
            }
          }
        }

        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {

        const target = await req.payload.findByID({
          collection: 'users',
          id,
        })

        if (String(id) === String(req.user?.id)) {
          throw new Error('Не можна видалити власний обліковий запис адміністратора.')
        }

        if (target && target.role === 'admin') {
          const adminCount = await req.payload.find({
            collection: 'users',
            where: {
              and: [
                { role: { equals: 'admin' } },
                { isBlocked: { not_equals: true } },
              ],
            },
            limit: 2,
          })

          if (adminCount.totalDocs <= 1) {
            throw new Error('Неможливо видалити останнього діючого адміністратора.')
          }
        }
      },
    ],
  },
  fields: [
    { name: 'phone', type: 'text', label: 'Телефон' },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Ім’я',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      saveToJWT: true,
      label: 'Роль користувача',
      options: [
        { label: 'Користувач (user)', value: 'user' },
        { label: 'Адміністратор (admin)', value: 'admin' },
      ],
      access: {
        update: ({ req }) => req.user?.role === 'admin',
      },
    },
    {
      name: 'isBlocked',
      type: 'checkbox',
      defaultValue: false,
      label: 'Заблокований обліковий запис',
      access: {
        update: ({ req }) => req.user?.role === 'admin',
      },
    },
    {
      name: 'mustChangePassword',
      type: 'checkbox',
      defaultValue: false,
      label: 'Вимагати зміну пароля після входу',
      access: {
        update: ({ req }) => req.user?.role === 'admin',
      },
    },
  ],
  timestamps: true,
}
