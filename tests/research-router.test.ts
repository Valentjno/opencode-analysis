import { describe, expect, it } from 'vitest'
import { redact } from '../scripts/research/redact.mjs'
import { chat } from '../scripts/research/router-client.mjs'
import { extract } from '../scripts/research/extract.mjs'
import { benchmarkById } from '../scripts/research/registry.mjs'
import { makeModel } from './fixtures/dataset'

const model = makeModel('kimi-k3', { name: 'Kimi K3', canonicalId: 'moonshotai/kimi-k3' })
const benchmark = benchmarkById('gpqa-diamond')
const page = { text: 'Kimi K3 results: GPQA Diamond 93.5%.', hash: 'sha256:abc' }
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
