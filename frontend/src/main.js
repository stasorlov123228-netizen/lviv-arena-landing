import { apiURL, getCommonData, getPage } from './api.js'
import { renderHomePage } from './landingTemplate.ts'
import { renderBlocks } from './blocks/renderBlocks.js'
import './site.css'

const fallbackTariffs = [
  { name: 'DEFAULT', title: 'Для щоденної гри', description: 'RTX 4060 Ti, 165Hz, механічна клавіатура', pricePerHour: 80, computerCategory: 'STANDART' },
  { name: 'PRO', title: 'Для змагальної гри', description: 'RTX 4080, 360Hz, професійна периферія', pricePerHour: 120, computerCategory: 'PRO' },
  { name: 'VIP', title: 'Приватна зона', description: 'RTX 4090, 4K OLED, окрема кімната', pricePerHour: 150, computerCategory: 'VIP' },
  { name: 'STREAM', title: 'Для стримів і контенту', description: 'Подвійний монітор, студійний мікрофон', pricePerHour: 140, computerCategory: 'STREAMER' },
]

const fallbackCounts = { STANDART: 30, PRO: 20, VIP: 12, STREAMER: 8 }
const fallbackHeader = [
  { label: 'Про клуб', href: '#about' },
  { label: 'Галерея', href: '#gallery' },
  { label: 'Тарифи', href: '#tariffs' },
  { label: 'Контакти', href: '#contacts' },
]
const fallbackFooter = [...fallbackHeader, { label: 'Instagram', href: 'https://instagram.com', newTab: true }]

function mapToLanding(href) {
  if (typeof href !== 'string') return '#top'
  if (href.startsWith('#')) return href
  if (href.startsWith('/') && !href.startsWith('//')) {
    const route = href.split(/[?#]/, 1)[0].replace(/\/$/, '')
    if (route === '' || route === '/home') return '#top'
    if (route === '/booking') return '#contacts'
    if (route === '/computers' || route === '/tariffs') return '#tariffs'
    if (route === '/news') return '#gallery'
    return '#top'
  }
  try {
    const url = new URL(href)
    return ['http:', 'https:', 'tel:', 'mailto:'].includes(url.protocol) ? href : '#top'
  } catch {
    return '#top'
  }
}

function linkMarkup(item) {
  const href = mapToLanding(item.href)
  const target = item.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''
  return `<a href="${escapeHtml(href)}"${target}>${escapeHtml(item.label)}</a>`
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char])
}

function renderSiteShell(homeHTML, common) {
  const headerLinks = common?.header?.navItems?.length ? common.header.navItems : fallbackHeader
  const footerLinks = common?.footer?.navItems?.length ? common.footer.navItems : fallbackFooter

  return `
    <header class="site-header"><div class="container header-inner">
      <a href="#top" class="logo"><span>LVIV ARENA</span><span class="logo-dot">●</span></a>
      <nav aria-label="Основна навігація"><ul class="nav-links" id="primary-nav" data-cms-navigation="header">
        ${headerLinks.map((item) => `<li>${linkMarkup(item)}</li>`).join('')}
      </ul></nav>
      <div class="header-actions"><a href="#contacts" class="btn-lime">Забронювати</a>
        <button class="menu-toggle" id="menu-toggle" aria-label="Меню" aria-expanded="false"><span></span><span></span><span></span></button>
      </div>
    </div></header>
    ${homeHTML}
    <footer class="site-footer"><div class="container"><div class="footer-grid">
      <div class="footer-brand"><a href="#top" class="logo"><span>LVIV ARENA</span><span class="logo-dot">●</span></a><p>ТВОЯ ГРА. ТВОЯ АРЕНА.</p></div>
      <div class="footer-location"><p class="footer-label">ЗНАЙДИ СВОЮ АРЕНУ</p><address>Львів, вулиця Личаківська, 120</address><a class="footer-map-link" href="https://www.google.com/maps/search/?api=1&amp;query=Львів%2C%20вулиця%20Личаківська%2C%20120" target="_blank" rel="noopener noreferrer">Відкрити в Google Maps ↗</a></div>
      <nav class="footer-links" aria-label="Посилання у футері" data-cms-navigation="footer">${footerLinks.map(linkMarkup).join('')}</nav>
      <iframe class="footer-map" title="Карта: Львів, вулиця Личаківська, 120" src="https://www.google.com/maps?q=Львів%2C%20вулиця%20Личаківська%2C%20120&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Lviv Arena. Усі права захищено.</span><span>ТВОЯ ГРА. ТВОЯ АРЕНА.</span></div></div></footer>
  `
}

async function loadTariffs() {
  const query = new URLSearchParams({ limit: '50', depth: '0', sort: 'name' })
  query.set('where[isActive][equals]', 'true')
  const response = await fetch(apiURL(`/api/tariffs?${query}`))
  if (!response.ok) throw new Error(`Tariffs API returned ${response.status}`)
  const data = await response.json()
  return Array.isArray(data.docs) && data.docs.length ? data.docs : fallbackTariffs
}

