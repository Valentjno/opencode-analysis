import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  filterModels,
  sortModels,
  vendorOptions,
} from '../src/lib/filters'
import { makeModel } from './fixtures/dataset'

const models = [
  makeModel('a', { name: 'Alpha', vendor: 'Anthropic', ii: 50, price: 4, training: false, zdr: true }),
  makeModel('b', { name: 'Beta', vendor: 'Google', ii: 30, price: 0.2, training: true, zdr: false }),
  makeModel('c', { name: 'Gamma', vendor: 'Google', ii: null, price: 0 }),
  makeModel('d', { name: 'Delta', vendor: 'OpenAI', ii: 40, price: 1, training: false, zdr: false }),
]

describe('filterModels', () => {
  it('filters by access, rating, privacy, vendor and search', () => {
    expect(filterModels(models, { ...DEFAULT_FILTERS, access: 'go' })).toHaveLength(4)
    expect(filterModels(models, { ...DEFAULT_FILTERS, access: 'free' })).toHaveLength(0)
    expect(
      filterModels(
        [makeModel('free', { go: false, free: true })],
        { ...DEFAULT_FILTERS, access: 'free' },
      ).map((m) => m.id),
    ).toEqual(['free'])
    expect(filterModels(models, { ...DEFAULT_FILTERS, rating: 'rated' })).toHaveLength(3)
    expect(filterModels(models, { ...DEFAULT_FILTERS, rating: 'unrated' }).map((m) => m.id)).toEqual(['c'])
    expect(filterModels(models, { ...DEFAULT_FILTERS, privacy: 'trains' }).map((m) => m.id)).toEqual(['b'])
    expect(filterModels(models, { ...DEFAULT_FILTERS, privacy: 'private' }).map((m) => m.id)).toEqual(['a'])
    expect(filterModels(models, { ...DEFAULT_FILTERS, vendor: 'Google' })).toHaveLength(2)
    expect(filterModels(models, { ...DEFAULT_FILTERS, query: 'DELTA' }).map((m) => m.id)).toEqual(['d'])
    expect(filterModels(models, { ...DEFAULT_FILTERS, query: 'no-such-model' })).toHaveLength(0)
  })

  it('lists vendors once and sorted', () => {
    expect(vendorOptions(models)).toEqual(['Anthropic', 'Google', 'OpenAI'])
  })
})

describe('sortModels', () => {
  it('sorts unrated models last in both score directions', () => {
    const desc = sortModels(models, { ...DEFAULT_FILTERS, sortKey: 'score', sortDirection: 'desc' })
    expect(desc.map((m) => m.id)).toEqual(['a', 'd', 'b', 'c'])
    const asc = sortModels(models, { ...DEFAULT_FILTERS, sortKey: 'score', sortDirection: 'asc' })
    expect(asc.slice(0, 3).map((m) => m.id)).toEqual(['b', 'd', 'a'])
    expect(asc.at(-1)?.id).toBe('c')
  })

  it('sorts missing prices and allowances last', () => {
    const noPrice = [...models, makeModel('e', { ii: 20 })]
    const sorted = sortModels(noPrice, { ...DEFAULT_FILTERS, sortKey: 'price', sortDirection: 'desc' })
    expect(sorted.at(-1)?.id).toBe('e')
  })

  it('does not mutate the input', () => {
    const before = models.map((m) => m.id)
    sortModels(models, { ...DEFAULT_FILTERS, sortKey: 'name' })
    expect(models.map((m) => m.id)).toEqual(before)
  })
})
