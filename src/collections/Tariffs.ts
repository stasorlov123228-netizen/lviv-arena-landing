import type { CollectionConfig } from 'payload'

export const Tariffs: CollectionConfig = {
  slug: 'tariffs',
  labels: {
    singular: 'Тариф',
    plural: 'Тарифи',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'title', 'pricePerHour', 'isActive', 'computerCategory', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      label: 'Код тарифу',
      admin: { description: 'Унікальний код латиницею, цифрами, дефісом або підкресленням.' },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Назва / Заголовок тарифу',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Опис та характеристики (через кому або з нового рядка)',
    },
    {
      name: 'pricePerHour',
      type: 'number',
      label: 'Ціна за годину (грн)',
      min: 0,
      admin: {
        description: 'Залиште порожнім, якщо ціна уточнюється на місці',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      label: 'Тариф активний',
    },
    {
      name: 'computerCategory',
      type: 'select',
      required: true,
      label: 'Категорія комп’ютерів для тарифу',
      options: [
        { label: 'STANDART', value: 'STANDART' },
        { label: 'PRO', value: 'PRO' },
        { label: 'VIP', value: 'VIP' },
        { label: 'STREAM', value: 'STREAMER' },
      ],
    },
  ],
  timestamps: true,
}

