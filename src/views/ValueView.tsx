import { useMemo, useState } from 'react'
import type { Snapshot, ResearchFeed } from '../lib/types'
import { priceFrontier, allowanceFrontier, unlimitedRequestModels } from '../lib/pareto'
import { formatMonthly, formatPrice, formatScore } from '../lib/format'
import { ValueChart, type ValueMode } from '../components/ValueChart'
import { DataTable } from '../components/DataTable'

interface Props {
  snapshot: Snapshot
  research?: ResearchFeed | null
  onOpen: (id: string) => void
}

export function ValueView({ snapshot, research: _research, onOpen }: Props) {
  const [mode, setMode] = useState<ValueMode>('price')
  const models = snapshot.models

  const frontier = useMemo(
    () =>
      mode === 'price'
        ? new Set(priceFrontier(models).map((point) => point.model.id))
        : new Set(allowanceFrontier(models).map((point) => point.model.id)),
    [mode, models],
  )

  const table = useMemo(() => {
    const rows = models
      .filter((model) => {
        const y = model.aa?.intelligenceIndex
        const x = mode === 'price' ? model.pricing.blended : model.go?.monthly?.go
        return typeof y === 'number' && typeof x === 'number'
      })
      .sort((a, b) => {
        const aX = mode === 'price' ? a.pricing.blended! : a.go!.monthly.go!
        const bX = mode === 'price' ? b.pricing.blended! : b.go!.monthly.go!
        return aX - bX || (b.aa?.intelligenceIndex ?? 0) - (a.aa?.intelligenceIndex ?? 0)
      })

    return {
      columns: ['Model', 'II', mode === 'price' ? 'Blended /1M' : 'Go / month', 'Frontier'],
      rows: rows.map((model) => [
        model.name,
        formatScore(model.aa?.intelligenceIndex),
        mode === 'price'
          ? formatPrice(model.pricing.blended)
          : formatMonthly(model.go?.monthly.go ?? null, true),
        frontier.has(model.id) ? 'Yes' : 'No',
      ]),
      models: rows,
    }
  }, [mode, models, frontier])

  const unlimited = unlimitedRequestModels(models)

  return (
    <section className="section" aria-labelledby="value-heading">
      <div className="section-head">
        <h2 className="section-title" id="value-heading">
          <span className="section-index">[02]</span> Intelligence vs. what you can afford
        </h2>
        <p className="section-note">
          A non-dominated model is one that no rated model beats on intelligence without also
          costing more (or offering a smaller Go allowance). There is no single winner — the shape of
          the frontier is the answer.
        </p>
      </div>

      <div className="stack">
        <div className="segmented" role="group" aria-label="Value axis">
          <button
            type="button"
            aria-pressed={mode === 'price'}
            onClick={() => setMode('price')}
          >
            Price per 1M tokens
          </button>
          <button
            type="button"
            aria-pressed={mode === 'allowance'}
            onClick={() => setMode('allowance')}
          >
            Monthly Go allowance
          </button>
        </div>

        <ValueChart mode={mode} models={models} />

        {unlimited.length > 0 && (
          <div className="panel" style={{ padding: 14 }}>
            <span className="meta">Unlimited request caps in Go ({unlimited.length})</span>
            <p className="prose muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 10 }}>
              These models have no numeric request ceiling in the published Go table, so they are not
              plotted on the allowance axis.
            </p>
            <div className="row">
              {unlimited.map((model) => (
                <button
                  type="button"
                  key={model.id}
                  className="badge"
                  onClick={() => onOpen(model.id)}
                  title={`Open details for ${model.name}`}
                >
                  {model.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <details className="table-disclosure">
          <summary>View the same data as a table ({table.rows.length} rows)</summary>
          <DataTable
            columns={table.columns}
            rows={table.rows}
            caption={`${mode === 'price' ? 'Price' : 'Allowance'} versus Intelligence Index for all rated models`}
          />
        </details>
      </div>
    </section>
  )
}
