import { describe, expect, it } from 'vitest'
import { validateResearch } from '../scripts/validate-research.mjs'

const ok = {
  schemaVersion: 1,
  generatedAt: '2026-11-23T12:30:00.000Z',
  run: { status: 'ok', modelsConsidered: 11, modelsResearched: 1, accepted: 1, rejected: 0, reasons: {} },
  models: [{ id: 'kimi-k3', name: 'Kimi K3', benchmarks: [{
    benchmarkId: 'gpqa-diamond', label: 'GPQA Diamond', value: 93.5, unit: '%',
    sourceUrl: 'https://github.com/MoonshotAI/Kimi-K3', sourceTitle: 'Kimi K3',
    quote: 'Kimi K3 — GPQA Diamond: 93.5%', retrievedAt: '2026-11-23T12:29:00.000Z',
    sourceHash: 'sha256:abc', method: 'two-provider+quote', confidence: 'high',
    modelsUsed: ['google-ai-studio/gemini-3.8-flash', 'groq-cloud/openai/gpt-oss-120b'],
    status: 'verified', stale: false, supersededByAA: false,
  }] }],
}

describe('research validator', () => {
  it('accepts a valid feed', () => expect(validateResearch(ok)).toEqual([]))
  it('rejects a duplicate benchmark', () => {
    const bad = structuredClone(ok)
    bad.models[0].benchmarks.push({ ...bad.models[0].benchmarks[0] })
    expect(validateResearch(bad).some((e) => e.includes('duplicate'))).toBe(true)
  })
  it('rejects a non-official source for a real model', () => {
    const bad = structuredClone(ok)
    bad.models[0].benchmarks[0].sourceUrl = 'https://evil.example.com/kimi-k3'
    expect(validateResearch(bad).some((e) => e.includes('official'))).toBe(true)
  })
  it('rejects a non-https source', () => {
    const bad = structuredClone(ok)
    bad.models[0].benchmarks[0].sourceUrl = 'http://example.com'
    expect(validateResearch(bad).some((e) => e.includes('https'))).toBe(true)
  })
})
