export const expectedAdminCollectionAccess = {
  pages: { read: true, create: true, update: true, delete: true },
  posts: { read: true, create: true, update: true, delete: true },
  media: { read: true, create: true, update: true, delete: true },
  categories: { read: true, create: true, update: true, delete: true },
  users: { read: true, create: true, update: true, delete: true },
  bookings: { read: true, create: true, update: true, delete: true },
  computers: { read: true, create: true, update: true, delete: true },
  tariffs: { read: true, create: true, update: true, delete: true },
  payments: { read: true, create: true, update: true, delete: false },
  inquiries: { read: true, create: false, update: true, delete: true },
} as const

export const expectedAdminGlobalUpdates = ['header', 'footer'] as const
