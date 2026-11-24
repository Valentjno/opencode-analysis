import { describe, expect, it } from 'vitest'
import { runResearch } from '../scripts/research/cli.mjs'
import { makeModel } from './fixtures/dataset'

const NOW = '2026-11-23T12:00:00.000Z'
const emptyFeed = {
  schemaVersion: 1,
  generatedAt: NOW,
  run: { status: 'ok', modelsConsidered: 0, modelsResearched: 0, accepted: 0, rejected: 0, reasons: {} },
  models: [],
}
const snapshot = {
  models: [makeModel('kimi-k3', { name: 'Kimi K3', canonicalId: 'moonshotai/kimi-k3', ii: null })],
}
const quote = 'Kimi K3 results: GPQA Diamond 93.5%.'
const availableModels = [
  { id: 'groq-cloud/qwen/qwen3.8-27b', owned_by: 'groq-cloud' },
  { id: 'kilo-gateway/kilo-auto/free', owned_by: 'kilo-gateway' },
]
const pageText = `${quote} Other: 1%`

function htmlResponse(url, text) {
  return {
    ok: true,
    status: 200,
    url,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'text/html' : null) },
    text: async () => text,
  }
}

function chatResponse(provider) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name.toLowerCase() === 'x-free-llm-provider' ? provider : null) },
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            value: 93.5,
            unit: '%',
            quote,
            sourceUrl: 'https://github.com/MoonshotAI/Kimi-K3',
          }),
        },
      }],
    }),
  }
}

