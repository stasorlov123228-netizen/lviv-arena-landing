import type { Payload } from 'payload'

export const seedLvivArena = async (payload: Payload): Promise<void> => {
  payload.logger.info('Starting Lviv Arena initial data seeding...')

  const computerSpecs = [
    { range: [1, 30], category: 'STANDART', desc: 'Intel Core i5, 32GB RAM, 144Hz Monitor, SSD 1TB' },
    { range: [31, 50], category: 'PRO', desc: 'Intel Core i7, RTX 4070, 32GB RAM, 165Hz Monitor, Механіка' },
    { range: [51, 62], category: 'VIP', desc: 'Intel Core i9, RTX 4080, 64GB RAM, 240Hz Monitor, Преміум крісло' },
    { range: [63, 70], category: 'STREAMER', desc: 'Камера 4K, мікрофон Rode, 2 монітори, студійне світло' },
  ] as const

  for (const spec of computerSpecs) {
    const [start, end] = spec.range
    for (let i = start; i <= end; i++) {
      const pcNumber = `PC-${String(i).padStart(2, '0')}`

      const exists = await payload.find({
        collection: 'computers',
        where: { computerNumber: { equals: pcNumber } },
        limit: 1,
      })

      if (exists.docs.length === 0) {
        await payload.create({
          collection: 'computers',
          overrideAccess: true,
          data: {
            computerNumber: pcNumber,
            category: spec.category,
            status: 'available',
            description: spec.desc,
          },
        })
      }
    }
  }
  payload.logger.info('70 computers verified / seeded successfully.')

  const tariffsData = [
    {
      name: 'DEFAULT' as const,
      title: 'Для комфортної гри',
      description: 'Монітори від 144 Гц, 32 GB RAM, Швидкісні SSD',
      computerCategory: 'STANDART' as const,
      pricePerHour: 80,
      isActive: true,
    },
    {
      name: 'PRO' as const,
      title: 'Для перемог',
      description: 'Монітори від 165 Гц, Потужне ігрове залізо, Механічні клавіатури',
      computerCategory: 'PRO' as const,
      pricePerHour: 120,
      isActive: true,
    },
    {
      name: 'VIP' as const,
      title: 'Максимум комфорту',
      description: 'Монітори до 240 Гц, Преміальні крісла, Окрема VIP-зона',
      computerCategory: 'VIP' as const,
      pricePerHour: 150,
      isActive: true,
    },
    {
      name: 'STREAM' as const,
      title: 'Створи свій контент',
      description: 'Стримінгове обладнання, Камера та мікрофон, Місце для трансляцій',
      computerCategory: 'STREAMER' as const,
      pricePerHour: 140,
      isActive: true,
    },
  ]

  for (const t of tariffsData) {
    const exists = await payload.find({
      collection: 'tariffs',
      where: { name: { equals: t.name } },
      limit: 1,
    })

    if (exists.docs.length === 0) {
      await payload.create({
        collection: 'tariffs',
        overrideAccess: true,
        data: t,
      })
    }
  }
  payload.logger.info('Tariffs verified / seeded successfully.')
  payload.logger.info('Lviv Arena initial data seeding complete.')
}

