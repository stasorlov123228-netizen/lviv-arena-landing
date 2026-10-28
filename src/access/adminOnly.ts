import type { Access } from 'payload'

export const adminOnly: Access = ({ req }) => req.user?.role === 'admin'
