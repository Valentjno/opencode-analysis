import { createHash } from 'node:crypto'
import { load } from 'cheerio'
import { isPrivateUrl } from './search.mjs'

const MAX_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 20_000
const MAX_REDIRECTS = 3
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308])

function contentTypeAllowed(response) {
  const type = (response.headers?.get?.('content-type') ?? '').toLowerCase()
  return type.includes('text/html') || type.includes('text/plain') || type.includes('text/markdown')
}

function normalizeLines(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

export function htmlToText(html) {
  const $ = load(html)
  $('script,style,noscript,svg,template,iframe').remove()

  $('tr').each((_, row) => {
    const cells = $(row)
      .find('td,th')
      .map((_, cell) => $(cell).text().replace(/\s+/g, ' ').trim())
      .get()
    if (cells.length) {
      const line = cells.join(' | ').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      $(row).replaceWith(`\n${line}\n`)
    }
  })

  $('p,div,br,li,h1,h2,h3,h4,h5,h6,thead,tbody,table,section,article,header,footer').each((_, element) => {
    $(element).append('\n')
  })

  return normalizeLines($.root().text())
}

function looksLikeHtmlTable(text) {
  return /<(?:table|tr|td|th)[\s>]/i.test(String(text ?? ''))
}

export async function fetchPage(url, {
  fetchImpl = fetch,
  maxBytes = MAX_BYTES,
  timeoutMs = TIMEOUT_MS,
  allowedUrl = null,
} = {}) {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response
    try {
      response = await fetchImpl(current, {
        headers: { 'user-agent': 'OpenCodeAnalysisResearch/1.0', accept: 'text/html,text/plain' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'manual',
      })
    } catch {
      return null
    }

    if (REDIRECT_CODES.has(response.status)) {
      const location = response.headers?.get?.('location')
      if (!location) return null
      let next
      try {
        next = new URL(location, current).toString()
      } catch {
        return null
      }
      if (!next.startsWith('https://') || isPrivateUrl(next)) return null
      if (allowedUrl && !allowedUrl(next)) return null
      current = next
      continue
    }

    const finalUrl = response.url || current
    if (!finalUrl.startsWith('https://') || isPrivateUrl(finalUrl)) return null
    if (!response.ok || !contentTypeAllowed(response)) return null

    const declared = Number(response.headers?.get?.('content-length') ?? 0)
    if (declared > maxBytes) return null

    let raw
    try {
      raw = await response.text()
    } catch {
      return null
    }
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) return null

    const type = (response.headers?.get?.('content-type') ?? '').toLowerCase()
    const text = type.includes('text/html') || looksLikeHtmlTable(raw) ? htmlToText(raw) : normalizeLines(raw)
    if (!text) return null
    if (Buffer.byteLength(text, 'utf8') > maxBytes) return null

    const hash = `sha256:${createHash('sha256').update(text).digest('hex')}`
    return { text, hash }
  }
  return null
}
