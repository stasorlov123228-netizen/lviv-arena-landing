import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/access/adminOnly'

export const Inquiries: CollectionConfig = {
  slug: 'inquiries',
  admin: { useAsTitle: 'name', defaultColumns: ['kind', 'name', 'email', 'status', 'createdAt'] },
  access: { create: () => false, read: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [
    { name: 'kind', type: 'text', required: true, maxLength: 20, admin: { readOnly: true } },
    { name: 'name', type: 'text', required: true, maxLength: 100 },
    { name: 'email', type: 'email', required: true },
    { name: 'phone', type: 'text', maxLength: 40 },
    { name: 'message', type: 'textarea', required: true, maxLength: 5000 },
    { name: 'status', type: 'text', required: true, defaultValue: 'new' },
  ],
  timestamps: true,
}