async function loadComputerCounts() {
  const query = new URLSearchParams({ limit: '1000', depth: '0' })
  query.set('where[status][equals]', 'available')
  const response = await fetch(apiURL(`/api/computers?${query}`))
  if (!response.ok) throw new Error(`Computers API returned ${response.status}`)
  const data = await response.json()
  if (!Array.isArray(data.docs)) return fallbackCounts
  const counts = { STANDART: 0, PRO: 0, VIP: 0, STREAMER: 0 }
  for (const computer of data.docs) {
    if (computer.category in counts) counts[computer.category] += 1
  }
  return counts
}

function renderCmsBlocks(blocks) {
  if (!Array.isArray(blocks)) return ''
  return renderBlocks(blocks)
}

function bindSinglePageNavigation() {
  const toggle = document.getElementById('menu-toggle')
  const nav = document.getElementById('primary-nav')
  if (!toggle || !nav) return
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open')
    toggle.setAttribute('aria-expanded', String(isOpen))
  })
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('open')
    toggle.setAttribute('aria-expanded', 'false')
  }))
}

function bindGalleryLightbox() {
  const lightbox = document.getElementById('gallery-lightbox')
  if (!lightbox) return
  const image = document.getElementById('gallery-lightbox-img')
  const fields = {
    badge: document.getElementById('gallery-lightbox-badge'),
    zone: document.getElementById('gallery-lightbox-zone'),
    title: document.getElementById('gallery-lightbox-title'),
    description: document.getElementById('gallery-lightbox-desc'),
    specs: document.getElementById('gallery-lightbox-specs'),
  }
  const close = () => {
    lightbox.classList.remove('active')
    lightbox.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
  }
  const open = (item) => {
    const title = item.dataset.galleryTitle || ''
    const zone = item.dataset.galleryZone || ''
    image.src = item.dataset.gallerySrc || ''
    image.alt = title
    fields.badge.textContent = zone
    fields.zone.textContent = zone ? `ЗОНА ${zone}` : ''
    fields.title.textContent = title
    fields.description.textContent = item.dataset.galleryDesc || ''
    fields.specs.replaceChildren(...(item.dataset.gallerySpecs || '').split(',').map((value) => value.trim()).filter(Boolean).map((value) => {
      const chip = document.createElement('span')
      chip.className = 'gallery-spec-chip'
      chip.textContent = value
      return chip
    }))
    lightbox.classList.add('active')
    lightbox.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
  }
  document.querySelectorAll('.arena-gallery-item').forEach((item) => {
    item.addEventListener('click', (event) => {
      if (!event.target.closest('.gallery-book-btn')) open(item)
    })
    item.addEventListener('keydown', (event) => {
      if (event.target.closest('.gallery-book-btn')) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open(item)
      }
    })
  })
  lightbox.querySelectorAll('[data-close-lightbox]').forEach((button) => button.addEventListener('click', close))
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox.classList.contains('active')) close()
  })
}

async function render() {
  const [common, pageResult, tariffsResult, countsResult] = await Promise.allSettled([
    getCommonData(),
    getPage('home'),
    loadTariffs(),
    loadComputerCounts(),
  ])
  const globals = common.status === 'fulfilled' ? common.value : null
  const page = pageResult.status === 'fulfilled' ? pageResult.value : null
  const tariffs = tariffsResult.status === 'fulfilled' ? tariffsResult.value : fallbackTariffs
  const counts = countsResult.status === 'fulfilled' ? countsResult.value : fallbackCounts

  const homepage = renderHomePage(tariffs, counts, {
    tariffsUnavailable: tariffsResult.status === 'rejected',
    computersUnavailable: countsResult.status === 'rejected',
  }).replace('<main>', '<main id="top">').replace(/href="\/booking(?:\?[^\"]*)?"/g, 'href="#contacts"')
  const blocks = renderCmsBlocks(page?.layout)
  const homeWithCMS = blocks ? homepage.replace('</main>', `${blocks}</main>`) : homepage

  if (page?.meta?.title) document.title = `${page.meta.title} | Lviv Arena`
  document.querySelector('#app').innerHTML = renderSiteShell(homeWithCMS, globals)
  const heroText = lexicalText(page?.hero?.richText?.root)
  if (heroText) {
    const title = document.querySelector('.hero-title')
    const words = heroText.split(/\s+/)
    const split = Math.max(1, Math.ceil(words.length / 2))
    title.innerHTML = `${escapeHtml(words.slice(0, split).join(' '))}<span class="gradient-text">${escapeHtml(words.slice(split).join(' '))}</span>`
  }
  bindSinglePageNavigation()
  bindGalleryLightbox()
}

function lexicalText(node) {
  if (!node || typeof node !== 'object') return ''
  if (node.type === 'text') return String(node.text || '')
  return Array.isArray(node.children) ? node.children.map(lexicalText).join(' ').trim() : ''
}

render().catch((error) => {
  console.error('Landing render failed:', error)
  document.querySelector('#app').innerHTML = '<main class="fatal-state"><h1>Сайт тимчасово недоступний</h1><p>Спробуйте оновити сторінку.</p></main>'
})
