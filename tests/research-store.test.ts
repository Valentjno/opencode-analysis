import { describe, expect, it } from 'vitest'
import { selectGaps } from '../scripts/research/gaps.mjs'
import { applyOverrides, markStale, mergeResearch } from '../scripts/research/store.mjs'
import { makeModel } from './fixtures/dataset'

const NOW = '2026-11-23T12:00:00.000Z'
const DAY = 86_400_000
const empty = {
  schemaVersion: 1,
  generatedAt: NOW,
  run: { status: 'ok', modelsConsidered: 0, modelsResearched: 0, accepted: 0, rejected: 0, reasons: {} },
  models: [],
}

const entry = {
  modelId: 'kimi-k3',
  benchmarkId: 'gpqa-diamond',
  label: 'GPQA Diamond',
  value: 93.5,
  unit: '%',
  sourceUrl: 'https://github.com/MoonshotAI/Kimi-K3',
  sourceTitle: 'Kimi K3',
  quote: 'Kimi K3 — GPQA Diamond: 93.5%',
  retrievedAt: NOW,
  sourceHash: 'sha256:abc',
  method: 'two-provider+quote',
  confidence: 'high',
  modelsUsed: ['auto:smart', 'auto:spread'],
  status: 'verified',
  stale: false,
  supersededByAA: false,
}

describe('gap selection and research store', () => {
  it('skips rated and no-identity models', () => {
    const rated = makeModel('rated', { ii: 60 })
    const noIdentity = makeModel('big-pickle', { vendor: 'opencode', canonicalId: null, ii: null })
    const gaps = selectGaps({
      snapshot: { models: [rated, noIdentity] }, research: empty, overrides: empty, now: NOW,
    })
    expect(gaps.map((gap) => gap.model.id)).toEqual([])
  })

  it('caps pairs and skips benchmarks already in AA', () => {
    const model = makeModel('m', { ii: null, canonicalId: 'moonshotai/m', evals: { 'GPQA Diamond': 0.9 } })
    const gaps = selectGaps({
      snapshot: { models: [model] }, research: empty, overrides: empty, now: NOW,
    })
    expect(gaps.some((gap) => gap.benchmark.id === 'gpqa-diamond')).toBe(false)
    expect(gaps.length).toBeLessThanOrEqual(3)
  })

  it('preserves locked manual overrides', () => {
    const override = { ...entry, method: 'manual', locked: true }
    const next = mergeResearch({
      previous: empty,
      overrides: { entries: [override] },
      candidates: [{ ...entry, value: 1 }],
      now: NOW,
    })
    expect(next.models[0].benchmarks[0].value).toBe(93.5)
    expect(next.models[0].benchmarks[0].locked).toBe(true)
  })

  it('stores the human model name with a new entry', () => {
    const feed = mergeResearch({ previous: empty, overrides: empty, candidates: [entry], now: NOW })
    expect(feed.models[0].name).toBe('Kimi K3')
  })

  it('marks entries stale after 30 days and superseded when AA has an index', () => {
    const feed = mergeResearch({ previous: empty, overrides: empty, candidates: [entry], now: NOW })
    const old = markStale(feed, Date.parse(NOW) + 31 * DAY)
    expect(old.models[0].benchmarks[0].stale).toBe(true)

    const eligible = makeModel('kimi-k3', { ii: null, canonicalId: 'moonshotai/kimi-k3' })
    const ratedSnapshot = { models: [{ ...eligible, aa: { intelligenceIndex: 50 } }] }
    const superseded = applyOverrides(feed, empty, ratedSnapshot)
    expect(superseded.models[0].benchmarks[0].supersededByAA).toBe(true)
  })
})
