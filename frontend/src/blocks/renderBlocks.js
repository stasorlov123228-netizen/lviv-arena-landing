const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]))

function lexicalText(node) {
  if (!node || typeof node !== 'object') return ''
  if (node.type === 'text') return escapeHTML(node.text || '')
  const children = Array.isArray(node.children) ? node.children.map(lexicalText).join('') : ''
  if (node.type === 'paragraph') return `<p>${children}</p>`
  if (node.type === 'heading') {
    const tag = /^h[1-6]$/.test(node.tag) ? node.tag : 'h2'
    return `<${tag}>${children}</${tag}>`
  }
  if (node.type === 'list') return `<ul>${children}</ul>`
  if (node.type === 'listitem') return `<li>${children}</li>`
  if (node.type === 'link') return `<span>${children}</span>`
  return children
}

export function richTextToHTML(richText) {
  const root = richText?.root
  return Array.isArray(root?.children) ? root.children.map(lexicalText).join('') : ''
}

export function richTextToText(richText) {
  const read = (node) => {
    if (!node || typeof node !== 'object') return ''
    if (node.type === 'text') return String(node.text || '')
    return Array.isArray(node.children) ? node.children.map(read).join('') : ''
  }
  return read(richText?.root).trim()
}

function singlePageHref(href) {
  if (typeof href !== 'string') return '#top'
  if (href.startsWith('#')) return href
  if (href.startsWith('/') && !href.startsWith('//')) {
    const route = href.split(/[?#]/, 1)[0].replace(/\/$/, '')
    if (route === '' || route === '/home') return '#top'
    if (route === '/booking') return '#booking'
    if (route === '/computers' || route === '/tariffs') return '#zones'
    if (route === '/news') return '#experience'
    return '#top'
  }
  return href
}

const hrefFromLink = (item) => {
  const link = item?.link || item
  if (link?.type === 'custom' && typeof link.url === 'string') {
    if (link.url.startsWith('/') && !link.url.startsWith('//')) return singlePageHref(link.url)
    return '#booking'
  }
  const value = link?.reference?.value
  const slug = typeof value === 'object' ? value.slug : null
  return slug === 'home' ? '#top' : '#contacts'
}

function button(item, index = 0) {
  const link = item?.link || item
  const label = escapeHTML(link?.label || (index === 0 ? 'Забронювати місце' : 'Дізнатись більше'))
  return `<a class="button ${index === 0 ? 'button-primary' : 'button-quiet'}" href="${escapeHTML(hrefFromLink(item))}">${label}<span aria-hidden="true">↗</span></a>`
}

function cta(block) {
  return `<section class="section"><div class="container"><div class="cta-banner">${richTextToHTML(block.richText) || '<h2>Твоя гра починається тут</h2><p>Обирай місце та бронюй зручний час.</p>'}<div class="cms-cta-actions">${(block.links || []).map(button).join('')}</div></div></div></section>`
}

function content(block) {
  const columns = Array.isArray(block.columns) ? block.columns : []
  if (!columns.length) return ''
  return `<section class="section"><div class="container cms-content">${columns.map((column) => `<article class="feature-card cms-column">${richTextToHTML(column.richText)}</article>`).join('')}</div></section>`
}

function media(block) {
  const mediaItem = block.media?.value || block.media
  const url = typeof mediaItem?.url === 'string' ? mediaItem.url : ''
  const alt = escapeHTML(mediaItem?.alt || 'Lviv Arena')
  return url ? `<section class="section"><div class="container"><figure class="cms-media"><img src="${escapeHTML(url)}" alt="${alt}" loading="lazy"></figure></div></section>` : ''
}

const renderers = { cta, content, mediaBlock: media }

export function renderBlocks(blocks = []) {
  if (!Array.isArray(blocks)) return ''
  return blocks.map((block) => {
    const render = renderers[block?.blockType]
    return render ? render(block) : ''
  }).join('')
}
