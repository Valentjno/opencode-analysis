import { ExternalLink } from 'lucide-react'
import { formatBenchmark, visibleExternal } from '../lib/benchmarks'
import { formatDate } from '../lib/format'
import type { Model, ResearchFeed } from '../lib/types'

interface Props {
  feed: ResearchFeed | null
  model: Model
}

export function ExternalBenchmarks({ feed, model }: Props) {
  if (!feed || !model) return null
  const entries = visibleExternal(feed, model)
  if (entries.length === 0) return null

  return (
    <section className="detail-section">
      <h3>
        <span className="accent">[EXT]</span> External benchmarks — not Artificial Analysis
      </h3>
      {entries.map((entry) => (
        <div key={entry.benchmarkId} style={{ marginBottom: 12 }}>
          <div className="detail-row">
            <span className="detail-label">{entry.label}</span>
            <span className="detail-value">
              <strong>{formatBenchmark(entry.label, entry.value)}</strong>{' '}
              <a href={entry.sourceUrl} target="_blank" rel="noreferrer noopener" className="accent">
                source <ExternalLink size={11} aria-hidden="true" />
              </a>
            </span>
          </div>
          <div className="meta" style={{ marginTop: 3 }}>
            Retrieved {formatDate(entry.retrievedAt)} · {entry.locked ? 'manual review' : 'verified from two independent providers'}
          </div>
          <details style={{ marginTop: 6 }}>
            <summary className="meta" style={{ cursor: 'pointer' }}>Quote and models</summary>
            <p className="prose" style={{ fontSize: 12, marginTop: 6 }}>“{entry.quote}”</p>
            <div className="meta">{entry.modelsUsed.join(' · ')}</div>
          </details>
        </div>
      ))}
      <p className="prose muted" style={{ fontSize: 12, marginTop: 6 }}>
        Verified from official vendor pages by two independent providers. These are not Artificial
        Analysis scores and never affect the Intelligence Index, picks, or frontier.
      </p>
    </section>
  )
}