describe('research orchestrator', () => {
  it('runs gaps → search → fetch → extract → verify → store with mocks', async () => {
    let chatCalls = 0
    const feed = await runResearch({
      snapshot,
      research: emptyFeed,
      overrides: { entries: [] },
      maxModels: 1,
      maxPerModel: 1,
      availableModels,
      now: NOW,
      fetchImpl: async (url) => {
        const target = String(url)
        if (target.includes('duckduckgo')) {
          return htmlResponse(target, '<a class="result__a" href="https://github.com/MoonshotAI/Kimi-K3">Kimi K3</a>')
        }
        if (target === 'https://huggingface.co/moonshotai/kimi-k3/raw/main/README.md') {
          return htmlResponse(target, `<html><body>${pageText}</body></html>`)
        }
        return htmlResponse(target, '')
      },
      chatImpl: async () => {
        chatCalls += 1
        return chatResponse(chatCalls === 1 ? 'google-ai-studio' : 'groq-cloud')
      },
    })

    expect(feed.models[0].benchmarks[0].status).toBe('verified')
    expect(feed.models[0].benchmarks[0].sourceUrl).toBe(
      'https://huggingface.co/moonshotai/kimi-k3/raw/main/README.md',
    )
    expect(feed.run.rejected).toBeGreaterThanOrEqual(0)
    expect(JSON.stringify(feed)).not.toMatch(/gsk_|AIza|fllm-/)
  })

  it('uses the fetched URL, not the URL returned by the model', async () => {
    const feed = await runResearch({
      snapshot, research: emptyFeed, overrides: { entries: [] },
      maxModels: 1, maxPerModel: 1, availableModels, now: NOW,
      fetchImpl: async (url) => {
        const target = String(url)
        if (target.includes('duckduckgo')) return htmlResponse(target, '<a class="result__a" href="https://github.com/MoonshotAI/Kimi-K3">Kimi K3</a>')
        return htmlResponse(target, `<html><body>${pageText}</body></html>`)
      },
      chatImpl: (() => {
        let calls = 0
        return async () => ({
          ok: true, status: 200,
          headers: { get: (name) => (name.toLowerCase() === 'x-free-llm-provider' ? (calls++ === 0 ? 'google-ai-studio' : 'groq-cloud') : null) },
          json: async () => ({ choices: [{ message: { content: JSON.stringify({
            value: 93.5, unit: '%', quote,
            sourceUrl: 'https://evil.example.com/steal',
          }) } }] }),
        })
      })(),
    })
    expect(feed.models[0].benchmarks[0].sourceUrl).toBe(
      'https://huggingface.co/moonshotai/kimi-k3/raw/main/README.md',
    )
    expect(feed.models[0].benchmarks[0].sourceUrl).not.toContain('evil.example.com')
  })

  it('re-verifies entries older than 30 days', async () => {
    const oldEntry = {
      modelId: 'kimi-k3', benchmarkId: 'gpqa-diamond', label: 'GPQA Diamond', value: 1, unit: '%',
      sourceUrl: 'https://github.com/MoonshotAI/Kimi-K3', sourceTitle: 'Kimi K3', quote,
      retrievedAt: '2026-10-01T00:00:00.000Z', sourceHash: 'sha256:old',
      method: 'two-provider+quote', confidence: 'high', modelsUsed: [], status: 'verified',
      stale: false, supersededByAA: false,
    }
    const research = {
      ...emptyFeed,
      models: [{ id: 'kimi-k3', name: 'Kimi K3', benchmarks: [oldEntry] }],
    }
    const feed = await runResearch({
      snapshot, research, overrides: { entries: [] },
      maxModels: 1, maxPerModel: 1, availableModels, now: NOW,
      fetchImpl: async (url) => {
        const target = String(url)
        if (target.includes('duckduckgo')) return htmlResponse(target, '<a class="result__a" href="https://github.com/MoonshotAI/Kimi-K3">Kimi K3</a>')
        return htmlResponse(target, `<html><body>${pageText}</body></html>`)
      },
      chatImpl: (() => {
        let calls = 0
        return async () => chatResponse(calls++ === 0 ? 'google-ai-studio' : 'groq-cloud')
      })(),
    })
    expect(feed.models[0].benchmarks[0].retrievedAt).toBe(NOW)
  })

  it('marks external data superseded when AA later publishes an index', async () => {
    const entry = {
      modelId: 'kimi-k3', benchmarkId: 'gpqa-diamond', label: 'GPQA Diamond', value: 89.7, unit: '%',
      sourceUrl: 'https://github.com/MoonshotAI/Kimi-K3', sourceTitle: 'Kimi K3', quote,
      retrievedAt: NOW, sourceHash: 'sha256:abc', method: 'two-provider+quote',
      confidence: 'high', modelsUsed: [], status: 'verified', stale: false, supersededByAA: false,
    }
    const research = { ...emptyFeed, models: [{ id: 'kimi-k3', name: 'Kimi K3', benchmarks: [entry] }] }
    const rated = { models: [makeModel('kimi-k3', { name: 'Kimi K3', canonicalId: 'moonshotai/kimi-k3', ii: 50 })] }
    const feed = await runResearch({
      snapshot: rated, research, overrides: { entries: [] }, maxModels: 1, maxPerModel: 1, availableModels, now: NOW,
      fetchImpl: async () => htmlResponse('https://example.test', ''),
      chatImpl: async () => chatResponse('groq-cloud'),
    })
    expect(feed.models[0].benchmarks[0].supersededByAA).toBe(true)
  })

  it('rejects an out-of-range extraction instead of publishing it raw', async () => {
    const feed = await runResearch({
      snapshot, research: emptyFeed, overrides: { entries: [] },
      maxModels: 1, maxPerModel: 1, availableModels, now: NOW,
      fetchImpl: async (url) => {
        const target = String(url)
        if (target.includes('duckduckgo')) return htmlResponse(target, '<a class="result__a" href="https://github.com/MoonshotAI/Kimi-K3">Kimi K3</a>')
        return htmlResponse(target, '<html><body>Kimi K3 GPQA Diamond 150%.</body></html>')
      },
      chatImpl: async () => ({
        ok: true, status: 200,
        headers: { get: (name) => (name.toLowerCase() === 'x-free-llm-provider' ? 'google-ai-studio' : null) },
        json: async () => ({ choices: [{ message: { content: JSON.stringify({
          value: 150, unit: '%', quote: 'Kimi K3 GPQA Diamond 150%',
          sourceUrl: 'https://github.com/MoonshotAI/Kimi-K3',
        }) } }] }),
      }),
    })
    expect(feed.run.accepted).toBe(0)
  })
})
