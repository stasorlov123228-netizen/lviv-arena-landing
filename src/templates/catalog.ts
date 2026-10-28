const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
const displayCategory = (value: unknown): string => value === 'STREAMER' ? 'STREAM' : String(value ?? '')
const newsImageBySlug: Record<string, string> = {
  'lviv-arena-vidchynyaie-dveri': '/images/news-opening.webp',
  'chotyry-igrovi-zony-lviv-arena': '/images/news-zones.webp',
  'stream-zona-lviv-arena': '/images/news-stream.webp',
}
const defaultNewsImage = '/images/gaming-arena-pexels-9072216.webp'

function publishedDate(value: unknown): { datetime: string; label: string } | null {
  const date = typeof value === 'string' ? new Date(value) : value instanceof Date ? value : null
  if (!date || !Number.isFinite(date.getTime())) return null
  return {
    datetime: date.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Kyiv' }).format(date),
  }
}

function renderLexicalNode(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  if (Array.isArray(value)) return value.map(renderLexicalNode).join('')
  const node = value as Record<string, unknown>
  const children = renderLexicalNode(node.children)

  if (node.type === 'text') {
    let text = escape(node.text)
    const format = Number(node.format) || 0
    if (format & 8) text = `<code>${text}</code>`
    if (format & 1) text = `<strong>${text}</strong>`
    if (format & 2) text = `<em>${text}</em>`
    if (format & 4) text = `<s>${text}</s>`
    if (format & 16) text = `<u>${text}</u>`
    return text
  }

  switch (node.type) {
    case 'root': return children
    case 'paragraph': return children ? `<p>${children}</p>` : ''
    case 'heading': {
      const tag = typeof node.tag === 'string' && /^h[2-6]$/.test(node.tag) ? node.tag : 'h2'
      return `<${tag}>${children}</${tag}>`
    }
    case 'quote': return `<blockquote>${children}</blockquote>`
    case 'list': return node.listType === 'number' ? `<ol>${children}</ol>` : `<ul>${children}</ul>`
    case 'listitem': return `<li>${children}</li>`
    case 'linebreak': return '<br>'
    case 'horizontalrule': return '<hr>'
    case 'link': {
      const fields = node.fields && typeof node.fields === 'object' ? node.fields as Record<string, unknown> : {}
      const href = typeof fields.url === 'string' ? fields.url : ''
      const safeHref = href.startsWith('/') && !href.startsWith('//') || /^https?:\/\//i.test(href)
      return safeHref ? `<a href="${escape(href)}">${children}</a>` : children
    }
    default: return children
  }
}

export function renderNewsArticle(doc: Record<string, unknown>): string {
  const slug = String(doc.slug ?? '')
  const title = String(doc.title ?? 'Новини Lviv Arena')
  const meta = doc.meta && typeof doc.meta === 'object' ? doc.meta as Record<string, unknown> : {}
  const description = typeof meta.description === 'string' ? meta.description : ''
  const image = newsImageBySlug[slug] ?? defaultNewsImage
  const date = publishedDate(doc.publishedAt)
  const dateMarkup = date ? `<time datetime="${date.datetime}">${escape(date.label)}</time>` : ''
  const content = doc.content && typeof doc.content === 'object' ? doc.content as Record<string, unknown> : {}
  const body = renderLexicalNode(content.root ?? doc.content)

  return `<main class="container section news-article-page">
    <a class="news-article-back" href="/news"><span aria-hidden="true">←</span> Усі новини</a>
    <article class="news-article">
      <header class="news-article-header"><span class="news-article-eyebrow">НОВИНИ КЛУБУ · LVIV ARENA</span><h1>${escape(title)}</h1>${description ? `<p class="news-article-lead">${escape(description)}</p>` : ''}${dateMarkup ? `<div class="news-article-meta">${dateMarkup}</div>` : ''}</header>
      <figure class="news-article-cover"><img src="${image}" alt="Ігрові комп’ютери та крісла в кіберспортивній арені" fetchpriority="high"></figure>
      <div class="news-article-body">${body || '<p>Матеріал готується.</p>'}</div>
      <footer class="news-article-footer"><a class="btn-lime" href="/booking">Забронювати комп’ютер</a><a class="news-article-more" href="/news">Більше новин <span aria-hidden="true">→</span></a></footer>
    </article>
  </main>`
}

