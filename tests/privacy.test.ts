import { describe, expect, it } from 'vitest'
import { isFullyPrivate, privacyLabel, privacyTier } from '../src/lib/privacy'
import { makeModel } from './fixtures/dataset'

describe('privacyTier', () => {
  it('classifies the four tiers', () => {
    expect(privacyTier(makeModel('a', { training: false, zdr: true }).privacy)).toBe('private')
    expect(privacyTier(makeModel('a', { training: false, zdr: false }).privacy)).toBe('no-training')
    expect(privacyTier(makeModel('a', { training: true }).privacy)).toBe('trains')
    expect(privacyTier(makeModel('a', { training: null, zdr: null }).privacy)).toBe('unknown')
    expect(privacyTier(null)).toBe('unknown')
  })

  it('never treats unknown as private', () => {
    expect(isFullyPrivate(makeModel('a', { training: null, zdr: true }).privacy)).toBe(false)
    expect(isFullyPrivate(makeModel('a', { training: false, zdr: null }).privacy)).toBe(false)
  })

  it('exposes stable labels and tones', () => {
    expect(privacyLabel(makeModel('a', { training: true }).privacy)).toMatchObject({
      tier: 'trains',
      label: 'Trains on requests',
      tone: 'danger',
    })
    expect(privacyLabel(makeModel('a', { training: false, zdr: true }).privacy).tone).toBe('success')
  })
})
