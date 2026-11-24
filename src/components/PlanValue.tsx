import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import type { Model } from '../lib/types'
import { formatInteger, formatScore } from '../lib/format'
import { vendorColor, vendorLegend } from '../lib/vendors'
import { InfoPopover } from './InfoPopover'
import { DataTable } from './DataTable'

type Plan = 'go' | 'goPlus'

interface PlanPoint {
  id: string
  name: string
  vendor: string
  x: number
  y: number
  requests: number | null
  size: number
  frontier: boolean
  unlimited: boolean
}

const PLAN_LABEL: Record<Plan, string> = { go: 'Go', goPlus: 'Go Plus' }
const PLAN_PRICE: Record<Plan, number> = { go: 10, goPlus: 40 }

function allowanceOf(model: Model, plan: Plan): number | null {
  const value = plan === 'go' ? model.go?.monthly?.go : model.go?.monthly?.goPlus
  return typeof value === 'number' ? value : null
}

function requestsOf(model: Model, plan: Plan): number | null {
  const value = plan === 'go' ? model.go?.requests5h?.go : model.go?.requests5h?.goPlus
  return typeof value === 'number' ? value : null
}

function unlimitedOf(model: Model, plan: Plan): boolean {
  return plan === 'go'
    ? model.go?.requests5h?.goUnlimited === true
    : model.go?.requests5h?.goPlusUnlimited === true
}