const displayComputerStatus = (value: unknown): string => ({
  available: 'Вільний',
  occupied: 'Зайнятий',
  maintenance: 'На обслуговуванні',
  offline: 'Вимкнений',
}[String(value)] ?? 'Невідомий статус')

function renderComputerShowcase(title: string, rows: Array<Record<string, unknown>>): string {
  const cards = rows.map((row) => {
    const available = row.status === 'available'
    const statusClass = available ? 'is-available' : 'is-unavailable'
    const description = typeof row.description === 'string' ? row.description : ''
    const specs = description.split(',').map((item) => item.trim()).filter(Boolean)
    const specsHtml = specs.length
      ? `<ul class="computer-spec-list">${specs.map((spec) => `<li>${escape(spec)}</li>`).join('')}</ul>`
      : '<p class="computer-spec-empty">Характеристики для цього комп’ютера ще не додані.</p>'
    const price = row.tariffPricePerHour
    const hasPrice = price !== null && price !== undefined && price !== '' && Number.isFinite(Number(price))
    const tariffName = String(row.tariffName ?? '')
    const tariffTitle = String(row.tariffTitle ?? tariffName)
    const computerNumber = String(row.computerNumber ?? '')

    return `<article class="computer-showcase-card">
      <div class="computer-card-topline"><span class="computer-category-chip">${escape(displayCategory(row.category))}</span><span class="computer-status ${statusClass}"><span aria-hidden="true"></span>${escape(displayComputerStatus(row.status))}</span></div>
      <h2><a href="/computers/${encodeURIComponent(computerNumber)}">${escape(computerNumber)}</a></h2>
      <p class="computer-card-kicker">${escape(tariffTitle)} · тариф ${escape(tariffName)}</p>
      <div class="computer-specs-wrap"><span class="computer-specs-title">Характеристики</span>${specsHtml}</div>
      <div class="computer-card-footer"><div class="computer-card-price"><span>Вартість</span><strong>${hasPrice ? `${escape(price)} грн/год` : 'Ціну уточнюйте'}</strong></div>${available ? `<a class="btn-lime computer-book-link" href="/booking?tariff=${encodeURIComponent(tariffName)}">Обрати тариф</a>` : '<span class="computer-unavailable-note">Зараз недоступний</span>'}</div>
    </article>`
  }).join('')

  return `<main class="container section computers-page"><header class="computer-catalog-heading"><span class="section-tag">LVIV ARENA · ІГРОВІ ЗОНИ</span><h1>${escape(title)}</h1><p>Чотири зони клубу - від комфортної гри до стримерського сетапу. Характеристики та статус показані з каталогу клубу.</p></header>${cards ? `<div class="computer-showcase-grid">${cards}</div>` : '<p class="computer-showcase-empty">Комп’ютери для активних тарифів поки не налаштовані.</p>'}</main>`
}

