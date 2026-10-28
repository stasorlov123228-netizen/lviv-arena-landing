const configuredCMS = import.meta.env.VITE_CMS_URL?.replace(/\/$/, '')

export function apiURL(path) {
  return configuredCMS ? `${configuredCMS}${path}` : path
}

const requestJSON = async (url) => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`CMS request failed (${response.status})`)
  return response.json()
}

export async function getCommonData() {
  const result = await requestJSON(apiURL('/api/common'))
  return result.data
}

export async function getPage(path = 'home') {
  const result = await requestJSON(apiURL(`/api/page?path=${encodeURIComponent(path)}`))
  return result.data
}
