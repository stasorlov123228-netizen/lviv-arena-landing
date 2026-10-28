import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

import { getPayload } from 'payload'
import configPromise from './payload.config'

import { renderLayout } from './templates/layout'
import { renderHomePage } from './templates/home'
import { renderBookingPage } from './templates/booking'
import { renderLoginPage } from './templates/login'
import { renderRegisterPage } from './templates/register'
import { renderDashboardPage } from './templates/dashboard'
import { renderBookingDetails, renderClientDashboard } from './templates/clientDashboard'
import { renderCatalog, renderRecord, renderCMSPage, renderNewsArticle, renderPageLinks } from './templates/catalog'
import { validateInquiry } from './utilities/inquiry'
import { getComputerCategoryCounts } from './utilities/computers'
import { syncComputerStatuses } from './utilities/syncComputerStatuses'
import { renderSitemapXml, type SitemapEntry } from './utilities/sitemap'
import { errorResponse, getCommonResponse, getPageResponse } from './utilities/publicCmsApi'

import { getCurrentUser } from './utilities/auth'

import { GET as bookingsGet, POST as bookingsPost } from './app/api/bookings/route'
import { POST as authRegister } from './app/api/auth/register/route'
import { POST as authLogin } from './app/api/auth/login/route'
import { POST as authLogout } from './app/api/auth/logout/route'
import { GET as authMe } from './app/api/auth/me/route'
import { POST as authChangePassword } from './app/api/auth/change-password/route'
import { GET as authProfileGet, PATCH as authProfilePatch } from './app/api/auth/profile/route'
import { GET as myBookingsGet } from './app/api/my/bookings/route'
import { patchMyBooking as myBookingPatch, deleteMyBooking as myBookingDelete } from './app/api/my/bookings/byId'
import { getMyBookingById } from './app/api/my/bookings/byId'
import {
  GET as adminBookingsGet,
  PATCH as adminBookingsPatch,
  DELETE as adminBookingsDelete,
} from './app/api/admin/bookings/route'
import {
  GET as adminComputersGet,
  PATCH as adminComputersPatch,
  POST as adminComputersPost,
  DELETE as adminComputersDelete,
} from './app/api/admin/computers/route'
import {
  GET as adminTariffsGet,
  PATCH as adminTariffsPatch,
  POST as adminTariffsPost,
  DELETE as adminTariffsDelete,
} from './app/api/admin/tariffs/route'
import {
  GET as adminUsersGet,
  PATCH as adminUsersPatch,
  DELETE as adminUsersDelete,
} from './app/api/admin/users/route'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const projectRoot = path.resolve(dirname, '..')