export function renderCatalog(title: string, rows: Array<Record<string, unknown>>, kind: 'computers' | 'tariffs' | 'posts'): string {
  if (kind === 'computers') return renderComputerShowcase(title, rows)

  const cards = rows.map((row, index) => {
    if (kind === 'tariffs') return `<article class="card"><h2><a href="/tariffs/${encodeURIComponent(String(row.id))}">${escape(row.title || row.name)}</a></h2><p>${escape(displayCategory(row.computerCategory))}</p><p>${escape(row.description || '')}</p><p>${typeof row.pricePerHour === 'number' ? `${escape(row.pricePerHour)} грн/год` : 'Ціну уточнюйте в клубі'}</p></article>`
    const href = `/news/${encodeURIComponent(String(row.slug))}`
    const image = newsImageBySlug[String(row.slug)] ?? defaultNewsImage
    const description = row.meta && typeof row.meta === 'object' ? (row.meta as Record<string, unknown>).description : ''
    const date = publishedDate(row.publishedAt)
    const dateMarkup = date ? `<time datetime="${date.datetime}">${escape(date.label)}</time>` : ''
    return `<article class="news-card news-card-focus-${index % 3 + 1}">
      <a class="news-card-image-link" href="${escape(href)}" tabindex="-1" aria-hidden="true"><img class="news-card-image" src="${image}" alt="Ігрові комп’ютери та крісла в кіберспортивній арені" loading="lazy" decoding="async"></a>
      <div class="news-card-content"><span class="news-card-eyebrow">НОВИНИ КЛУБУ</span><h2><a href="${escape(href)}">${escape(row.title)}</a></h2><p>${escape(description)}</p>
        <footer class="news-card-footer">${dateMarkup}<a href="${escape(href)}" class="news-card-more">Читати новину <span aria-hidden="true">→</span></a></footer>
      </div>
    </article>`
  }).join('')
  return `<main class="container section"><span class="section-tag">LVIV ARENA</span><h1>${escape(title)}</h1>${cards ? `<div class="${kind === 'posts' ? 'news-grid' : 'grid'}">${cards}</div>` : '<p class="card">Матеріалів поки немає.</p>'}</main>`
}

export function renderRecord(title: string, fields: Array<[string, unknown]>): string {
  return `<main class="container section"><a href="javascript:history.back()" class="btn-secondary">Назад</a><h1>${escape(title)}</h1><article class="card">${fields.map(([label, value]) => `<p><strong>${escape(label)}:</strong> ${escape(value === 'STREAMER' ? 'STREAM' : value ?? '-')}</p>`).join('')}</article></main>`
}

export function renderPageLinks(path: string, page: number, totalPages: number): string {
  if (totalPages <= 1) return ''
  const href = (target: number) => `${path}?page=${target}`
  return `<nav class="container section pagination" aria-label="Сторінки">${page > 1 ? `<a rel="prev" href="${escape(href(page - 1))}">Попередня</a>` : ''}<span>Сторінка ${page} з ${totalPages}</span>${page < totalPages ? `<a rel="next" href="${escape(href(page + 1))}">Наступна</a>` : ''}</nav>`
}

export function renderCMSPage(title: string, doc: Record<string, unknown>, inquiryKind?: 'feedback' | 'partnership'): string {
  const text: string[] = []
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(visit); return }
    const item = value as Record<string, unknown>
    if (typeof item.text === 'string') text.push(item.text)
    for (const [key, child] of Object.entries(item)) if (key !== 'text') visit(child)
  }
  visit(doc.hero); visit(doc.layout); visit(doc.content)
  const body = text.length ? `<div class="card cms-copy">${text.map((line) => `<p>${escape(line)}</p>`).join('')}</div>` : '<p class="card">Сторінка ще не має опублікованого тексту.</p>'
  const form = inquiryKind ? `<section class="card"><h2>${inquiryKind === 'feedback' ? 'Зворотний зв’язок' : 'Партнерство'}</h2><form data-inquiry="${inquiryKind}"><label>Ім’я<input name="name" maxlength="100" required></label><label>Email<input type="email" name="email" required></label><label>Телефон<input name="phone" type="tel" maxlength="40"></label><label>Повідомлення<textarea name="message" maxlength="5000" required></textarea></label><button class="btn-lime">Надіслати</button><p role="status" data-inquiry-message></p></form></section>` : ''
  return `<main class="container section"><span class="section-tag">LVIV ARENA</span><h1>${escape(title)}</h1>${body}${form}</main>`
}
