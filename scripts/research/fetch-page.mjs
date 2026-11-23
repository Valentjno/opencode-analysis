import { createHash } from 'node:crypto'
import { isPrivateUrl } from './search.mjs'

const MAX_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 20_000
const MAX_REDIRECTS = 3

function contentTypeAllowed(response) {
  const type = (response.headers?.get?.('content-type') ?? '').toLowerCase()
  return type.includes('text/html') || type.includes('text/plain')
}

export async function fetchPage(url, { fetchImpl = fetch, maxBytes = MAX_BYTES, timeoutMs = TIMEOUT_MS } = {}) {
  let current = url
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response
    try {
      response = await fetchImpl(current, {
        headers: { 'user-agent': 'OpenCodeAnalysisResearch/1.0', accept: 'text/html,text/plain' },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'follow',
      })
    } catch {
      return null
    }

    const finalUrl = response.url || current
    if (!finalUrl.startsWith('https://') || isPrivateUrl(finalUrl)) return null
    if (!response.ok || !contentTypeAllowed(response)) return null

    const declared = Number(response.headers?.get?.('content-length') ?? 0)
    if (declared > maxBytes) return null

    let text
    try {
      text = await response.text()
    } catch {
      return null
    }
    if (Buffer.byteLength(text, 'utf8') > maxBytes) return null

    const normalized = text.replace(/\s+/g, ' ').trim()
    const hash = `sha256:${createHash('sha256').update(normalized).digest('hex')}`
    return { text: normalized, hash }
  }
  return null
}
