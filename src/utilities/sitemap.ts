export type SitemapEntry = { path: string; lastModified?: string | null }

const escapeXml = (value: string): string => value.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]!)

export function renderSitemapXml(siteUrl: string, entries: SitemapEntry[]): string {
  const base = siteUrl.replace(/\/+$/, '')
  const uniqueEntries = new Map<string, SitemapEntry>()
  for (const entry of entries) uniqueEntries.set(entry.path.replace(/^\/+/, ''), entry)
  const urls = [...uniqueEntries.values()].map(({ path, lastModified }) => {
    const loc = `${base}/${path.replace(/^\/+/, '')}`
    const lastmod = lastModified && !Number.isNaN(Date.parse(lastModified))
      ? `<lastmod>${escapeXml(new Date(lastModified).toISOString())}</lastmod>`
      : ''
    return `<url><loc>${escapeXml(loc)}</loc>${lastmod}</url>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`
}
