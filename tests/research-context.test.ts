import { describe, expect, it } from 'vitest'
import { findQuote, focusExcerpt, mentionsBenchmark, tableColumnMatches } from '../scripts/research/context.mjs'
import { benchmarkById } from '../scripts/research/registry.mjs'
import { makeModel } from './fixtures/dataset'

const model = makeModel('kimi-k3', { name: 'Kimi K3', canonicalId: 'moonshotai/kimi-k3' })
const benchmark = benchmarkById('gpqa-diamond')
const table = [
  'Benchmark | Kimi K3(max) | Claude Fable 5(max) | GPT-5.6 Sol(max)',
  'Reasoning & Knowledge',
  'GPQA Diamond | 93.5 | 92.6 | 94.1',
  'HLE-Full | 43.5 / 56.0 | 53.3 / 63.0 | 44.5 / 58.0',
].join('\n')

describe('focused page context', () => {
  it('selects the table header and the benchmark row from a long page', () => {
    const page = `${'filler '.repeat(3_000)}\n${table}\n${'trailing '.repeat(3_000)}`
    const excerpt = focusExcerpt(page, model, benchmark)
    expect(excerpt).toContain('Kimi K3(max)')
    expect(excerpt).toContain('GPQA Diamond | 93.5')
    expect(excerpt.length).toBeLessThanOrEqual(6_000)
  })

  it('quotes the exact table row containing the value', () => {
    expect(findQuote(table, model, benchmark, 93.5)).toBe('GPQA Diamond | 93.5 | 92.6 | 94.1')
  })

  it('matches the value in the model column, not another column', () => {
    expect(tableColumnMatches(table, model, benchmark, 93.5)).toBe(true)
    expect(tableColumnMatches(table, model, benchmark, 92.6)).toBe(false)
  })

  it('rejects an ambiguous multi-value cell', () => {
    const hle = benchmarkById('hle')
    expect(tableColumnMatches(table, model, hle, 43.5)).toBe(false)
  })

  it('does not treat a base-model column as the free chat model', () => {
    const freeModel = makeModel('hy4-flash-free', {
      name: 'Hy4 flash Free',
      canonicalId: 'tencent/hy4-flash',
    })
    const baseTable = [
      '| Benchmark | Hy4 flash Base | Hy4 Base |',
      '| MMMU-Pro (Standard, 10 opts) | 52.0 | 59.6 |',
    ].join('\n')
    expect(tableColumnMatches(baseTable, freeModel, benchmarkById('mmmu-pro'), 52.0)).toBe(false)
    expect(findQuote(baseTable, freeModel, benchmarkById('mmmu-pro'), 52.0)).toContain('MMMU-Pro')
  })

  it('keeps the table header when the benchmark row is far below it', () => {
    const rows = [
      'Benchmark | Kimi K3.1 Pro(max) | Claude Fable 5.1(max)',
      ...Array.from({ length: 30 }, (_, index) => `filler row ${index} ${'x'.repeat(80)}`),
      'GPQA-Diamond | 94.2 | 93.7',
    ]
    const excerpt = focusExcerpt(rows.join('\n'), model, benchmark)
    expect(excerpt).toContain('Kimi K3.1 Pro(max)')
    expect(excerpt).toContain('GPQA-Diamond | 94.2 | 93.7')
  })

  it('matches benchmark names with different separators but not SuperGPQA', () => {
    expect(mentionsBenchmark('GPQA-Diamond | 94.2', benchmark)).toBe(true)
    expect(mentionsBenchmark('MMMU-Pro | 84.1', benchmarkById('mmmu-pro'))).toBe(true)
    expect(mentionsBenchmark('SuperGPQA | 62.7', benchmark)).toBe(false)
  })
})
