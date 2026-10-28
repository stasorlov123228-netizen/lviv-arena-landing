import type { CollectionConfig } from 'payload'

export const Computers: CollectionConfig = {
  slug: 'computers',
  labels: {
    singular: 'Комп’ютер',
    plural: 'Комп’ютери',
  },
  admin: {
    useAsTitle: 'computerNumber',
    defaultColumns: ['computerNumber', 'category', 'status', 'description', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  hooks: {
    beforeChange: [({ data, context }) => {
      if (context?.syncComputerStatus) return data
      if (data.status === 'occupied') data.manualOccupied = true
      if (data.status === 'available' || data.status === 'maintenance' || data.status === 'offline') {
        data.manualOccupied = false
      }
      return data
    }],
  },
  fields: [
    {
      name: 'computerNumber',
      type: 'text',
      required: true,
      unique: true,
      label: 'Номер комп’ютера (наприклад, PC-01)',
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      label: 'Категорія',
      options: [
        { label: 'STANDART (ПК-01 - ПК-30)', value: 'STANDART' },
        { label: 'PRO (ПК-31 - ПК-50)', value: 'PRO' },
        { label: 'VIP (ПК-51 - ПК-62)', value: 'VIP' },
        { label: 'STREAM (ПК-63 - ПК-70)', value: 'STREAMER' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'available',
      label: 'Статус комп’ютера',
      options: [
        { label: 'Доступний (available)', value: 'available' },
        { label: 'Зайнятий (occupied)', value: 'occupied' },
        { label: 'Технічне обслуговування (maintenance)', value: 'maintenance' },
        { label: 'Офлайн (offline)', value: 'offline' },
      ],
    },
    { name: 'manualOccupied', type: 'checkbox', defaultValue: false, label: 'Позначено зайнятим персоналом' },
    {
      name: 'description',
      type: 'text',
      label: 'Короткий опис або характеристики',
    },
  ],
  timestamps: true,
}

