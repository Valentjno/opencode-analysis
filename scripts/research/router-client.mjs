import { redact } from './redact.mjs'

const ROUTER_BASE = (process.env.FREE_LLM_ROUTER_URL ?? 'http://127.0.0.1:4000').replace(/\/+$/, '')
const ROUTER_URL = `${ROUTER_BASE}/v1/chat/completions`
const MODELS_URL = `${ROUTER_BASE}/v1/models?all=1`
const TIMEOUT_MS = 75_000

function defaultKey() {
  return process.env.FREE_LLM_API_KEY ?? 'fllm-local'
}

export function providerFromResponse(response) {
  return response?.headers?.get?.('x-free-llm-provider') ?? null
}

export function modelFromResponse(response) {
  return response?.headers?.get?.('x-free-llm-model') ?? null
}

export async function listRouterModels({
  fetchImpl = fetch,
  apiKey = defaultKey(),
  timeoutMs = 20_000,
} = {}) {
  const response = await fetchImpl(MODELS_URL, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`Router model list returned HTTP ${response.status}`)
  const data = await response.json()
  return Array.isArray(data?.data) ? data.data : []
}

export async function chat({
  profile,
  model,
  messages,
  fetchImpl = fetch,
  apiKey = defaultKey(),
  maxTokens = 3_000,
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
          model: model ?? profile,
          messages,
          temperature: 0,
          max_tokens: maxTokens,
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
    const message = data?.choices?.[0]?.message
    const text = message?.content
    if (typeof text !== 'string') {
      lastError = new Error('Router response had no message content')
      break
    }
    return {
      text,
      reasoning: typeof message?.reasoning_content === 'string' ? message.reasoning_content : '',
      provider: providerFromResponse(response) ?? 'unknown',
      model: modelFromResponse(response),
    }
  }
  throw lastError ?? new Error('Router request failed')
}

export { redact }
