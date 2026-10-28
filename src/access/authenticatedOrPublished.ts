import type { Access } from 'payload'

export const authenticatedOrPublished: Access = ({ req: { user } }) => {
  if (user?.role === 'admin') {
    return true
  }

  return {
    _status: {
      equals: 'published',
    },
  }
}
