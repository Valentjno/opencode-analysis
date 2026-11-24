const DAY = 86_400_000
const STALE_AFTER = 30 * DAY

export function overrideEntries(overrides) {
  if (!overrides) return []
  if (Array.isArray(overrides.entries)) return overrides.entries
  if (Array.isArray(overrides.models)) {
    return overrides.models.flatMap((model) =>
      (model.benchmarks ?? []).map((entry) => ({ ...entry, modelId: model.id })),
    )
  }
  return []
}

function stripModelId(entry) {
  const rest = { ...entry }
  delete rest.modelId
  return rest
}

function ensureModel(feed, id, name = id) {
  let model = feed.models.find((item) => item.id === id)
  if (!model) {
    model = { id, name, benchmarks: [] }
    feed.models.push(model)
  }
  return model
}

function putEntry(feed, entry, { locked = false, now = new Date().toISOString() } = {}) {
  if (!entry || !entry.modelId || !entry.benchmarkId) return
  const model = ensureModel(feed, entry.modelId, entry.sourceTitle || entry.modelId)
  if (entry.sourceTitle && model.name === model.id) model.name = entry.sourceTitle
  const index = model.benchmarks.findIndex((item) => item.benchmarkId === entry.benchmarkId)
  const next = {
    ...stripModelId(entry),
    stale: entry.stale ?? false,
    supersededByAA: entry.supersededByAA ?? false,
    locked: locked || entry.locked === true,
    retrievedAt: entry.retrievedAt ?? now,
  }
  if (index === -1) model.benchmarks.push(next)
  else if (!model.benchmarks[index].locked) model.benchmarks[index] = next
}

function cloneFeed(feed) {
  return {
    schemaVersion: feed?.schemaVersion ?? 1,
    generatedAt: feed?.generatedAt ?? new Date().toISOString(),
    run: feed?.run ?? {
      status: 'ok', modelsConsidered: 0, modelsResearched: 0,
      accepted: 0, rejected: 0, reasons: {},
    },
    models: (feed?.models ?? []).map((model) => ({
      ...model,
      benchmarks: (model.benchmarks ?? []).map((entry) => ({ ...entry })),
    })),
  }
}

export function mergeResearch({ previous, overrides, candidates, now }) {
  const feed = cloneFeed(previous)

  for (const entry of overrideEntries(overrides)) {
    putEntry(feed, entry, { locked: true, now })
  }
  for (const entry of candidates ?? []) {
    putEntry(feed, { ...entry, stale: false, supersededByAA: false }, { now })
  }

  feed.models = feed.models.slice(0, 500).sort((a, b) => a.id.localeCompare(b.id))
  for (const model of feed.models) {
    model.benchmarks.sort((a, b) => a.benchmarkId.localeCompare(b.benchmarkId))
  }
  feed.generatedAt = now
  return feed
}

export function markStale(feed, now) {
  const next = cloneFeed(feed)
  const time = typeof now === 'number' ? now : Date.parse(now)
  for (const model of next.models) {
    for (const entry of model.benchmarks) {
      const retrieved = Date.parse(entry.retrievedAt)
      entry.stale = Number.isFinite(retrieved) && time - retrieved > STALE_AFTER
    }
  }
  return next
}

export function applyOverrides(feed, overrides, snapshot) {
  const next = cloneFeed(feed)
  for (const entry of overrideEntries(overrides)) {
    putEntry(next, entry, { locked: true })
  }
  if (snapshot?.models) {
    for (const model of next.models) {
      const source = snapshot.models.find((item) => item.id === model.id)
      const hasIndex = typeof source?.aa?.intelligenceIndex === 'number'
      for (const entry of model.benchmarks) {
        const aaHasBenchmark = source?.aa?.evals && entry.label in source.aa.evals
        entry.supersededByAA = hasIndex || Boolean(aaHasBenchmark)
      }
    }
  }
  return next
}