function frontierIds(points: { id: string; x: number; y: number }[]): Set<string> {
  const set = new Set<string>()
  for (const point of points) {
    const dominated = points.some(
      (other) =>
        other.id !== point.id &&
        other.x >= point.x &&
        other.y >= point.y &&
        (other.x > point.x || other.y > point.y),
    )
    if (!dominated) set.add(point.id)
  }
  return set
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function FrontierDot(props: { cx?: number; cy?: number; payload?: PlanPoint }) {
  const { cx, cy, payload } = props
  if (cx === undefined || cy === undefined || !payload) return null
  return (
    <circle
      cx={cx}
      cy={cy}
      r={7}
      fill={vendorColor(payload.vendor)}
      stroke="var(--text)"
      strokeWidth={2}
    />
  )
}

export function PlanValue({ models }: { models: Model[] }) {
  const [plan, setPlan] = useState<Plan>('go')

  const points = useMemo<PlanPoint[]>(() => {
    const base = models
      .map((model) => {
        const y = model.aa?.intelligenceIndex
        const x = allowanceOf(model, plan)
        const requests = requestsOf(model, plan)
        const unlimited = unlimitedOf(model, plan)
        if (typeof y !== 'number' || x === null) return null
        return {
          id: model.id,
          name: model.name,
          vendor: model.vendor,
          x,
          y,
          requests,
          size: Math.log10((requests ?? 1) + 1),
          frontier: false,
          unlimited,
        }
      })
      .filter(Boolean) as PlanPoint[]
    const front = frontierIds(base)
    return base.map((point) => ({ ...point, frontier: front.has(point.id) }))
  }, [models, plan])

  const cards = useMemo(() => {
    const withScore = points.slice()
    const bestIntelligence = withScore.sort((a, b) => b.y - a.y)[0] ?? null
    const largestAllowance = withScore.slice().sort((a, b) => b.x - a.x)[0] ?? null
    const bestValue =
      withScore
        .filter((point) => point.x > 0)
        .sort((a, b) => b.y / b.x - a.y / a.x)[0] ?? null
    return { bestIntelligence, largestAllowance, bestValue }
  }, [points])

  const allowanceMedian = useMemo(() => median(points.map((point) => point.x)), [points])
  const requestsMedian = useMemo(
    () => median(points.map((point) => point.requests ?? 0).filter((value) => value > 0)),
    [points],
  )

  const rows = useMemo(
    () =>
      points
        .slice()
        .sort((a, b) => (b.y / Math.max(b.x, 1)) - (a.y / Math.max(a.x, 1)))
        .map((point) => {
          const shape =
            point.x >= allowanceMedian && (point.requests ?? 0) < requestsMedian
              ? 'Budget-heavy'
              : point.x < allowanceMedian && (point.requests ?? 0) >= requestsMedian
                ? 'Rate-heavy'
                : 'Balanced'
          return [
            point.name,
            point.vendor,
            formatScore(point.y, 2),
            `$${formatInteger(point.x)}/mo`,
            point.requests === null ? (point.unlimited ? '∞' : '—') : formatInteger(point.requests),
            (point.y / Math.max(point.x / 100, 1)).toFixed(2),
            shape,
          ]
        }),
    [points, allowanceMedian, requestsMedian],
  )

  const frontier = points.filter((point) => point.frontier)
  const regular = points.filter((point) => !point.frontier)
  const legend = vendorLegend(models.filter((model) => points.some((point) => point.id === model.id)))

  return (
    <div className="stack">
      <div className="rec-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {[
          { label: 'Best intelligence', point: cards.bestIntelligence, value: cards.bestIntelligence ? `II ${formatScore(cards.bestIntelligence.y, 2)}` : '—' },
          { label: 'Largest allowance', point: cards.largestAllowance, value: cards.largestAllowance ? `$${formatInteger(cards.largestAllowance.x)}/mo` : '—' },
          { label: 'Best intelligence per $100', point: cards.bestValue, value: cards.bestValue ? `${(cards.bestValue.y / Math.max(cards.bestValue.x / 100, 1)).toFixed(2)}` : '—' },
        ].map((card) => (
          <div className="panel" key={card.label} style={{ padding: 14 }}>
            <span className="meta meta-strong">{card.label}</span>
            <p style={{ margin: '6px 0 2px', fontSize: 18 }}>{card.point?.name ?? 'No model'}</p>
            <span className="num accent" style={{ fontSize: 13 }}>{card.value}</span>
          </div>
        ))}
      </div>

      <div className="panel" style={{ padding: 12 }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span className="meta meta-strong">Plan</span>
          <div className="segmented" role="group" aria-label="Go plan">
            <button type="button" aria-pressed={plan === 'go'} onClick={() => setPlan('go')}>
              Go · $10/mo
            </button>
            <button type="button" aria-pressed={plan === 'goPlus'} onClick={() => setPlan('goPlus')}>
              Go Plus · $40/mo
            </button>
          </div>
          <InfoPopover title="How to read the plan view">
            <p>
              Each bubble is a model on the <strong>{PLAN_LABEL[plan]}</strong> plan. The plan itself
              costs <strong>${PLAN_PRICE[plan]}/month</strong>; the x-axis is the separate monthly
              usage allowance published for that model inside the plan.
            </p>
            <ul>
              <li><strong>X:</strong> monthly included allowance in dollars.</li>
              <li><strong>Y:</strong> Artificial Analysis Intelligence Index.</li>
              <li><strong>Bubble size:</strong> requests per 5 hours, log scale. This is a rate limit, not a budget.</li>
              <li><strong>Color:</strong> the model vendor.</li>
              <li><strong>Ring:</strong> frontier — no other model gives both more allowance and more intelligence.</li>
            </ul>
            <p>
              A model can be generous on allowance and tight on requests (budget-heavy), or the
              reverse (rate-heavy). The table labels each one.
            </p>
          </InfoPopover>
          <span className="meta" style={{ marginLeft: 'auto' }}>
            {points.length} models with an allowance · {frontier.length} frontier
          </span>
        </div>
      </div>

      <div className="chart-panel" role="img" aria-label={`Intelligence versus monthly ${PLAN_LABEL[plan]} allowance, bubble size is requests per 5 hours.`}>
        <div style={{ width: '100%', height: 440 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 30, bottom: 24, left: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                tickFormatter={(value: number) => `$${value}`}
                label={{ value: `Included monthly allowance · ${PLAN_LABEL[plan]}`, position: 'insideBottom', offset: -14, fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0, 100]}
                tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                width={34}
                label={{ value: 'Intelligence Index', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              />
              <ZAxis type="number" dataKey="size" range={[50, 900]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const point = payload[0].payload as PlanPoint
                  return (
                    <div className="panel" style={{ padding: '8px 10px', fontSize: 12 }}>
                      <strong>{point.name}</strong>
                      <div className="num muted" style={{ fontSize: 11 }}>
                        {point.vendor} · II {formatScore(point.y, 2)} · ${formatInteger(point.x)}/mo
                        {point.requests !== null ? ` · ${formatInteger(point.requests)} req/5h` : point.unlimited ? ' · unlimited' : ''}
                        {point.frontier ? ' · frontier' : ''}
                      </div>
                    </div>
                  )
                }}
                cursor={{ stroke: 'var(--border-strong)' }}
              />
              <Scatter data={regular} isAnimationActive={false}>
                {regular.map((point) => (
                  <Cell key={point.id} fill={vendorColor(point.vendor)} fillOpacity={0.75} />
                ))}
              </Scatter>
              <Scatter data={frontier} shape={(props: { cx?: number; cy?: number; payload?: PlanPoint }) => <FrontierDot {...props} />} isAnimationActive={false}>
                {frontier.map((point) => (
                  <Cell key={point.id} fill={vendorColor(point.vendor)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {legend.map((item) => (
            <span className="legend-item" key={item.vendor}>
              <span className="legend-swatch" style={{ background: item.color }} /> {item.vendor}
            </span>
          ))}
        </div>
        <p className="chart-note">
          X is the published monthly usage allowance for this model, not the ${PLAN_PRICE[plan]} plan price.
          Bubble size is requests per 5h. A ring marks the frontier. Models without a published
          allowance or an Intelligence Index are not plotted.
        </p>
      </div>

      <details className="table-disclosure" open>
        <summary>Plan table ({rows.length} models)</summary>
        <DataTable
          columns={['Model', 'Vendor', 'II', 'Allowance', 'Req / 5h', 'II per $100', 'Shape']}
          rows={rows}
          caption={`Monthly ${PLAN_LABEL[plan]} allowance, requests per 5 hours, and intelligence per $100.`}
        />
      </details>
    </div>
  )
}
