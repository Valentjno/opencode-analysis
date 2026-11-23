import { describe, expect, it } from 'vitest'
import { verifyCandidate } from '../scripts/research/verify.mjs'
import { benchmarkById } from '../scripts/research/registry.mjs'
import { makeModel } from './fixtures/dataset'

const model = makeModel('kimi-k3', { name: 'Kimi K3', canonicalId: 'moonshotai/kimi-k3' })
const benchmark = benchmarkById('gpqa-diamond')
const pageText = 'Kimi K3 results: GPQA Diamond 93.5%. Other: 1%'
const candidate = {
  value: 93.5,
  unit: '%',
  quote: 'Kimi K3 results: GPQA Diamond 93.5%.',
  sourceUrl: 'https://github.com/MoonshotAI/Kimi-K3',
  provider: 'google-ai-studio',
  profile: 'auto:smart',
}
const other = { ...candidate, provider: 'groq-cloud', value: 93.5 }

describe('candidate verification', () => {
  it('accepts an exact quote naming model, benchmark and number', () => {
    expect(verifyCandidate({ candidate, other, model, benchmark, pageText }).status).toBe('verified')
  })

  it('rejects a quote that lacks model or benchmark', () => {
    const bad = { ...candidate, quote: 'Score: 93.5%' }
    expect(verifyCandidate({ candidate: bad, other, model, benchmark, pageText }).status).toBe('quote-mismatch')
  })

  it('requires two different providers and tolerates rounding', () => {
    expect(verifyCandidate({
      candidate, other: { ...candidate, provider: 'google-ai-studio' }, model, benchmark, pageText,
    }).status).toBe('single-source')
    expect(verifyCandidate({
      candidate, other: { ...other, value: 93.52 }, model, benchmark, pageText,
    }).status).toBe('verified')
  })
})
