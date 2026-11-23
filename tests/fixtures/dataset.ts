import type { Model } from '../src/lib/types'

/**
 * Minimal but contract-complete model factory. The overrides use shorthand so
 * a test can describe a scenario in one line.
 */
export function makeModel(
  id: string,
  overrides: {
    name?: string
    vendor?: string
    canonicalId?: string | null
    evals?: Record<string, number>
    ii?: number | null
    price?: number | null
    monthlyGo?: number | null
    training?: boolean | null
    zdr?: boolean | null
    go?: boolean
    free?: boolean
    context?: number | null
    unlimited?: boolean
  } = {},
): Model {
  const go = overrides.go ?? true
  return {
    id,
    name: overrides.name ?? id,
    canonicalId: overrides.canonicalId !== undefined ? overrides.canonicalId : `vendor/${id}`,
    vendor: overrides.vendor ?? 'Vendor',
    description: '',
    family: null,
    openWeights: false,
    releaseDate: null,
    lastUpdated: null,
    knowledge: null,
    access: { go, free: overrides.free ?? !go, limitedRegions: false },
    pricing: {
      input: overrides.price ?? null,
      output: overrides.price ?? null,
      cacheRead: null,
      blended: overrides.price ?? null,
    },
    context: overrides.context ?? null,
    maxOutput: null,
    modalities: null,
    capabilities: null,
    go: go
      ? {
          monthly: {
            go: overrides.monthlyGo ?? null,
            goPlus: null,
            goTeams: null,
          },
          requests5h: {
            go: null,
            goPlus: null,
            goUnlimited: overrides.unlimited ?? false,
            goPlusUnlimited: false,
          },
          featured: false,
        }
      : null,
    privacy: {
      training: overrides.training ?? null,
      zdr: overrides.zdr ?? null,
      retentionDays: overrides.zdr ? 0 : null,
      limitedRegions: false,
      source: 'Test fixture',
      note: 'Test fixture privacy note.',
    },
    aaSlug: overrides.ii === undefined || overrides.ii === null ? null : id,
    aa: {
      slug: id,
      url: `https://artificialanalysis.ai/models/${id}`,
      variant: id,
      suffix: null,
      effort: null,
      releaseDate: null,
      deprecated: false,
      deprecatedTo: null,
      intelligenceIndex: overrides.ii ?? null,
      capabilities: {},
      evals: overrides.evals ?? {},
      omniscience: null,
      contextWindow: null,
      outputSpeed: null,
      timeToFirstToken: null,
      costPerTask: null,
      aaPrice: null,
      isOpenWeights: false,
    },
    aaStatus: typeof overrides.ii === 'number' ? 'rated' : 'unrated',
  }
}

export function withOverrides(model: Model, overrides: Partial<Model>): Model {
  return { ...model, ...overrides }
}