export async function createServer() {
  const app = express()

  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(cookieParser())

  app.get('/robots.txt', (req, res) => {
    const siteUrl = process.env.NEXT_PUBLIC_SERVER_URL?.trim() || `${req.protocol}://${req.get('host') || 'localhost'}`
    res.type('text/plain').send(`User-agent: *\nDisallow: /admin/\nSitemap: ${siteUrl.replace(/\/+$/, '')}/sitemap.xml\n`)
  })

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const payload = await getPayload({ config: configPromise })
      const [posts, pages] = await Promise.all([
        payload.find({ collection: 'posts', overrideAccess: true, draft: false, pagination: false, limit: 1000, select: { slug: true, updatedAt: true }, where: { _status: { equals: 'published' } } }),
        payload.find({ collection: 'pages', overrideAccess: true, draft: false, pagination: false, limit: 1000, select: { slug: true, updatedAt: true }, where: { _status: { equals: 'published' } } }),
      ])
      const entries: SitemapEntry[] = [
        ...['', 'booking', 'computers', 'tariffs', 'news'].map((route) => ({ path: route })),
        ...pages.docs.filter((doc) => Boolean(doc.slug)).map((doc) => ({ path: doc.slug === 'home' ? '' : String(doc.slug), lastModified: doc.updatedAt })),
        ...posts.docs.filter((doc) => Boolean(doc.slug)).map((doc) => ({ path: `news/${doc.slug}`, lastModified: doc.updatedAt })),
      ]
      const configuredUrl = process.env.NEXT_PUBLIC_SERVER_URL?.trim()
      const siteUrl = configuredUrl || `${req.protocol}://${req.get('host') || 'localhost'}`
      res.type('application/xml').send(renderSitemapXml(siteUrl, entries))
    } catch {
      res.status(503).type('text').send('Sitemap тимчасово недоступний.')
    }
  })

  app.use(express.static(path.join(projectRoot, 'public')))

  function toWebRequest(req: express.Request): Request {
    const protocol = req.protocol
    const host = req.get('host') || 'localhost'
    const url = `${protocol}://${host}${req.originalUrl}`
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v))
        } else {
          headers.set(key, value)
        }
      }
    }

    const method = req.method
    const hasBody = method !== 'GET' && method !== 'HEAD'
    const body = hasBody && req.body ? JSON.stringify(req.body) : undefined

    return new Request(url, {
      method,
      headers,
      body,
    })
  }

  async function sendWebResponse(res: express.Response, webRes: Response) {
    res.status(webRes.status)
    webRes.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        res.append('Set-Cookie', value)
      } else {
        res.setHeader(key, value)
      }
    })

    const contentType = webRes.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await webRes.json().catch(() => ({}))
      res.json(data)
    } else {
      const text = await webRes.text()
      res.send(text)
    }
  }

  app.get('/', async (_req, res) => {
    try {
      const payload = await getPayload({ config: configPromise })
      let customTariffs: Array<{ id: number | string; name: string; title?: string | null; description?: string | null; pricePerHour?: number | null; computerCategory?: string | null; isActive?: boolean | null }> = []
      let computerCounts: Record<string, number> = {}
      let tariffsUnavailable = false
      let computersUnavailable = false

      try {
        const result = await payload.find({ collection: 'tariffs', overrideAccess: true, limit: 20, sort: 'id' })
        customTariffs = result.docs.map((t) => ({
          id: t.id,
          name: t.name,
          title: t.title,
          description: t.description,
          pricePerHour: t.pricePerHour,
          computerCategory: t.computerCategory,
          isActive: t.isActive,
        }))
      } catch (err) {
        tariffsUnavailable = true
        console.error('Home page tariff query failed:', err)
      }

      try {
        computerCounts = await getComputerCategoryCounts(payload)
      } catch (err) {
        computersUnavailable = true
        console.error('Home page computer query failed:', err)
      }

      const html = renderLayout({
        title: 'Lviv Arena - комп’ютерний клуб у Львові',
        description: 'Lviv Arena: online booking and current club tariffs.',
        content: renderHomePage(customTariffs, computerCounts, { tariffsUnavailable, computersUnavailable }),
        activeNav: 'home',
      })
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(html)
    } catch (err) {
      console.error('Home page render error:', err)
      const html = renderLayout({
        title: 'Lviv Arena - комп’ютерний клуб у Львові',
        description: 'Сайт Lviv Arena тимчасово недоступний. Спробуйте оновити сторінку.',
        content: renderHomePage([], {}, { tariffsUnavailable: true, computersUnavailable: true }),
        activeNav: 'home',
      })
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(html)
    }
  })

  app.get('/booking', async (req, res) => {
    const presetTariff = typeof req.query.tariff === 'string' ? req.query.tariff : ''
    const presetCategory = typeof req.query.category === 'string' ? req.query.category : ''
    let tariffs: Array<{ name: string; title: string; computerCategory: string }> = []
    try {
      const payload = await getPayload({ config: configPromise })
      const result = await payload.find({
        collection: 'tariffs',
        overrideAccess: true,
        limit: 100,
        sort: 'id',
        where: { isActive: { equals: true } },
      })
      tariffs = result.docs.map(({ name, title, computerCategory }) => ({ name, title, computerCategory }))
    } catch (error) {
      console.error('Booking tariff query failed:', error)
    }

    const html = renderLayout({
      title: 'Бронювання комп’ютера - Lviv Arena',
      description: 'Забронюйте комп’ютер для гри у клубі Lviv Arena у Львові.',
      content: renderBookingPage({ presetTariff, presetCategory, tariffs }),
      scripts: ['/booking.js'],
      activeNav: 'booking',
    })
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  })

  app.get('/login', async (req, res) => {
    const webReq = toWebRequest(req)
    const user = await getCurrentUser(webReq)
    if (user) {
      return res.redirect(user.role === 'admin' ? '/club-admin' : '/dashboard')
    }

    const html = renderLayout({
      title: 'Вхід до особистого кабінету - Lviv Arena',
      description: 'Увійдіть до кабінету гравця або адміністратора клубу Lviv Arena.',
      content: renderLoginPage(),
      scripts: ['/login.js'],
      activeNav: 'login',
    })
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  })

  app.get('/register', async (req, res) => {
    const webReq = toWebRequest(req)
    const user = await getCurrentUser(webReq)
    if (user) {
      return res.redirect(user.role === 'admin' ? '/club-admin' : '/dashboard')
    }

    const html = renderLayout({
      title: 'Реєстрація акаунта - Lviv Arena',
      description: 'Створіть особистий профіль у комп’ютерному клубі Lviv Arena у Львові.',
      content: renderRegisterPage(),
      scripts: ['/register.js'],
      activeNav: 'register',
    })
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  })

  app.get('/dashboard', async (req, res) => {
    const webReq = toWebRequest(req)
    const user = await getCurrentUser(webReq)

    if (!user) {
      return res.redirect('/login?redirect=/dashboard')
    }

    const html = renderLayout({
      title: 'Особистий кабінет - Lviv Arena',
      description: 'Ваші бронювання та контактні дані.',
      content: renderClientDashboard(user),
      scripts: ['/client-dashboard.js'],
      activeNav: 'dashboard',
    })
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  })

  app.get('/club-admin', async (req, res) => {
    const user = await getCurrentUser(toWebRequest(req))
    if (!user) return res.redirect('/login?redirect=/club-admin')
    if (user.role !== 'admin') return res.status(403).send('Доступ заборонено. Потрібні права адміністратора.')
    res.type('html').send(renderLayout({ title: 'Панель клубу - Lviv Arena', description: 'Адміністрування клубу.', content: renderDashboardPage(user), scripts: ['/dashboard.js'], activeNav: 'club-admin' }))
  })

  app.get(/^\/admin(?:\/.*)?$/, (req, res) => {
    const adminBase = process.env.NEXT_ADMIN_URL || 'http://localhost:3100'
    const destination = new URL(req.originalUrl, adminBase)
    res.redirect(302, destination.toString())
  })

  app.get('/bookings/:id', async (req, res) => {
    const webReq = toWebRequest(req)
    const response = await getMyBookingById(webReq, req.params.id)
    if (response.status === 401) return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`)
    if (!response.ok) return res.status(response.status).send('Бронювання не знайдено або доступ до нього заборонено.')
    const { doc } = await response.json() as { doc: Record<string, unknown> }
    res.type('html').send(renderLayout({ title: 'Деталі бронювання - Lviv Arena', description: 'Ваше бронювання.', content: renderBookingDetails(doc), activeNav: 'dashboard' }))
  })

  app.get('/computers', async (_req, res) => {
    try {
      const payload = await getPayload({ config: configPromise })
      await syncComputerStatuses(payload)
      const [computerResult, tariffResult] = await Promise.all([
        payload.find({ collection: 'computers', overrideAccess: true, pagination: false, limit: 200, sort: 'computerNumber' }),
        payload.find({ collection: 'tariffs', overrideAccess: true, pagination: false, limit: 20, where: { isActive: { equals: true } } }),
      ])
      const categoryOrder = ['STANDART', 'PRO', 'VIP', 'STREAMER']
      const showcase = [...tariffResult.docs]
        .sort((a, b) => categoryOrder.indexOf(a.computerCategory) - categoryOrder.indexOf(b.computerCategory))
        .flatMap((tariff) => {
          const matching = computerResult.docs.filter((computer) => computer.category === tariff.computerCategory)
          const computer = matching.find((item) => item.status === 'available') ?? matching[0]
          return computer ? [{
            ...computer,
            tariffName: tariff.name,
            tariffTitle: tariff.title,
            tariffPricePerHour: tariff.pricePerHour,
          }] : []
        })
      res.type('html').send(renderLayout({ title: 'Комп’ютери - Lviv Arena', description: 'Чотири ігрові зони Lviv Arena з актуальними характеристиками та тарифами.', content: renderCatalog('Комп’ютери та ігрові зони', showcase as unknown as Array<Record<string, unknown>>, 'computers'), activeNav: 'computers' }))
    } catch { res.status(503).send('Каталог комп’ютерів тимчасово недоступний.') }
  })
  app.get('/computers/:computerNumber', async (req, res) => {
    try {
      const payload = await getPayload({ config: configPromise })
      const result = await payload.find({ collection: 'computers', overrideAccess: true, limit: 1, where: { computerNumber: { equals: req.params.computerNumber } } })
      const pc = result.docs[0]
      if (!pc) return res.status(404).send('Комп’ютер не знайдено.')
      res.type('html').send(renderLayout({ title: `${pc.computerNumber} - Lviv Arena`, description: 'Характеристики комп’ютера клубу.', content: renderRecord(pc.computerNumber, [['Категорія', pc.category], ['Стан', pc.status], ['Опис', pc.description]]), activeNav: 'computers' }))
    } catch { res.status(503).send('Дані комп’ютера тимчасово недоступні.') }
  })
  app.get('/tariffs', async (_req, res) => {
    try {
      const payload = await getPayload({ config: configPromise })
      const result = await payload.find({ collection: 'tariffs', overrideAccess: true, pagination: false, limit: 100, sort: 'name', where: { isActive: { equals: true } } })
      res.type('html').send(renderLayout({ title: 'Тарифи - Lviv Arena', description: 'Актуальні тарифи клубу.', content: renderCatalog('Тарифи клубу', result.docs as unknown as Array<Record<string, unknown>>, 'tariffs'), activeNav: 'tariffs' }))
    } catch { res.status(503).send('Тарифи тимчасово недоступні.') }
  })
  app.get('/tariffs/:id', async (req, res) => {
    try {
      const payload = await getPayload({ config: configPromise })
      const tariff = await payload.findByID({ collection: 'tariffs', id: Number(req.params.id), overrideAccess: true }).catch(() => null)
      if (!tariff || !tariff.isActive) return res.status(404).send('Тариф не знайдено.')
      res.type('html').send(renderLayout({ title: `${tariff.title} - Lviv Arena`, description: tariff.description || 'Тариф клубу.', content: renderRecord(tariff.title, [['Категорія ПК', tariff.computerCategory], ['Ціна за годину', typeof tariff.pricePerHour === 'number' ? `${tariff.pricePerHour} грн` : 'Не налаштована'], ['Опис', tariff.description], ['Статус', tariff.isActive ? 'Активний' : 'Неактивний']]), activeNav: 'tariffs' }))
    } catch { res.status(503).send('Дані тарифу тимчасово недоступні.') }
  })
  app.get('/news', async (req, res) => {
    try {
      const requestedPage = Number(req.query.page || 1)
      if (!Number.isInteger(requestedPage) || requestedPage < 1) return res.status(400).send('Некоректний номер сторінки.')
      const payload = await getPayload({ config: configPromise })
      const result = await payload.find({ collection: 'posts', overrideAccess: true, limit: 12, page: requestedPage, sort: '-publishedAt', where: { _status: { equals: 'published' } } })
      if (result.totalPages > 0 && requestedPage > result.totalPages) return res.status(404).send('Сторінку новин не знайдено.')
      const content = `${renderCatalog('Новини клубу', result.docs as unknown as Array<Record<string, unknown>>, 'posts')}${renderPageLinks('/news', requestedPage, result.totalPages)}`
      res.type('html').send(renderLayout({ title: 'Новини - Lviv Arena', description: 'Новини клубу.', content, activeNav: 'news' }))
    } catch { res.status(503).send('Новини тимчасово недоступні.') }
  })

  app.get('/posts/page/:pageNumber', (req, res) => {
    if (!/^\d+$/.test(req.params.pageNumber) || Number(req.params.pageNumber) < 1) return res.status(404).send('Сторінку не знайдено.')
    res.redirect(301, `/news?page=${req.params.pageNumber}`)
  })
  app.get('/posts', (req, res) => res.redirect(301, `/news${req.originalUrl.slice('/posts'.length)}`))
  app.get('/posts/:slug', (req, res) =>
    res.redirect(301, `/news/${encodeURIComponent(req.params.slug)}`),
  )

  app.get('/news/:slug', async (req, res) => {
    try {
      const payload = await getPayload({ config: configPromise })
      const result = await payload.find({ collection: 'posts', overrideAccess: true, limit: 1, where: { and: [{ slug: { equals: req.params.slug } }, { _status: { equals: 'published' } }] } })
      const post = result.docs[0]
      if (!post) return res.status(404).send('Новину не знайдено.')
      res.type('html').send(renderLayout({ title: `${post.title} - Lviv Arena`, description: post.meta?.description || 'Новини клубу.', content: renderNewsArticle(post as unknown as Record<string, unknown>), activeNav: 'news' }))
    } catch { res.status(503).send('Новина тимчасово недоступна.') }
  })
  for (const section of ['tournaments', 'clubs', 'feedback', 'partnership'] as const) {
    app.get(`/${section}`, async (_req, res) => {
      try {
        const payload = await getPayload({ config: configPromise })
        const result = await payload.find({ collection: 'pages', overrideAccess: true, limit: 1, where: { and: [{ slug: { equals: section } }, { _status: { equals: 'published' } }] } })
        const page = result.docs[0]
        if (!page && (section === 'feedback' || section === 'partnership')) {
          const title = section === 'feedback' ? '\u0417\u0432\u043e\u0440\u043e\u0442\u043d\u0438\u0439 \u0437\u0432\u2019\u044f\u0437\u043e\u043a' : '\u041f\u0430\u0440\u0442\u043d\u0435\u0440\u0441\u0442\u0432\u043e'
          return res.type('html').send(renderLayout({ title: `${title} \u2014 Lviv Arena`, description: title, content: renderCMSPage(title, {}, section), scripts: ['/inquiry.js'], activeNav: section }))
        }
        if (!page) return res.status(404).type('html').send(renderLayout({ title: 'Сторінку не знайдено - Lviv Arena', description: 'Опублікована CMS-сторінка відсутня.', content: '<main class="container section"><h1>Сторінка ще не опублікована</h1><p>Зверніться до адміністратора клубу.</p></main>' }))
        res.type('html').send(renderLayout({ title: `${page.title} - Lviv Arena`, description: page.meta?.description || page.title, content: renderCMSPage(page.title, page as unknown as Record<string, unknown>, section === 'feedback' || section === 'partnership' ? section : undefined), scripts: section === 'feedback' || section === 'partnership' ? ['/inquiry.js'] : [], activeNav: section }))
      } catch { res.status(503).send('Сторінка тимчасово недоступна.') }
    })
  }

  app.get('/:slug', async (req, res) => {
    try {
      const payload = await getPayload({ config: configPromise })
      const result = await payload.find({
        collection: 'pages',
        overrideAccess: true,
        limit: 1,
        where: {
          and: [
            { slug: { equals: req.params.slug } },
            { _status: { equals: 'published' } },
          ],
        },
      })
      const page = result.docs[0]
      if (!page) {
        return res.status(404).type('html').send(renderLayout({
          title: 'Сторінку не знайдено - Lviv Arena',
          description: 'Опубліковану CMS-сторінку не знайдено.',
          content: '<main class="container section"><h1>Сторінку не знайдено</h1></main>',
        }))
      }
      return res.type('html').send(renderLayout({
        title: `${page.title} - Lviv Arena`,
        description: page.meta?.description || page.title,
        content: renderCMSPage(page.title, page as unknown as Record<string, unknown>),
      }))
    } catch {
      return res.status(503).type('html').send('Сторінка тимчасово недоступна.')
    }
  })

  app.get('/api/common', async (_req, res) => {
    try {
      const payload = await getPayload({ config: configPromise })
      return sendWebResponse(res, await getCommonResponse(payload))
    } catch {
      return sendWebResponse(res, errorResponse(503, 'COMMON_UNAVAILABLE', 'Спільні дані тимчасово недоступні.'))
    }
  })
  app.get('/api/page', async (req, res) => {
    const pathValue = req.query.path
    if (typeof pathValue !== 'string' || pathValue !== pathValue.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(pathValue)) {
      return sendWebResponse(res, errorResponse(400, 'INVALID_PATH', 'Параметр path відсутній або має некоректний формат.'))
    }
    try {
      const payload = await getPayload({ config: configPromise })
      return sendWebResponse(res, await getPageResponse(payload, toWebRequest(req)))
    } catch {
      return sendWebResponse(res, errorResponse(503, 'PAGE_UNAVAILABLE', 'Сторінка тимчасово недоступна.'))
    }
  })
  app.get(['/api/bookings', '/api/booking'], async (req, res) => sendWebResponse(res, await bookingsGet(toWebRequest(req))))
  app.post(['/api/bookings', '/api/booking'], async (req, res) => sendWebResponse(res, await bookingsPost(toWebRequest(req))))
  app.post('/api/inquiries', async (req, res) => {
    const inquiry = validateInquiry((req.body ?? {}) as Record<string, unknown>)
    if (!inquiry) return res.status(400).json({ message: 'Перевірте тип звернення, ім’я, email, телефон і повідомлення (5–5000 символів).' })
    try {
      const payload = await getPayload({ config: configPromise })
      const doc = await payload.create({ collection: 'inquiries', overrideAccess: true, data: { ...inquiry, status: 'new' } })
      return res.status(201).json({ id: doc.id, message: 'Повідомлення надіслано.' })
    } catch { return res.status(503).json({ message: 'Не вдалося зберегти повідомлення. Спробуйте пізніше.' }) }
  })

  app.post('/api/auth/register', async (req, res) => sendWebResponse(res, await authRegister(toWebRequest(req))))
  app.post('/api/auth/login', async (req, res) => sendWebResponse(res, await authLogin(toWebRequest(req))))
  app.post('/api/auth/logout', async (req, res) => sendWebResponse(res, await authLogout(toWebRequest(req))))
  app.get('/api/auth/me', async (req, res) => sendWebResponse(res, await authMe(toWebRequest(req))))
  app.post('/api/auth/change-password', async (req, res) => sendWebResponse(res, await authChangePassword(toWebRequest(req))))
  app.get('/api/auth/profile', async (req, res) => sendWebResponse(res, await authProfileGet(toWebRequest(req))))
  app.patch('/api/auth/profile', async (req, res) => sendWebResponse(res, await authProfilePatch(toWebRequest(req))))
  app.get('/api/my/bookings', async (req, res) => sendWebResponse(res, await myBookingsGet(toWebRequest(req))))
  app.get('/api/my/bookings/:id', async (req, res) => sendWebResponse(res, await getMyBookingById(toWebRequest(req), req.params.id)))
  app.patch('/api/my/bookings/:id', async (req, res) => sendWebResponse(res, await myBookingPatch(toWebRequest(req), req.params.id)))
  app.delete('/api/my/bookings/:id', async (req, res) => sendWebResponse(res, await myBookingDelete(toWebRequest(req), req.params.id)))

  app.get('/api/admin/bookings', async (req, res) => sendWebResponse(res, await adminBookingsGet(toWebRequest(req))))
  app.patch('/api/admin/bookings', async (req, res) => sendWebResponse(res, await adminBookingsPatch(toWebRequest(req))))
  app.delete('/api/admin/bookings', async (req, res) => sendWebResponse(res, await adminBookingsDelete(toWebRequest(req))))

  app.get('/api/admin/computers', async (req, res) => sendWebResponse(res, await adminComputersGet(toWebRequest(req))))
  app.patch('/api/admin/computers', async (req, res) => sendWebResponse(res, await adminComputersPatch(toWebRequest(req))))
  app.post('/api/admin/computers', async (req, res) => sendWebResponse(res, await adminComputersPost(toWebRequest(req))))
  app.delete('/api/admin/computers', async (req, res) => sendWebResponse(res, await adminComputersDelete(toWebRequest(req))))

  app.get('/api/admin/tariffs', async (req, res) => sendWebResponse(res, await adminTariffsGet(toWebRequest(req))))
  app.patch('/api/admin/tariffs', async (req, res) => sendWebResponse(res, await adminTariffsPatch(toWebRequest(req))))
  app.post('/api/admin/tariffs', async (req, res) => sendWebResponse(res, await adminTariffsPost(toWebRequest(req))))
  app.delete('/api/admin/tariffs', async (req, res) => sendWebResponse(res, await adminTariffsDelete(toWebRequest(req))))

  app.get('/api/admin/users', async (req, res) => sendWebResponse(res, await adminUsersGet(toWebRequest(req))))
  app.patch('/api/admin/users', async (req, res) => sendWebResponse(res, await adminUsersPatch(toWebRequest(req))))
  app.delete('/api/admin/users', async (req, res) => sendWebResponse(res, await adminUsersDelete(toWebRequest(req))))

  app.use((req, res) => {
    res.status(404).send(
      renderLayout({
        title: 'Сторінку не знайдено - Lviv Arena',
        description: '404 - Сторінку не знайдено.',
        content: `
          <main class="container" style="padding: 100px 20px; text-align: center;">
            <h1 style="font-size: 3rem; margin-bottom: 16px;">404</h1>
            <p style="color: var(--text-secondary); margin-bottom: 24px;">Сторінку, яку ви шукаєте, не знайдено.</p>
            <a href="/" class="btn-lime">На головну</a>
          </main>
        `,
      }),
    )
  })

  return app
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url).includes(path.basename(process.argv[1]))

if (isDirectRun && process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  const port = process.env.PORT || 3000
  createServer().then((app) => {
    app.listen(port, () => {
      console.log(`Lviv Arena Zero-React server listening on http://localhost:${port}`)
    })

    const refreshComputerStatuses = async () => {
      try {
        const payload = await getPayload({ config: configPromise })
        await syncComputerStatuses(payload)
      } catch (error) {
        console.error('Computer status refresh failed:', error)
      }
    }

    void refreshComputerStatuses()
    const statusRefreshTimer = setInterval(() => void refreshComputerStatuses(), 15_000)
    statusRefreshTimer.unref()
  })
}

