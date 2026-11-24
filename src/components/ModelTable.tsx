import {
  formatAccess,
  formatCompact,
  formatMonthly,
  formatPrice,
  formatScore,
  initials,
} from '../lib/format'
import { privacyLabel } from '../lib/privacy'
import { hasExternal } from '../lib/benchmarks'
import { PrivacyBadge } from './PrivacyBadge'
import type { CatalogFilters, SortKey } from '../lib/filters'
import type { Model, ResearchFeed } from '../lib/types'

interface Props {
  models: Model[]
  research: ResearchFeed | null
  filters: CatalogFilters
  onSort: (key: SortKey) => void
  onOpen: (id: string) => void
}

const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: null, label: 'Model' },
  { key: null, label: 'Access' },
  { key: 'score', label: 'II' },
  { key: 'price', label: 'Blended /1M' },
  { key: 'context', label: 'Context' },
  { key: 'allowance', label: 'Go / month' },
  { key: null, label: 'Privacy' },
]

function ScoreCell({ model }: { model: Model }) {
  const score = model.aa?.intelligenceIndex
  if (typeof score !== 'number') return <span className="unrated">Not rated</span>
  return (
    <span className="score-cell">
      <span className="num">{formatScore(score)}</span>
      <span className="score-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (score / 60) * 100)}%` }} />
      </span>
    </span>
  )
}

export function ModelTable({ models, research, filters, onSort, onOpen }: Props) {
  if (models.length === 0) {
    return (
      <div className="empty-state">
        <p>No models match these filters. Clear the search or widen the access filter.</p>
      </div>
    )
  }

  const sortState = (key: SortKey | null) =>
    key === null || filters.sortKey !== key
      ? ('none' as const)
      : filters.sortDirection === 'asc'
        ? ('ascending' as const)
        : ('descending' as const)

  return (
    <>
      <div className="table-wrap desktop-only">
        <table className="catalog">
          <thead>
            <tr>
              {COLUMNS.map(({ key, label }) => (
                <th key={label} aria-sort={sortState(key)}>
                  {key ? (
                    <button type="button" onClick={() => onSort(key)}>
                      {label}
                      <span aria-hidden="true">{sortState(key) === 'ascending' ? '↑' : sortState(key) === 'descending' ? '↓' : '↕'}</span>
                    </button>
                  ) : (
                    label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr
                key={model.id}
                tabIndex={0}
                onClick={() => onOpen(model.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpen(model.id)
                  }
                }}
                aria-label={`Open details for ${model.name}`}
              >
                <td>
                  <span className="model-cell">
                    <span className="model-avatar" aria-hidden="true">
                      {initials(model.name)}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="model-name">{model.name}</span>
                      {hasExternal(research, model) && (
                        <span className="badge badge-accent" style={{ marginLeft: 6 }}>EXT</span>
                      )}
                      <span className="model-sub">{model.id}</span>
                    </span>
                  </span>
                </td>
                <td>
                  <span className="badge">{formatAccess(model.access)}</span>
                </td>
                <td>
                  <ScoreCell model={model} />
                </td>
                <td className="num">{formatPrice(model.pricing.blended)}</td>
                <td className="num">{formatCompact(model.aa?.contextWindow ?? model.context)}</td>
                <td className="num">{formatMonthly(model.go?.monthly.go ?? null, model.access.go)}</td>
                <td>
                  <PrivacyBadge privacy={model.privacy} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card-list mobile-only">
        {models.map((model) => (
          <button
            type="button"
            className="model-card"
            key={model.id}
            onClick={() => onOpen(model.id)}
            aria-label={`Open details for ${model.name}`}
          >
            <span className="model-card-head">
              <span className="model-cell">
                <span className="model-avatar" aria-hidden="true">
                  {initials(model.name)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="model-name">{model.name}</span>
                  {hasExternal(research, model) && (
                    <span className="badge badge-accent" style={{ marginLeft: 6 }}>EXT</span>
                  )}
                  <span className="model-sub">{model.vendor} · {formatAccess(model.access)}</span>
                </span>
              </span>
              <span className="num accent">{formatScore(model.aa?.intelligenceIndex)}</span>
            </span>
            <dl className="model-card-grid">
              <div>
                <dt>Blended /1M</dt>
                <dd>{formatPrice(model.pricing.blended)}</dd>
              </div>
              <div>
                <dt>Go / month</dt>
                <dd>{formatMonthly(model.go?.monthly.go ?? null, model.access.go)}</dd>
              </div>
              <div>
                <dt>Context</dt>
                <dd>{formatCompact(model.aa?.contextWindow ?? model.context)}</dd>
              </div>
              <div>
                <dt>Privacy</dt>
                <dd>{privacyLabel(model.privacy).short}</dd>
              </div>
            </dl>
          </button>
        ))}
      </div>
    </>
  )
}
