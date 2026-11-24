import { coreBenchmarks, sourceForVendor } from './registry.mjs'
import { overrideEntries } from './store.mjs'
import { officialUrlAllowed, search } from './search.mjs'
import { fetchPage } from './fetch-page.mjs'
import { mentionsBenchmark } from './context.mjs'

export async function selectGaps({ snapshot, research, overrides, _now, maxModels = 5, maxPerModel = 3, fetchImpl = null }) {
  const existing = existingPairs(research, overrides)
  const models = (snapshot?.models ?? []).filter((model) => {
    if (!sourceForVendor(model.canonicalId)) return false
    return true
  })

  models.sort((a, b) => {
    const countA = existing.models.get(a.id)?.size ?? 0
    const countB = existing.models.get(b.id)?.size ?? 0
    return countA - countB || a.id.localeCompare(b.id)
  })

  const gaps = []
  let usedModels = 0

  for (const model of models) {
    if (usedModels >= maxModels) break
    const modelGaps = []
    for (const benchmark of coreBenchmarks()) {
      if (modelGaps.length >= maxPerModel) break
      if (reportedByAA(model, benchmark)) continue
      if (existing.models.get(model.id)?.has(benchmark.id)) continue
      modelGaps.push({
        model,
        benchmark,
        reason: 'No AA value for this benchmark and no verified external value.',
      })
    }
    if (!modelGaps.length) continue

    // Preflight: only spend LLM budget on models that have a reachable official
    // page mentioning at least one of their missing benchmarks. Without this,
    // fictional or pageless models consume every slot and the useful ones are
    // never reached.
    if (fetchImpl) {
      let reachable = false
      for (const gap of modelGaps) {
        const results = await search({ model: gap.model, benchmark: gap.benchmark, fetchImpl })
        for (const result of results.slice(0, 6)) {
          const page = await fetchPage(result.url, {
            fetchImpl,
            allowedUrl: (next) => officialUrlAllowed(next, gap.model.canonicalId),
          })
          if (page && mentionsBenchmark(page.text, gap.benchmark)) {
            reachable = true
            break
          }
        }
        if (reachable) break
      }
      if (!reachable) continue
    }

    usedModels += 1
    gaps.push(...modelGaps)
  }
  return gaps
}

function reportedByAA(model, benchmark) {
  const evals = model.aa?.evals ?? {}
  return [benchmark.label, ...benchmark.aliases].some((label) => label in evals)
}

function existingPairs(research, overrides) {
  const models = new Map()
  const add = (entry, modelId) => {
    if (entry.status !== 'verified' || entry.stale || entry.supersededByAA) return
    if (!models.has(modelId)) models.set(modelId, new Set())
    models.get(modelId).add(entry.benchmarkId)
  }
  for (const model of research?.models ?? []) {
    for (const entry of model.benchmarks ?? []) add(entry, model.id)
  }
  for (const entry of overrideEntries(overrides)) add(entry, entry.modelId)
  return { models }
}