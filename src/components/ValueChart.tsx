import {
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Model } from '../lib/types'
import { allowanceFrontier, priceFrontier } from '../lib/pareto'
import { formatPrice, formatScore } from '../lib/format'

export type ValueMode = 'price' | 'allowance'

interface Props {
  mode: ValueMode
  models: Model[]
}

interface Point {
  id: string
  name: string
  x: number
  y: number
  frontier: boolean
}

function CustomTooltip({ active, payload, mode }: { active?: boolean; payload?: { payload: Point }[]; mode: ValueMode }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="panel" style={{ padding: '8px 10px', fontSize: 12 }}>
      <strong>{point.name}</strong>
      <div className="num muted" style={{ fontSize: 11 }}>
        II {formatScore(point.y, 2)} ·{' '}
        {mode === 'price' ? `${formatPrice(point.x)} /1M` : `${formatPrice(point.x)} /mo`}
        {point.frontier ? ' · frontier' : ''}
      </div>
    </div>
  )
}

export function ValueChart({ mode, models }: Props) {
  const frontier =
    mode === 'price'
      ? priceFrontier(models).map((point) => point.model.id)
      : allowanceFrontier(models).map((point) => point.model.id)
  const frontierSet = new Set(frontier)

  const points: Point[] = []
  for (const model of models) {
    const y = model.aa?.intelligenceIndex
    const x = mode === 'price' ? model.pricing.blended : model.go?.monthly?.go
    if (typeof y !== 'number' || typeof x !== 'number') continue
    points.push({ id: model.id, name: model.name, x, y, frontier: frontierSet.has(model.id) })
  }

  const regular = points.filter((point) => !point.frontier)
  const front = points.filter((point) => point.frontier)
  const maxY = Math.max(10, ...points.map((point) => point.y))
  const axisTick = { fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }

  return (
    <div
      className="chart-panel"
      role="img"
      aria-label={`Scatter chart of intelligence versus ${mode === 'price' ? 'blended price' : 'monthly Go allowance'}. A data table follows.`}
    >
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--text-muted)' }} /> Rated model
        </span>
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: 'var(--accent)' }} /> Non-dominated frontier
        </span>
        <span className="legend-item">Higher = better intelligence ↑</span>
      </div>
      <div style={{ width: '100%', height: 420 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 30, bottom: 20, left: 4 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={mode === 'price' ? 'Blended price per 1M tokens' : 'Monthly Go allowance (USD)'}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tickFormatter={(value: number) => `$${value}`}
              label={{
                value: mode === 'price' ? 'Blended $ / 1M tokens' : 'Go allowance $ / month',
                position: 'insideBottom',
                offset: -12,
                fill: 'var(--text-muted)',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Intelligence Index"
              domain={[0, Math.ceil(maxY / 10) * 10]}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              width={34}
            />
            <Tooltip content={<CustomTooltip mode={mode} />} cursor={{ stroke: 'var(--border-strong)' }} />
            <Scatter
              data={regular}
              fill="var(--text-muted)"
              fillOpacity={0.7}
              isAnimationActive={false}
            />
            <Scatter data={front} fill="var(--accent)" isAnimationActive={false}>
              <LabelList
                dataKey="name"
                position="top"
                fill="var(--text-secondary)"
                fontSize={9}
                fontFamily="var(--font-mono)"
                formatter={(value: unknown) => {
                  const text = String(value ?? '')
                  return text.length > 16 ? `${text.slice(0, 15)}…` : text
                }}
              />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-note">
        {mode === 'price'
          ? 'Points at $0 are free models. Zero is a real price, not missing data. Unrated models are excluded because they have no vertical value.'
          : 'Only Go models with a published monthly allowance appear. Unlimited request caps are listed below because they have no numeric allowance to plot.'}
      </p>
    </div>
  )
}
