import { load } from 'cheerio'
import { deniedHosts, sourceForVendor } from './registry.mjs'

export function isPrivateUrl(url) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '::1' || host.endsWith('.local') || host.endsWith('.internal')) return true
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true
    if (/^169\.254\./.test(host)) return true
    const second = Number(host.split('.')[1])
    if (/^172\./.test(host) && second >= 16 && second <= 31) return true
    return false
  } catch {
    return true
  }
}

export function officialUrlAllowed(url, canonicalId) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' || isPrivateUrl(url)) return false
  if (deniedHosts().includes(parsed.hostname.toLowerCase())) return false

  const source = sourceForVendor(canonicalId)
  if (!source) return false

  const hostAllowed = source.hosts.some(
    (host) => parsed.hostname.toLowerCase() === host || parsed.hostname.toLowerCase().endsWith(`.${host}`),
  )
  const segments = parsed.pathname.split('/').filter(Boolean)
  const orgAllowed =
    (parsed.hostname === 'github.com' || parsed.hostname === 'huggingface.co' || parsed.hostname === 'www.github.com') &&
    segments.length > 0 &&
    source.orgs.some((org) => segments[0].toLowerCase() === org.toLowerCase())
  return hostAllowed || orgAllowed
}

function resolveDdgHref(href) {
  if (!href) return null
  if (href.startsWith('//duckduckgo.com/l/?')) {
    const query = href.slice(href.indexOf('?') + 1)
    const target = new URLSearchParams(query).get('uddg')
    return target ? decodeURIComponent(target) : null
  }
  if (href.startsWith('http://') || href.startsWith('https://')) return href
  return null
}

function fallbackUrls(model) {
  const source = sourceForVendor(model.canonicalId)
  if (!source) return []
  const urls = []
  for (const org of source.orgs) {
    urls.push(`https://github.com/${org}`)
    urls.push(`https://huggingface.co/${org}`)
  }
  for (const host of source.hosts) urls.push(`https://${host}`)
  return urls.map((url) => ({ url, title: `${model.name} official source` }))
}

export async function search({ model, benchmark, fetchImpl = fetch }) {
  const query = `"${model.name}" "${benchmark.label}" benchmark score`
  let html = ''
  try {
    const response = await fetchImpl(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'user-agent': 'OpenCodeAnalysisResearch/1.0', accept: 'text/html' },
      signal: AbortSignal.timeout(20_000),
    })
    if (response.ok && response.status !== 202 && response.status !== 429) {
      html = await response.text()
    }
  } catch {
    html = ''
  }

  if (!html || /captcha|anomaly-modal/i.test(html)) {
    return fallbackUrls(model).filter((result) => officialUrlAllowed(result.url, model.canonicalId)).slice(0, 10)
  }

  const $ = load(html)
  const results = []
  $('a.result__a, a[class*="result__a"]').each((_, element) => {
    const url = resolveDdgHref($(element).attr('href'))
    if (!url || !officialUrlAllowed(url, model.canonicalId)) return
    results.push({ url, title: $(element).text().trim() })
  })
  if (results.length === 0) {
    return fallbackUrls(model).filter((result) => officialUrlAllowed(result.url, model.canonicalId)).slice(0, 10)
  }
  return results.slice(0, 10)
}
