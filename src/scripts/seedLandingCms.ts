import 'dotenv/config'
import config from '../payload.config'
import { getPayload } from 'payload'

const homeHeading = {
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    children: [
      {
        type: 'heading',
        tag: 'h1',
        format: '' as const,
        indent: 0,
        version: 1,
        children: [
          { type: 'text', text: 'ТВОЯ ГРА. ТВОЯ АРЕНА.', format: 0, style: '', mode: 'normal', detail: 0, version: 1 },
        ],
      },
    ],
    direction: 'ltr' as const,
  },
}

const homeIntro = {
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    children: [
      {
        type: 'paragraph',
        format: '' as const,
        indent: 0,
        version: 1,
        children: [
          { type: 'text', text: 'Lviv Arena — простір для геймерів, друзів і майбутніх чемпіонів. Тут можна обрати зону, переглянути тарифи та забронювати місце.', format: 0, style: '', mode: 'normal', detail: 0, version: 1 },
        ],
      },
    ],
    direction: 'ltr' as const,
  },
}

const navItems = (items: Array<{ label: string; url: string }>) => items.map(({ label, url }) => ({
  link: { type: 'custom' as const, label, url, newTab: false },
}))

async function main() {
  const payload = await getPayload({ config })

  try {
    const existingHome = await payload.find({
      collection: 'pages',
      where: { slug: { equals: 'home' } },
      limit: 1,
      overrideAccess: true,
    })

    if (existingHome.docs.length === 0) {
      await payload.create({
        collection: 'pages',
        draft: false,
        overrideAccess: true,
        data: {
          title: 'Головна сторінка',
          slug: 'home',
          hero: { type: 'none', richText: homeHeading },
          layout: [{
            blockType: 'content',
            columns: [{ size: 'full', richText: homeIntro, enableLink: false }],
          }],
          publishedAt: new Date().toISOString(),
          _status: 'published',
        },
      })
      console.info('Created and published the home page in Payload.')
    } else {
      const page = existingHome.docs[0]
      if (page._status !== 'published') {
        await payload.update({
          collection: 'pages',
          id: page.id,
          draft: false,
          overrideAccess: true,
          data: { _status: 'published' },
        })
        console.info('Published the existing home page without replacing its content.')
      } else {
        console.info('Home page is already published; left its content unchanged.')
      }
    }

    const [header, footer] = await Promise.all([
      payload.findGlobal({ slug: 'header', overrideAccess: true }),
      payload.findGlobal({ slug: 'footer', overrideAccess: true }),
    ])

    if (!header.navItems?.length) {
      await payload.updateGlobal({
        slug: 'header',
        overrideAccess: true,
        data: {
          navItems: navItems([
            { label: 'Про клуб', url: '#about' },
            { label: 'Галерея', url: '#gallery' },
            { label: 'Тарифи', url: '#tariffs' },
            { label: 'Контакти', url: '#contacts' },
          ]),
        },
      })
      console.info('Added starter navigation links to Header.')
    } else {
      console.info('Header navigation already exists; left it unchanged.')
    }

    if (!footer.navItems?.length) {
      await payload.updateGlobal({
        slug: 'footer',
        overrideAccess: true,
        data: {
          navItems: navItems([
            { label: 'Про клуб', url: '#about' },
            { label: 'Галерея', url: '#gallery' },
            { label: 'Тарифи', url: '#tariffs' },
            { label: 'Контакти', url: '#contacts' },
            { label: 'Instagram', url: 'https://instagram.com' },
          ]),
        },
      })
      console.info('Added starter navigation links to Footer.')
    } else {
      console.info('Footer navigation already exists; left it unchanged.')
    }
  } finally {
    await payload.destroy()
  }
}

main().then(() => process.exit(0)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Landing CMS setup failed.')
  process.exit(1)
})

