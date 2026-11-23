import { describe, expect, it } from 'vitest'
import { benchmarkById, coreBenchmarks, normalizeValue, sourceForVendor } from '../scripts/research/registry.mjs'

describe('benchmark registry', () => {
  it('has exactly the eight core benchmarks', () => {
    expect(coreBenchmarks().map((b) => b.label)).toEqual([
      'GPQA Diamond', "Humanity's Last Exam", 'SciCode', 'Terminal-Bench 2.1',
      'IFBench', 'Tau2', 'MMMU-Pro', 'FrontierCode 2.0',
    ])
  })
  it('normalizes a fraction benchmark to percent and rejects unit mismatch', () => {
    expect(normalizeValue('gpqa-diamond', 0.897)).toBe(89.7)
    expect(normalizeValue('gpqa-diamond', 89.7)).toBe(89.7)
    expect(normalizeValue('unknown-benchmark', 0.5)).toBeNull()
  })
  it('resolves vendor sources and skips OpenCode-internal models', () => {
    expect(sourceForVendor('moonshotai/kimi-k3')?.orgs).toContain('moonshotai')
    expect(sourceForVendor(undefined as unknown as string)).toBeNull()
  })
  it('exposes GPQA by id', () => {
    expect(benchmarkById('gpqa-diamond')?.label).toBe('GPQA Diamond')
  })
})
