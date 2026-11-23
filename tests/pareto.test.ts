import { describe, expect, it } from 'vitest'
import { allowanceFrontier, priceFrontier, unlimitedRequestModels } from '../src/lib/pareto'
import { makeModel } from './fixtures/dataset'

describe('priceFrontier', () => {
  it('keeps only non-dominated models and sorts by price', () => {
    const models = [
      makeModel('a', { ii: 60, price: 5 }),
      makeModel('b', { ii: 50, price: 1 }),
      makeModel('c', { ii: 40, price: 1 }),
      makeModel('d', { ii: 30, price: 0.5 }),
      makeModel('e', { ii: 20, price: 0.2 }),
    ]
    expect(priceFrontier(models).map((point) => point.model.id)).toEqual(['e', 'd', 'b', 'a'])
  })

  it('excludes unrated and unpriced models', () => {
    const models = [
      makeModel('rated', { ii: 40, price: 1 }),
      makeModel('unrated', { price: 0 }),
      makeModel('unpriced', { ii: 30 }),
    ]
    expect(priceFrontier(models).map((point) => point.model.id)).toEqual(['rated'])
  })

  it('keeps equal points because dominance needs a strict inequality', () => {
    const models = [
      makeModel('x', { ii: 50, price: 1 }),
      makeModel('y', { ii: 50, price: 1 }),
    ]
    expect(priceFrontier(models)).toHaveLength(2)
  })
})

describe('allowanceFrontier', () => {
  it('maximizes monthly allowance', () => {
    const models = [
      makeModel('a', { ii: 60, monthlyGo: 10 }),
      makeModel('b', { ii: 50, monthlyGo: 20 }),
      makeModel('c', { ii: 40, monthlyGo: 5 }),
      makeModel('d', { ii: 30, monthlyGo: 30 }),
    ]
    expect(allowanceFrontier(models).map((point) => point.model.id)).toEqual(['d', 'b', 'a'])
  })

  it('excludes models without a numeric allowance', () => {
    const models = [
      makeModel('a', { ii: 60, monthlyGo: 10 }),
      makeModel('free-only', { ii: 40, go: false, free: true }),
    ]
    expect(allowanceFrontier(models).map((point) => point.model.id)).toEqual(['a'])
  })
})

describe('unlimitedRequestModels', () => {
  it('reports unlimited request caps separately', () => {
    const models = [
      makeModel('unlimited', { ii: 40, unlimited: true }),
      makeModel('limited', { ii: 30, unlimited: false }),
    ]
    expect(unlimitedRequestModels(models).map((model) => model.id)).toEqual(['unlimited'])
  })
})
