import { describe, expect, it } from 'vitest'
// @ts-expect-error - plain JavaScript module from the refresher
import { buildChanges, mergeChanges } from '../scripts/lib/dataset.mjs'
import { makeModel } from './fixtures/dataset'

const AT = '2026-11-23T12:00:00.000Z'

describe('buildChanges', () => {
  it('emits no events for the first snapshot', () => {
    expect(buildChanges(null, [makeModel('a')], AT)).toEqual({ baseline: true, events: [] })
  })

  it('detects additions, removals and renames', () => {
    const previous = { models: [makeModel('old', { name: 'Same' }), makeModel('gone')] }
    const current = [makeModel('old', { name: 'Same' }), makeModel('new', { name: 'Same' })]
    const { events } = buildChanges(previous, current, AT)
    expect(events.filter((event) => event.type === 'added').map((event) => event.id)).toEqual(['new'])
    expect(events.filter((event) => event.type === 'removed').map((event) => event.id)).toEqual(['gone'])
  })

  it('detects price, score, allowance, privacy and access changes', () => {
    const previous = {
      models: [
        makeModel('a', {
          ii: 40,
          price: 2,
          monthlyGo: 10,
          training: false,
          zdr: true,
          go: true,
        }),
      ],
    }
    const current = [
      makeModel('a', {
        ii: 45,
        price: 1,
        monthlyGo: 20,
        training: true,
        zdr: false,
        go: false,
        free: true,
      }),
    ]
    const types = buildChanges(previous, current, AT).events.map((event) => event.type)
    expect(types).toEqual(expect.arrayContaining(['price', 'score', 'allowance', 'privacy', 'access']))
  })

  it('emits rated and unrated events instead of score events', () => {
    const previous = { models: [makeModel('a', { ii: 40 })] }
    const unrated = buildChanges(previous, [makeModel('a', { ii: null })], AT).events
    expect(unrated.map((event) => event.type)).toEqual(['unrated'])
    const rated = buildChanges({ models: [makeModel('a', { ii: null })] }, [makeModel('a', { ii: 40 })], AT).events
    expect(rated.map((event) => event.type)).toEqual(['rated'])
  })
})

describe('mergeChanges', () => {
  it('deduplicates identical transitions and caps the feed at 500', () => {
    const event = { at: AT, type: 'added', id: 'a', name: 'A', message: 'A was added.' }
    const merged = mergeChanges({
      previousChanges: { events: [event] },
      baseline: false,
      events: [event],
      at: AT,
    })
    expect(merged.events).toHaveLength(1)
    expect(merged.baseline).toBe(false)

    const many = Array.from({ length: 600 }, (_, index) => ({
      at: AT,
      type: 'added',
      id: `m${index}`,
      name: `M${index}`,
      message: `M${index} was added.`,
    }))
    const capped = mergeChanges({
      previousChanges: { events: [] },
      baseline: false,
      events: many,
      at: AT,
    })
    expect(capped.events).toHaveLength(500)
  })

  it('clears the feed on the baseline snapshot', () => {
    const result = mergeChanges({
      previousChanges: { events: [{ at: AT, type: 'added', id: 'a', name: 'A', message: 'x' }] },
      baseline: true,
      events: [],
      at: AT,
    })
    expect(result).toMatchObject({ baseline: true, events: [] })
  })
})
