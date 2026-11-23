import { describe, expect, it } from 'vitest'
import { formatBenchmark, visibleExternal } from '../src/lib/benchmarks'
import type { ResearchEntry, ResearchFeed } from '../src/lib/types'
import { makeModel } from './fixtures/dataset'

const NOW = '2026-11-23T12:00:00.000Z'
const verified: ResearchEntry = {
  benchmarkId: 'gpqa-diamond',
  label: 'GPQA Diamond',
  value: 89.7,
  unit: '%',
  sourceUrl: 'https://github.com/MoonshotAI/Kimi-K3',
  sourceTitle: 'Kimi K3',
  quote: 'Kimi K3 — GPQA Diamond: 89.7%',
  retrievedAt: NOW,
  sourceHash: 'sha256:abc',
  method: 'two-provider+quote',
  confidence: 'high',
  modelsUsed: ['google-ai-studio', 'groq-cloud'],
  status: 'verified',
  stale: false,
  supersededByAA: false,
}

const feed = (entries: ResearchEntry[]): ResearchFeed => ({
  schemaVersion: 1,
  generatedAt: NOW,
  run: { status: 'ok', modelsConsidered: 1, modelsResearched: 1, accepted: 1, rejected: 0, reasons: {} },
  models: [{ id: 'kimi-k3', name: 'Kimi K3', benchmarks: entries }],
})

describe('benchmark display helpers', () => {
  it('formats fraction evals as percentages but raw scores as numbers', () => {
    expect(formatBenchmark('GPQA Diamond', 0.897)).toBe('89.7%')
    expect(formatBenchmark('GDPval', 1068.94)).toBe('1,068.94')
  })

  it('hides external data when AA has an index or benchmark', () => {
    const rated = makeModel('kimi-k3', { ii: 60 })
    expect(visibleExternal(feed([verified]), rated)).toEqual([])

    const aaHasBenchmark = makeModel('kimi-k3', { ii: null, evals: { 'GPQA Diamond': 0.9 } })
    expect(visibleExternal(feed([verified]), aaHasBenchmark)).toEqual([])
  })

  it('hides conflict and single-source entries', () => {
    const unrated = makeModel('kimi-k3', { ii: null })
    const rejected = feed([
      { ...verified, status: 'conflict' },
      { ...verified, status: 'single-source' },
    ])
    expect(visibleExternal(rejected, unrated)).toEqual([])
  })
})
