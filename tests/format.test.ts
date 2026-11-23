import { describe, expect, it } from 'vitest'
import {
  formatAccess,
  formatCompact,
  formatMonthly,
  formatPrice,
  formatRequests,
  formatScore,
  relativeTime,
} from '../src/lib/format'

describe('format', () => {
  it('formats prices with a free label and fixed precision', () => {
    expect(formatPrice(0)).toBe('Free')
    expect(formatPrice(0.2625)).toBe('$0.26')
    expect(formatPrice(0.004)).toBe('$0.0040')
    expect(formatPrice(4)).toBe('$4.00')
    expect(formatPrice(null)).toBe('—')
  })

  it('formats compact context windows', () => {
    expect(formatCompact(1_000_000)).toBe('1M')
    expect(formatCompact(200_000)).toBe('200K')
    expect(formatCompact(null)).toBe('—')
  })

  it('formats scores and nulls', () => {
    expect(formatScore(50.41)).toBe('50.4')
    expect(formatScore(50.41, 2)).toBe('50.41')
    expect(formatScore(null)).toBe('—')
  })

  it('formats allowances and unlimited requests', () => {
    expect(formatMonthly(30, true)).toBe('$30/mo')
    expect(formatMonthly(30, false)).toBe('—')
    expect(formatMonthly(null, true)).toBe('Not documented')
    expect(formatRequests(null, true)).toBe('∞')
    expect(formatRequests(1200, false)).toBe('1,200')
  })

  it('formats access and relative time', () => {
    expect(formatAccess({ go: true, free: true })).toBe('Go + Free')
    expect(formatAccess({ go: false, free: true })).toBe('Free')
    expect(relativeTime('2026-01-01T00:00:00Z', Date.parse('2026-01-01T02:00:00Z'))).toBe('2h ago')
  })
})
