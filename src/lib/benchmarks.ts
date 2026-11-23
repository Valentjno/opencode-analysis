import type { Model, ResearchEntry, ResearchFeed } from './types'

const FRACTION_LABELS = new Set([
  'GPQA Diamond',
  "Humanity's Last Exam",
  'SciCode',
  'Terminal-Bench 2.1',
  'IFBench',
  'Tau2',
  'MMMU-Pro',
])

const RAW_LABELS = new Set(['FrontierCode 2.0', 'GDPval', 'GDP PDF', 'Omniscience'])

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Format an AA eval or an external benchmark using its declared scale. */
export function formatBenchmark(label: string, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  if (FRACTION_LABELS.has(label)) {
    const percent = value <= 1 ? value * 100 : value
    return `${round(percent)}%`
  }
  if (RAW_LABELS.has(label)) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value)
}

/** External entries that are safe and useful to display for a model. */
export function visibleExternal(feed: ResearchFeed | null, model: Model): ResearchEntry[] {
  if (!feed) return []
  if (typeof model.aa?.intelligenceIndex === 'number') return []

  const record = feed.models.find((item) => item.id === model.id)
  if (!record) return []

  return record.benchmarks.filter((entry) => {
    if (entry.status !== 'verified') return false
    if (entry.stale || entry.supersededByAA) return false
    return !(entry.label in (model.aa?.evals ?? {}))
  })
}

export function hasExternal(feed: ResearchFeed | null, model: Model): boolean {
  return visibleExternal(feed, model).length > 0
}
