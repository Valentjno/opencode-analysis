import { redact } from './redact.mjs'

const ROUTER_URL = 'http://127.0.0.1:4000/v1/chat/completions'
const TIMEOUT_MS = 20_000

export function providerFromResponse(response) {
  return response?.headers?.get?.('x-free-llm-provider') ?? null
}

export async function chat({
  profile,
  messages,
  fetchImpl = fetch,
  apiKey = process.env.FREE_LLM_API_KEY ?? 'fllm-local',
}) {
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response
    try {
      response = await fetchImpl(ROUTER_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: profile,
          messages,
          temperature: 0,
          max_tokens: 600,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (error) {
      lastError = error
      if (attempt === 0) continue
      break
    }

    if (!response.ok) {
      let detail = ''
      try {
        detail = String(await response.text()).slice(0, 300)
      } catch {
        detail = ''
      }
      lastError = new Error(redact(`Router returned HTTP ${response.status}: ${detail}`))
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) continue
      break
    }

    let data
    try {
      data = await response.json()
    } catch {
      lastError = new Error('Router returned invalid JSON')
      break
    }
    const text = data?.choices?.[0]?.message?.content
    if (typeof text !== 'string') {
      lastError = new Error('Router response had no message content')
      break
    }
    return { text, provider: providerFromResponse(response) ?? 'unknown' }
  }
  throw lastError ?? new Error('Router request failed')
}

export { redact }
