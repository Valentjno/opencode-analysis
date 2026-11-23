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
      now: NOW,
      fetchImpl: async (url) => {
        const target = String(url)
        if (target.includes('duckduckgo')) {
          return htmlResponse(target, '<a class="result__a" href="https://github.com/MoonshotAI/Kimi-K3">Kimi K3</a>')
        }
        if (target.includes('github.com')) return htmlResponse(target, `<html><body>${pageText}</body></html>`)
        return htmlResponse(target, '')
      },
      chatImpl: async () => {
        chatCalls += 1
        return chatResponse(chatCalls === 1 ? 'google-ai-studio' : 'groq-cloud')
      },
    })

    expect(feed.models[0].benchmarks[0].status).toBe('verified')
    expect(feed.run.rejected).toBeGreaterThanOrEqual(0)
    expect(JSON.stringify(feed)).not.toMatch(/gsk_|AIza|fllm-/)
  })
})
