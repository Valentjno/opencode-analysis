import { describe, expect, it } from 'vitest'
// @ts-expect-error - the refresher module is plain JavaScript with no .d.ts
import { medianPrice, recommend } from '../scripts/lib/recommend.mjs'
import { makeModel } from './fixtures/dataset'

const set = () => [
  makeModel('planner', { name: 'Planner', ii: 50, price: 4, training: false, zdr: false, monthlyGo: 30 }),
  makeModel('builder', { name: 'Builder', ii: 45, price: 1, training: false, zdr: true, monthlyGo: 20 }),
  makeModel('trainer', { name: 'Trainer', ii: 30, price: 0.2, training: true, zdr: false, monthlyGo: 10 }),
  makeModel('unrated', { price: 0, training: null }),
  makeModel('cheap', { name: 'Cheap', ii: 25, price: 0.1, training: false, zdr: true, monthlyGo: 5 }),
]

describe('medianPrice', () => {
  it('handles odd and even counts and ignores null prices', () => {
    expect(medianPrice([makeModel('a', { price: 1 }), makeModel('b', { price: 3 })])).toBe(2)
    expect(
      medianPrice([
        makeModel('a', { price: 1 }),
        makeModel('b', { price: 3 }),
        makeModel('c', { price: 5 }),
      ]),
    ).toBe(3)
    expect(medianPrice([makeModel('a'), makeModel('b', { price: 2 })])).toBe(2)
  })
})

describe('recommend', () => {
  it('picks all five slots with deterministic values', () => {
    const picks = recommend(set())
    expect(picks.planner.modelId).toBe('planner')
    expect(picks.builder.modelId).toBe('builder')
    expect(picks.medium.modelId).toBe('trainer')
    expect(picks.cheapest.modelId).toBe('cheap')
    expect(picks.private.modelId).toBe('builder')
    expect(picks.builder.blendedPrice).toBeLessThan(picks.planner.blendedPrice)
    expect(picks.private.caveat).toBeNull()
    expect(picks.planner.caveat).toContain('zero-retention')
    expect(picks.cheapest.caveat).toBeNull()
  })

  it('adds a caveat for training models', () => {
    const picks = recommend([
      ...set().filter((model) => model.id !== 'builder'),
      makeModel('builder', { ii: 45, price: 1, training: true, zdr: false }),
    ])
    expect(picks.builder.caveat).toContain('training on requests')
    expect(picks.private.modelId).toBe('planner')
  })

  it('relaxes the private slot with a caveat when no model is zero-retention', () => {
    const picks = recommend([
      makeModel('a', { ii: 60, price: 4, training: false, zdr: false }),
      makeModel('b', { ii: 45, price: 1, training: false, zdr: null }),
    ])
    expect(picks.private.modelId).toBe('a')
    expect(picks.private.caveat).toContain('not zero-retention')
  })

  it('returns null picks with an explanation when fewer than two models are rated', () => {
    const picks = recommend([makeModel('only', { ii: 50, price: 2 })])
    for (const slot of Object.values(picks)) {
      expect(slot.modelId).toBeNull()
      expect(slot.reason).toContain('At least two')
    }
  })

  it('treats a zero Intelligence Index as rated, not missing', () => {
    const picks = recommend([
      makeModel('zero', { ii: 0, price: 0 }),
      makeModel('rated', { ii: 40, price: 2 }),
    ])
    expect(picks.planner.modelId).toBe('rated')
    expect(picks.cheapest.modelId).toBe('rated')
  })

  it('is stable across repeated runs', () => {
    expect(JSON.stringify(recommend(set()))).toBe(JSON.stringify(recommend(set())))
  })
})
