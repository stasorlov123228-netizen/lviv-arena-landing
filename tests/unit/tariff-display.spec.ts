import { describe, expect, it } from 'vitest'
import { renderDashboardPage } from '@/templates/dashboard'
import { renderHomePage } from '@/templates/home'
import { renderCatalog, renderPageLinks, renderRecord } from '@/templates/catalog'
import { renderLayout } from '@/templates/layout'
import { renderSitemapXml } from '@/utilities/sitemap'

describe('tariff display names and hourly prices', () => {
  it('renders the configured hourly prices on the home page', () => {
    const html = renderHomePage([
      { name: 'DEFAULT', title: 'STANDARD', computerCategory: 'STANDART', pricePerHour: 80 },
      { name: 'PRO', title: 'PRO', computerCategory: 'PRO', pricePerHour: 120 },
      { name: 'VIP', title: 'VIP', computerCategory: 'VIP', pricePerHour: 150 },
      { name: 'STREAM', title: 'STREAM', computerCategory: 'STREAMER', pricePerHour: 140 },
    ])

    for (const price of [80, 120, 150, 140]) expect(html).toContain(`${price} грн/год`)
    expect(html).toContain('>STREAM</h3>')
    expect(html).not.toContain('Стримерська')
  })

  it('shows a clear empty state when there are no active tariffs', () => {
    const html = renderHomePage([], { STANDART: 30, PRO: 20, VIP: 12, STREAMER: 8 })

    expect(html).toContain('Тарифи скоро з’являться')
    expect(html).not.toContain('грн/год')
  })

  it('keeps real zero and missing catalog values distinct', () => {
    const html = renderHomePage([
      { name: 'DEFAULT', title: 'Standard', computerCategory: 'STANDART', pricePerHour: 0 },
      { name: 'VIP', title: 'VIP', computerCategory: 'VIP', pricePerHour: null },
    ], { STANDART: 30, VIP: 0 })

    expect(html).toContain('0 грн/год')
    expect(html).toContain('Ціну уточнюйте в клубі')
    expect(html).toContain('0 місць у категорії')
  })

  it('shows STREAM while retaining STREAMER as the saved category value in admin controls', () => {
    const html = renderDashboardPage({ id: 1, name: 'Test', email: 'test@example.com', role: 'admin' })
    expect(html).toContain('<option value="STREAMER">STREAM</option>')
  })

  it('shows STREAM for public category records without changing stored values', () => {
    expect(renderCatalog('Комп’ютери', [{ computerNumber: 'PC-63', category: 'STREAMER' }], 'computers')).toContain('STREAM')
    expect(renderCatalog('Тарифи', [{ id: 1, name: 'STREAM', title: 'STREAM', computerCategory: 'STREAMER' }], 'tariffs')).toContain('STREAM')
    expect(renderRecord('Комп’ютер', [['Категорія', 'STREAMER']])).toContain('STREAM')
  })

  it('renders every persisted computer state as a clear Ukrainian label', () => {
    const html = renderCatalog('Комп’ютери', [
      { computerNumber: 'PC-01', category: 'STANDART', status: 'available' },
      { computerNumber: 'PC-02', category: 'STANDART', status: 'occupied' },
      { computerNumber: 'PC-03', category: 'STANDART', status: 'maintenance' },
      { computerNumber: 'PC-04', category: 'STANDART', status: 'offline' },
    ], 'computers')
    for (const label of ['Вільний', 'Зайнятий', 'На обслуговуванні', 'Вимкнений']) expect(html).toContain(label)
  })
})

describe('public discovery pages', () => {
  it('does not render a public search route in site navigation', () => {
    const html = renderLayout({ title: 'Lviv Arena', description: 'Club', content: '' })
    expect(html).not.toContain('href="/search"')
  })

  it('renders old-news pagination links', () => {
    expect(renderPageLinks('/news', 2, 3)).toContain('href="/news?page=3"')
  })

  it('escapes sitemap locations and includes valid last-modified dates', () => {
    const xml = renderSitemapXml('https://example.test/', [{ path: 'news/a&b', lastModified: '2026-01-01T00:00:00.000Z' }])
    expect(xml).toContain('https://example.test/news/a&amp;b')
    expect(xml).toContain('<lastmod>2026-01-01T00:00:00.000Z</lastmod>')
  })
})
