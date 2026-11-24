import { describe, expect, it } from 'vitest'
import { rankTargets } from '../scripts/research/targets.mjs'

const models = [
  { id: 'kilo-gateway/nvidia/nemotron-3.5-lightning:free', owned_by: 'kilo-gateway' },
  { id: 'cloudflare-workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast', owned_by: 'cloudflare-workers-ai' },
  { id: 'kilo-gateway/reflection/beam-free', owned_by: 'kilo-gateway' },
  { id: 'groq-cloud/openai/gpt-oss-120b', owned_by: 'groq-cloud' },
  { id: 'groq-cloud/qwen/qwen3.8-27b', owned_by: 'groq-cloud' },
  { id: 'kilo-gateway/kilo-auto/free', owned_by: 'kilo-gateway' },
  { id: 'kilo-gateway/baidu/ernie-5.5-flash-preview:free', owned_by: 'kilo-gateway' },
  { id: 'openrouter/google/gemma-4-31b-it:free', owned_by: 'openrouter' },
  { id: 'dots3-note', owned_by: 'openrouter' },
]

describe('router target ranking', () => {
  it('prefers fast non-reasoning models and keeps only exact provider ids', () => {
    const ranked = rankTargets(models)
    expect(ranked[0]).toMatchObject({ id: 'groq-cloud/qwen/qwen3.8-27b', provider: 'groq-cloud' })
    expect(ranked.some((target) => target.id === 'dots3-note')).toBe(false)
  })

  it('puts a second provider before lower-priority models of the first', () => {
    const ranked = rankTargets(models)
    const ids = ranked.map((target) => target.id)
    expect(ranked[1].provider).not.toBe(ranked[0].provider)
    expect(ids.indexOf('kilo-gateway/kilo-auto/free')).toBeLessThan(
      ids.indexOf('cloudflare-workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast'),
    )
  })

  it('deprioritises reasoning and oversized-model names', () => {
    const ranked = rankTargets(models)
    const ids = ranked.map((target) => target.id)
    expect(ids.indexOf('kilo-gateway/kilo-auto/free')).toBeLessThan(
      ids.indexOf('kilo-gateway/nvidia/nemotron-3.5-lightning:free'),
    )
  })
})
