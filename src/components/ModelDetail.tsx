import { useEffect, useRef, type ReactNode } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { clsx } from 'clsx'
import {
  formatAccess,
  formatCompact,
  formatDate,
  formatMonthly,
  formatPrice,
  formatPriceRange,
  formatRequests,
  formatRetention,
  formatScore,
} from '../lib/format'
import { privacyLabel } from '../lib/privacy'
import type { Model } from '../lib/types'
import { PrivacyBadge } from './PrivacyBadge'
import { ExternalBenchmarks } from './ExternalBenchmarks'
import { formatBenchmark } from '../lib/benchmarks'
import type { ResearchFeed } from '../lib/types'
import { ScoreBar } from './ScoreBar'

interface Props {
  model: Model
  research: ResearchFeed | null
  onClose: () => void
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  )
}

function Section({ index, title, children }: { index: string; title: string; children: ReactNode }) {
  return (
    <section className="detail-section">
      <h3>
        <span className="accent">[{index}]</span> {title}
      </h3>
      {children}
    </section>
  )
}

export function ModelDetail({ model, research, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
  }, [onClose])

  const privacy = privacyLabel(model.privacy)
  const score = model.aa?.intelligenceIndex

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${model.name} details`}>
        <header className="drawer-head">
          <div>
            <div className="row">
              <span className="meta">{model.id}</span>
              <span className="badge">{formatAccess(model.access)}</span>
              <PrivacyBadge privacy={model.privacy} compact />
              {model.aaStatus === 'stale' && (
                <span className="badge badge-warning">Cached score</span>
              )}
            </div>
            <h2 className="drawer-title">{model.name}</h2>
            <span className="model-sub">{model.vendor}</span>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-icon btn-ghost"
            onClick={onClose}
            aria-label="Close details (Escape)"
            title="Close (Esc)"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="drawer-body">
          <Section index="01" title="Intelligence">
            {typeof score === 'number' && model.aa ? (
              <>
                <div className="row" style={{ alignItems: 'flex-end', gap: 16, marginBottom: 14 }}>
                  <span className="num" style={{ fontSize: 42, lineHeight: 1, letterSpacing: '-0.05em' }}>
                    {formatScore(score, 2)}
                  </span>
                  <span className="meta" style={{ paddingBottom: 6 }}>Artificial Analysis Intelligence Index</span>
                </div>
                <div className="row" style={{ marginBottom: 12 }}>
                  <span className="badge badge-accent">{model.aa.variant}</span>
                  {model.aa.suffix && <span className="badge">{model.aa.suffix}</span>}
                  {model.aa.effort && <span className="badge">{model.aa.effort}</span>}
                  {model.aa.isOpenWeights && <span className="badge badge-success">Open weights</span>}
                  {model.aa.deprecated && <span className="badge badge-warning">Deprecated</span>}
                </div>
                {model.aa.deprecatedTo && (
                  <p className="prose" style={{ fontSize: 12 }}>
                    Artificial Analysis marks this as deprecated; successor: {model.aa.deprecatedTo}.
                  </p>
                )}
                {model.aaStatus === 'stale' && (
                  <p className="prose" style={{ fontSize: 12, color: 'var(--warning)' }}>
                    The latest refresh could not update this score; the previously published value is shown.
                  </p>
                )}
                <div style={{ marginTop: 16 }}>
                  {Object.entries(model.aa.evals).map(([label, value]) => (
                    <div className="detail-row" key={label}>
                      <span className="detail-label">{label}</span>
                      <span className="detail-value">{formatBenchmark(label, value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="prose muted">
                  Not published. Artificial Analysis has no Intelligence Index for this model, so it is
                  shown without a score. It is still listed because OpenCode offers it in Go or for free.
                </p>
                {model.aa && Object.keys(model.aa.evals).length > 0 && (
                  <>
                    <p className="meta" style={{ marginTop: 14 }}>
                      AA eval scores; no AA Intelligence Index published
                    </p>
                    <div style={{ marginTop: 6 }}>
                      {Object.entries(model.aa.evals).map(([label, value]) => (
                        <div className="detail-row" key={label}>
                          <span className="detail-label">{label}</span>
                          <span className="detail-value">{formatBenchmark(label, value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </Section>

          <ExternalBenchmarks feed={research} model={model} />

          {model.aa && (
            <Section index="02" title="Capabilities & speed">
              {Object.keys(model.aa.capabilities).length === 0 &&
              model.aa.omniscience === null &&
              model.aa.outputSpeed === null &&
              model.aa.timeToFirstToken === null ? (
                <p className="prose muted">Not published for this model.</p>
              ) : (
                <>
                  {Object.entries(model.aa.capabilities).map(([label, value]) => (
                    <ScoreBar key={label} label={label} value={value} digits={1} />
                  ))}
                  <div className="detail-grid" style={{ marginTop: 14 }}>
                    <Row label="Omniscience" value={formatScore(model.aa.omniscience, 2)} />
                    <Row label="Cost per task" value={formatPrice(model.aa.costPerTask)} />
                    <Row label="Output speed" value={model.aa.outputSpeed === null ? '—' : `${formatScore(model.aa.outputSpeed)} tok/s`} />
                    <Row label="Time to first token" value={model.aa.timeToFirstToken === null ? '—' : `${formatScore(model.aa.timeToFirstToken)} s`} />
                  </div>
                </>
              )}
            </Section>
          )}

          <Section index="03" title="Pricing">
            <div className="detail-grid">
              <Row label="Input / 1M" value={formatPrice(model.pricing.input)} />
              <Row label="Output / 1M" value={formatPrice(model.pricing.output)} />
              <Row label="Cached input" value={formatPrice(model.pricing.cacheRead)} />
              <Row label="Blended / 1M" value={formatPrice(model.pricing.blended)} />
              <Row label="AA listed price" value={formatPriceRange(model.aa?.aaPrice?.input, model.aa?.aaPrice?.output)} />
              <Row label="Open weights" value={model.openWeights ? 'Yes' : 'Not stated'} />
            </div>
            <p className="prose muted" style={{ fontSize: 12, marginTop: 10 }}>
              Blended price is 75% input + 25% output. Go models are also covered by the monthly
              allowance below; these are published API prices, not a live account balance.
            </p>
          </Section>

          <Section index="04" title="Limits & context">
            <div className="detail-grid">
              <Row label="AA context window" value={formatCompact(model.aa?.contextWindow ?? null)} />
              <Row label="OpenCode context" value={formatCompact(model.context)} />
              <Row label="Max output" value={formatCompact(model.maxOutput)} />
              <Row label="Knowledge" value={model.knowledge ?? '—'} />
              <Row label="Released" value={formatDate(model.aa?.releaseDate ?? model.releaseDate)} />
              <Row label="Input modalities" value={(model.modalities?.input ?? []).join(', ') || '—'} />
              <Row label="Output modalities" value={(model.modalities?.output ?? []).join(', ') || '—'} />
              <Row label="Limited regions" value={model.access.limitedRegions ? 'Yes' : 'Not stated'} />
            </div>
            {model.description && (
              <p className="prose" style={{ marginTop: 12 }}>{model.description}</p>
            )}
          </Section>

          <Section index="05" title="Go allowance">
            {model.go ? (
              <>
                <div className="detail-grid">
                  <Row label="Go monthly usage" value={formatMonthly(model.go.monthly.go, true)} />
                  <Row label="Go Plus monthly" value={formatMonthly(model.go.monthly.goPlus, true)} />
                  <Row label="Go Teams monthly" value={formatMonthly(model.go.monthly.goTeams, true)} />
                  <Row
                    label="Requests / 5h (Go)"
                    value={formatRequests(model.go.requests5h.go, model.go.requests5h.goUnlimited)}
                  />
                  <Row
                    label="Requests / 5h (Go Plus)"
                    value={formatRequests(model.go.requests5h.goPlus, model.go.requests5h.goPlusUnlimited)}
                  />
                  <Row label="Featured in Go" value={model.go.featured ? 'Yes' : 'No'} />
                </div>
                <p className="prose muted" style={{ fontSize: 12, marginTop: 10 }}>
                  Allowances are published estimates from the OpenCode Go page. They are not a live
                  balance and do not include Console-only plans.
                </p>
              </>
            ) : (
              <p className="prose muted">
                Not applicable. This model is available for free, but it is not in the Go catalog.
              </p>
            )}
          </Section>

          <Section index="06" title="Privacy">
            <div className="row" style={{ marginBottom: 10 }}>
              <PrivacyBadge privacy={model.privacy} />
              <span className="meta">{model.privacy.source}</span>
            </div>
            <p className="prose">{model.privacy.note}</p>
            <div className="detail-grid" style={{ marginTop: 10 }}>
              <Row
                label="Trains on requests"
                value={model.privacy.training === null ? 'Not documented' : model.privacy.training ? 'Yes' : 'No'}
              />
              <Row
                label="Zero retention"
                value={model.privacy.zdr === null ? 'Not documented' : model.privacy.zdr ? 'Yes' : 'No'}
              />
              <Row label="Retention" value={formatRetention(model.privacy.retentionDays)} />
              <Row label="Limited regions" value={model.privacy.limitedRegions ? 'Yes' : 'Not stated'} />
            </div>
            {privacy.tier === 'unknown' && (
              <p className="prose" style={{ fontSize: 12, color: 'var(--warning)', marginTop: 10 }}>
                Unknown is never treated as private. Check the OpenCode documentation before sending
                sensitive data.
              </p>
            )}
          </Section>

          <Section index="07" title="Sources">
            <div className="row">
              {model.aa && (
                <a className="btn" href={model.aa.url} target="_blank" rel="noreferrer noopener">
                  Artificial Analysis <ExternalLink size={13} aria-hidden="true" />
                </a>
              )}
              <a
                className="btn"
                href="https://opencode.ai/console/go"
                target="_blank"
                rel="noreferrer noopener"
              >
                OpenCode Go <ExternalLink size={13} aria-hidden="true" />
              </a>
              <a
                className="btn"
                href="https://opencode.ai/docs/providers/"
                target="_blank"
                rel="noreferrer noopener"
              >
                OpenCode docs <ExternalLink size={13} aria-hidden="true" />
              </a>
            </div>
            <p className={clsx('prose muted')} style={{ fontSize: 12, marginTop: 10 }}>
              Canonical id: <code>{model.canonicalId ?? 'not published'}</code>
            </p>
          </Section>
        </div>
      </aside>
    </>
  )
}
