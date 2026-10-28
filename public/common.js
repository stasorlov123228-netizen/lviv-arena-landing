function isSafeHref(value) {
  if (typeof value !== 'string' || value.length === 0) return false
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function createLink(item) {
  if (!item || typeof item.label !== 'string' || !item.label.trim() || !isSafeHref(item.href)) return null
  const anchor = document.createElement('a')
  anchor.href = item.href
  anchor.textContent = item.label
  if (item.newTab === true) {
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
  }
  return anchor
}

function renderNavigation(element, navItems, isHeader) {
  if (!element || !Array.isArray(navItems) || navItems.length === 0) return
  const mobileAuth = isHeader ? element.querySelector('#mobile-auth-slot') : null
  for (const child of Array.from(element.children)) {
    if (child !== mobileAuth) child.remove()
  }

  const items = [...navItems]
  if (!items.some((item) => item?.href === '/#gallery')) {
    const aboutIndex = items.findIndex((item) => item?.href === '/#about')
    const galleryItem = { label: 'Галерея', href: '/#gallery', newTab: false }
    if (aboutIndex !== -1) {
      items.splice(aboutIndex + 1, 0, galleryItem)
    } else {
      items.push(galleryItem)
    }
  }

  for (const item of items) {
    const link = createLink(item)
    if (!link) continue
    if (isHeader) {
      const listItem = document.createElement('li')
      listItem.dataset.cmsNavItem = 'true'
      listItem.append(link)
      element.insertBefore(listItem, mobileAuth)
    } else {
      element.append(link)
    }
  }
}

function initGalleryLightbox() {
  const lightbox = document.getElementById('gallery-lightbox')
  if (!lightbox) return

  const imgEl = document.getElementById('gallery-lightbox-img')
  const badgeEl = document.getElementById('gallery-lightbox-badge')
  const zoneEl = document.getElementById('gallery-lightbox-zone')
  const titleEl = document.getElementById('gallery-lightbox-title')
  const descEl = document.getElementById('gallery-lightbox-desc')
  const specsEl = document.getElementById('gallery-lightbox-specs')
  const bookBtnEl = document.getElementById('gallery-lightbox-book-btn')

  function openLightbox(item) {
    const src = item.getAttribute('data-gallery-src')
    if (!src) return

    const title = item.getAttribute('data-gallery-title') || ''
    const zone = item.getAttribute('data-gallery-zone') || ''
    const desc = item.getAttribute('data-gallery-desc') || ''
    const specsRaw = item.getAttribute('data-gallery-specs') || ''
    const tariff = item.getAttribute('data-gallery-tariff') || ''

    if (imgEl) {
      imgEl.src = src
      imgEl.alt = title
    }
    if (badgeEl) badgeEl.textContent = zone
    if (zoneEl) zoneEl.textContent = zone ? `ЗОНА ${zone}` : ''
    if (titleEl) titleEl.textContent = title
    if (descEl) descEl.textContent = desc

    if (specsEl) {
      specsEl.innerHTML = ''
      const specs = specsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      for (const spec of specs) {
        const chip = document.createElement('span')
        chip.className = 'gallery-spec-chip'
        chip.textContent = spec
        specsEl.appendChild(chip)
      }
    }

    if (bookBtnEl) {
      bookBtnEl.href = tariff ? `/booking?tariff=${encodeURIComponent(tariff)}` : '/booking'
      bookBtnEl.textContent = tariff ? `Забронювати (${zone})` : 'Забронювати це місце'
    }

    lightbox.classList.add('active')
    lightbox.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
  }

  function closeLightbox() {
    lightbox.classList.remove('active')
    lightbox.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
  }

  document.querySelectorAll('.arena-gallery-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.gallery-book-btn')) return
      openLightbox(item)
    })
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('.gallery-book-btn')) return
        e.preventDefault()
        openLightbox(item)
      }
    })
  })

  lightbox.querySelectorAll('[data-close-lightbox]').forEach((btn) => {
    btn.addEventListener('click', closeLightbox)
  })

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
      closeLightbox()
    }
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGalleryLightbox)
} else {
  initGalleryLightbox()
}

try {
  const response = await fetch('/api/common', { headers: { Accept: 'application/json' } })
  if (response.ok) {
    const result = await response.json()
    const data = result?.data
    renderNavigation(document.querySelector('[data-cms-navigation="header"]'), data?.header?.navItems, true)
    renderNavigation(document.querySelector('[data-cms-navigation="footer"]'), data?.footer?.navItems, false)
  }
} catch {

}
