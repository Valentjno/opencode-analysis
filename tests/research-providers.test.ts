import { describe, expect, it } from 'vitest'
import {
  buildRouterConfig,
  configuredProviders,
  isProviderConfigured,
  providerSummary,
} from '../scripts/research/providers.mjs'

const registry = [
  { id: 'groq-cloud', label: 'Groq', env: ['GROQ_API_KEY'], enabled: true },
  { id: 'kilo-gateway', label: 'Kilo', env: ['KILO_API_KEY'], enabled: true },
  {
    id: 'cloudflare-workers-ai',
    label: 'Cloudflare Workers AI',
    env: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
    enabled: true,
  },
  { id: 'google-ai-studio', label: 'Google AI Studio', env: ['GEMINI_API_KEY'], enabled: false },
]

describe('research provider registry', () => {
  it('uses one or many providers independently', () => {
    const env = { GROQ_API_KEY: 'x', KILO_API_KEY: 'y' }
    expect(configuredProviders(registry, env).map((provider) => provider.id)).toEqual([
      'groq-cloud',
      'kilo-gateway',
    ])
    expect(providerSummary(registry, env).enoughForVerification).toBe(true)
  })

  it('runs with a single provider but does not claim verification is possible', () => {
    const summary = providerSummary(registry, { GROQ_API_KEY: 'x' })
    expect(summary.count).toBe(1)
    expect(summary.enoughForVerification).toBe(false)
  })

  it('requires every env var for a provider with an account id', () => {
    expect(isProviderConfigured(registry[2], { CLOUDFLARE_API_TOKEN: 'x' })).toBe(false)
    expect(
      isProviderConfigured(registry[2], {
        CLOUDFLARE_API_TOKEN: 'x',
        CLOUDFLARE_ACCOUNT_ID: 'y',
      }),
    ).toBe(true)
  })

  it('never enables a disabled provider even when its key is present', () => {
    const config = buildRouterConfig(registry, { GEMINI_API_KEY: 'x', GROQ_API_KEY: 'y' })
    expect(config.providers['google-ai-studio'].enabled).toBe(false)
    expect(config.providers['groq-cloud'].enabled).toBe(true)
    expect(config.fallback_to_auto).toBe(false)
  })
})
