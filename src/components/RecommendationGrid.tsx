import type { Model, Recommendation, RecommendationSlot } from '../lib/types'
import { formatMonthly, formatPrice, formatScore, initials } from '../lib/format'

interface Props {
  recommendations: Record<RecommendationSlot, Recommendation | null>
  models: Model[]
  onOpen: (id: string) => void
}

const ORDER: RecommendationSlot[] = ['planner', 'builder', 'medium', 'cheapest', 'private']

export function RecommendationGrid({ recommendations, models, onOpen }: Props) {
  const byId = new Map(models.map((model) => [model.id, model]))

  return (
    <div className="rec-grid">
      {ORDER.map((slot, index) => {
        const pick = recommendations[slot]
        if (!pick) return null
        const model = pick.modelId ? byId.get(pick.modelId) ?? null : null
        const disabled = !model

        return (
          <button
            key={slot}
            type="button"
            className="rec-card"
            disabled={disabled}
            onClick={() => model && onOpen(model.id)}
            title={pick.rule}
            aria-label={disabled ? `${pick.title}: no model qualified` : `Open details for ${model?.name}`}
          >
            <span className="rec-slot">
              <span>[{String(index + 1).padStart(2, '0')}] {pick.title}</span>
              {!disabled && <span className="badge badge-accent">Pick</span>}
            </span>
            {disabled ? (
              <span className="rec-model rec-empty">No pick</span>
            ) : (
              <>
                <span className="model-cell">
                  <span className="model-avatar" aria-hidden="true">
                    {initials(model!.name)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span className="rec-model">{model!.name}</span>
                    <span className="model-sub">{model!.vendor}</span>
                  </span>
                </span>
                <span className="rec-values">
                  <span className="badge badge-accent">II {formatScore(pick.intelligenceIndex)}</span>
                  <span className="badge">{formatPrice(pick.blendedPrice)}</span>
                  {pick.monthlyGo !== null && (
                    <span className="badge">{formatMonthly(pick.monthlyGo, true)}</span>
                  )}
                </span>
              </>
            )}
            <span className="rec-reason">{pick.reason}</span>
            {pick.caveat && <span className="rec-caveat">{pick.caveat}</span>}
          </button>
        )
      })}
    </div>
  )
}
