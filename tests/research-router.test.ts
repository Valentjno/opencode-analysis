import { describe, expect, it } from 'vitest'
import { redact } from '../scripts/research/redact.mjs'
import { chat, listRouterModels } from '../scripts/research/router-client.mjs'
import { extract } from '../scripts/research/extract.mjs'
import { benchmarkById } from '../scripts/research/registry.mjs'
import { makeModel } from './fixtures/dataset'

const model = makeModel('kimi-k3', { name: 'Kimi K3', canonicalId: 'moonshotai/kimi-k3' })
const benchmark = benchmarkById('gpqa-diamond')
const page = { text: 'Kimi K3 results: GPQA Diamond 93.5%.', hash: 'sha256:abc', sourceUrl: 'https://github.com/MoonshotAI/Kimi-K3' }
const content = JSON.stringify({
  value: 93.5, unit: '%', quote: 'Kimi K3 results: GPQA Diamond 93.5%.',
  sourceUrl: 'https://github.com/MoonshotAI/Kimi-K3',
})

function reply({ status = 200, text = content, provider = 'groq-cloud' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'x-free-llm-provider' ? provider : null) },
    json: async () => ({ choices: [{ message: { content: text } }] }),
  }
}

describe('router client and extraction', () => {
  it('redacts fake keys and bearer tokens', () => {
    expect(redact('key gsk_abc123 failed', ['gsk_abc123'])).not.toContain('gsk_abc123')
  })

  it('sends temperature 0 and the requested router profile', async () => {
    let captured
    await chat({
      profile: 'auto:smart',
      messages: [{ role: 'user', content: 'hello' }],
      fetchImpl: async (_url, options) => {
        captured = JSON.parse(options.body)
        return reply()
      },
    })
    expect(captured.temperature).toBe(0)
    expect(captured.model).toBe('auto:smart')
    expect(captured.response_format).toBeUndefined()
  })

  it('reads the provider from the router response header', async () => {
    const result = await chat({ profile: 'auto:smart', messages: [], fetchImpl: async () => reply() })
    expect(result.provider).toBe('groq-cloud')
  })

  it('lists exact provider/model ids from the router', async () => {
    const models = await listRouterModels({
      fetchImpl: async (url) => {
        expect(url).toContain('/v1/models?all=1')
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'groq-cloud/qwen/qwen3.8-27b', owned_by: 'groq-cloud' }] }),
        }
      },
    })
    expect(models).toHaveLength(1)
    expect(models[0].id).toBe('groq-cloud/qwen/qwen3.8-27b')
  })

  it('sends a larger output budget when asked', async () => {
    let captured
    await chat({
      profile: 'kilo-gateway/kilo-auto/free',
      maxTokens: 6000,
      messages: [],
      fetchImpl: async (_url, options) => {
        captured = JSON.parse(options.body)
        return reply()
      },
    })
    expect(captured.max_tokens).toBe(6000)
    expect(captured.model).toBe('kilo-gateway/kilo-auto/free')
  })

  it('returns structured extraction from a JSON response', async () => {
    const result = await extract({ model, benchmark, page, profile: 'auto:smart', fetchImpl: async () => reply() })
    expect(result).toMatchObject({ value: 93.5, unit: '%', provider: 'groq-cloud' })
  })

  it('instructs the model to answer with JSON only or a null sentinel', async () => {
    let captured
    await extract({
      model, benchmark, page, profile: 'auto:smart',
      fetchImpl: async (_url, options) => {
        captured = JSON.parse(options.body)
        return reply()
      },
    })
    const system = captured.messages[0].content
    expect(system).toContain('ONLY a single JSON object')
    expect(system).toContain('"value": null')
    expect(system).toContain('verbatim')
  })

  it('parses JSON wrapped in a markdown code fence', async () => {
    const fenced = '```json\n' + content + '\n```'
    const result = await extract({ model, benchmark, page, profile: 'auto:smart', fetchImpl: async () => reply({ text: fenced }) })
    expect(result).toMatchObject({ value: 93.5 })
  })

  it('parses loosely formatted extraction text', async () => {
    const loose = 'value: 93.5, unit: %, quote: "Kimi K3 results: GPQA Diamond 93.5%.", sourceUrl: https://github.com/MoonshotAI/Kimi-K3'
    const result = await extract({ model, benchmark, page, profile: 'auto:smart', fetchImpl: async () => reply({ text: loose }) })
    expect(result).toMatchObject({ value: 93.5, quote: 'Kimi K3 results: GPQA Diamond 93.5%.' })
  })

  it('builds a deterministic quote from a table row', async () => {
    const tablePage = {
      ...page,
      text: 'Benchmark | Kimi K3 | Claude\nGPQA Diamond | 93.5 | 92.6',
    }
    const result = await extract({
      model, benchmark, page: tablePage, profile: 'groq-cloud/qwen/qwen3.8-27b',
      fetchImpl: async () => reply({
        provider: 'groq-cloud',
        text: JSON.stringify({ value: 93.5, unit: '%', quote: 'made up', sourceUrl: '' }),
      }),
    })
    expect(result).toMatchObject({ value: 93.5, quote: 'GPQA Diamond | 93.5 | 92.6' })
  })

  it('rejects a table column that belongs to a different model variant', async () => {
    const freeModel = makeModel('hy4-flash-free', {
      name: 'Hy4 flash Free',
      canonicalId: 'tencent/hy4-flash',
    })
    const basePage = {
      ...page,
      text: '| Benchmark | Hy4 flash Base | Hy4 Base |\n| MMMU-Pro (Standard, 10 opts) | 52.0 | 59.6 |',
    }
    const result = await extract({
      model: freeModel,
      benchmark: benchmarkById('mmmu-pro'),
      page: basePage,
      profile: 'groq-cloud/qwen/qwen3.8-27b',
      fetchImpl: async () => reply({
        text: JSON.stringify({ value: 52.0, unit: '%', quote: 'made up', sourceUrl: '' }),
      }),
    })
    expect(result).toBeNull()
  })

  it('recovers a value from prose by quoting the page itself', async () => {
    const richPage = { ...page, text: 'Kimi K3 model card. GPQA Diamond: 93.5%. Other score: 12%.' }
    const result = await extract({
      model, benchmark, page: richPage, profile: 'auto:smart',
      fetchImpl: async () => reply({ text: 'The score is 93.5, based on the model card.' }),
    })
    expect(result).toMatchObject({ value: 93.5, quote: 'Kimi K3 model card. GPQA Diamond: 93.5%.' })
  })

  it('rejects prose when the page does not contain a matching quote', async () => {
    const result = await extract({
      model, benchmark, page, profile: 'auto:smart',
      fetchImpl: async () => reply({ text: 'The score is 77.7, trust me.' }),
    })
    expect(result).toBeNull()
  })

  it('includes the redacted provider error detail on a 400', async () => {
    const bad = {
      ok: false, status: 400,
      headers: { get: () => null },
      text: async () => '{"error":{"message":"bad request detail"}}',
    }
    await expect(chat({ profile: 'auto:smart', messages: [], fetchImpl: async () => bad })).rejects.toThrow('bad request detail')
  })

  it('returns null on malformed JSON and retries once on 429', async () => {
    expect(await extract({
      model, benchmark, page, profile: 'auto:smart',
      fetchImpl: async () => reply({ text: 'not json' }),
    })).toBeNull()

    let calls = 0
    const result = await extract({
      model, benchmark, page, profile: 'auto:smart',
      fetchImpl: async () => {
        calls += 1
        return calls === 1 ? reply({ status: 429 }) : reply()
      },
    })
    expect(result).not.toBeNull()
    expect(calls).toBe(2)
  })
})
