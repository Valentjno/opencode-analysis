import { coreBenchmarks, sourceForVendor } from './registry.mjs'
import { overrideEntries } from './store.mjs'

export function selectGaps({ snapshot, research, overrides, now, maxModels = 5, maxPerModel = 3 }) {
  const existing = existingPairs(research, overrides, now)
  const models = (snapshot?.models ?? []).filter((model) => {
    if (typeof model.aa?.intelligenceIndex === 'number') return false
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
        reason: 'No AA Intelligence Index and no verified external value for this benchmark.',
      })
    }
    if (modelGaps.length) usedModels += 1
    gaps.push(...modelGaps)
  }
  return gaps
}

function reportedByAA(model, benchmark) {
  const evals = model.aa?.evals ?? {}
  return [benchmark.label, ...benchmark.aliases].some((label) => label in evals)
}

function existingPairs(research, overrides, now) {
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
