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
  Bar,
  BarChart,
} from 'recharts'
import type { Snapshot, ResearchFeed, Model } from '../lib/types'
import { formatScore, formatCompact } from '../lib/format'
import { FilterBar } from '../components/FilterBar'
import { DataTable } from '../components/DataTable'
import { InfoPopover } from '../components/InfoPopover'
import { VendorFilter } from '../components/VendorFilter'
import { vendorColor, vendorLegend } from '../lib/vendors'
import {
  DEFAULT_FILTERS,
  defaultDirection,
  filterModels,
  vendorOptions,
  type CatalogFilters,
} from '../lib/filters'

interface Props {
  snapshot: Snapshot
  research: ResearchFeed | null
  onOpen: (id: string) => void
}

type CostAxis = 'blended' | 'go' | 'goPlus' | 'requests' | 'aaTask'

const COST_AXES: { key: CostAxis; label: string; higherIsBetter: boolean; format: (v: number) => string }[] = [
  { key: 'blended', label: 'Blended $ / 1M tokens', higherIsBetter: false, format: (v) => `$${v}` },
  { key: 'go', label: 'Go $10/mo allowance', higherIsBetter: true, format: (v) => `$${v}` },
  { key: 'goPlus', label: 'Go Plus $40/mo allowance', higherIsBetter: true, format: (v) => `$${v}` },
  { key: 'requests', label: 'Requests / 5h', higherIsBetter: true, format: (v) => String(v) },
  { key: 'aaTask', label: 'AA $ per II task', higherIsBetter: false, format: (v) => `$${v.toFixed(3)}` },
]

function xOf(model: Model, axis: CostAxis): number | null {
  switch (axis) {
    case 'blended':
      return typeof model.pricing.blended === 'number' ? model.pricing.blended : null
    case 'go':
      return typeof model.go?.monthly?.go === 'number' ? model.go.monthly.go : null
    case 'goPlus':
      return typeof model.go?.monthly?.goPlus === 'number' ? model.go.monthly.goPlus : null
    case 'requests':
      return model.go?.requests5h.goUnlimited ? null : (typeof model.go?.requests5h.go === 'number' ? model.go.requests5h.go : null)
    case 'aaTask':
      return typeof model.aa?.costPerIntelligenceTask === 'number' ? model.aa.costPerIntelligenceTask : null
  }
}

function scoreOf(model: Model): number | null {
  return typeof model.aa?.intelligenceIndex === 'number' ? model.aa.intelligenceIndex : null
}

function frontierIds(models: Model[], axis: CostAxis): Set<string> {
  const higherX = COST_AXES.find((a) => a.key === axis)!.higherIsBetter
  const points = models
    .map((m) => ({ id: m.id, y: scoreOf(m), x: xOf(m, axis) }))
    .filter((p): p is { id: string; y: number; x: number } => p.y !== null && p.x !== null)
  const set = new Set<string>()
  for (const p of points) {
    const dominated = points.some(
      (o) =>
        o.id !== p.id &&
        o.y >= p.y &&
        (higherX ? o.x >= p.x : o.x <= p.x) &&
        (o.y > p.y || (higherX ? o.x > p.x : o.x < p.x)),
    )
    if (!dominated) set.add(p.id)
  }
  return set
}

const SECTIONS = [
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'capability', label: 'Capability Indexes' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'openness', label: 'Openness Index' },
  { id: 'cost', label: 'Cost' },
  { id: 'performance', label: 'Performance' },
  { id: 'tokens', label: 'Token Use' },
  { id: 'context', label: 'Context Window' },
  { id: 'size', label: 'Model Size' },
]

export function ValueView({ snapshot, research: _research, onOpen: _onOpen }: Props) {
  const [costAxis, setCostAxis] = useState<CostAxis>('blended')
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS)
  const [included, setIncluded] = useState<Set<string>>(() => new Set(snapshot.models.map((m) => m.id)))
  const [vendors, setVendors] = useState<Set<string>>(
    () => new Set(snapshot.models.map((m) => m.vendor)),
  )
  const vendorOptionsList = useMemo(() => vendorOptions(snapshot.models), [snapshot.models])

  const filtered = useMemo(() => {
    const base = filterModels(snapshot.models, filters)
    return base.filter((m) => included.has(m.id) && vendors.has(m.vendor))
  }, [snapshot.models, filters, included, vendors])

  const changeFilters = (patch: Partial<CatalogFilters>) => {
    setFilters((current) => {
      const next = { ...current, ...patch }
      if (patch.sortKey && patch.sortKey !== current.sortKey) {
        next.sortDirection = defaultDirection(patch.sortKey)
      }
      return next
    })
  }

  const toggleModel = (id: string) => {
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const front = useMemo(() => frontierIds(filtered, costAxis), [filtered, costAxis])
  const axis = COST_AXES.find((a) => a.key === costAxis)!

  const scatterData = useMemo(() => {
    return filtered
      .map((m) => {
        const y = scoreOf(m)
        const x = xOf(m, costAxis)
        if (y === null || x === null) return null
        return { id: m.id, name: m.name, vendor: m.vendor, x, y, frontier: front.has(m.id) }
      })
      .filter(Boolean) as { id: string; name: string; vendor: string; x: number; y: number; frontier: boolean }[]

  }, [filtered, costAxis, front])

  const yDomain = useMemo(() => {
    const values = scatterData.map((point) => point.y)
    const max = values.length ? Math.max(...values) : 10
    return [0, Math.ceil(max + 5)]
  }, [scatterData])

  const sortedByRatio = useMemo(() => {
    return filtered
      .map((m) => {
        const y = scoreOf(m)
        const x = xOf(m, costAxis)
        if (y === null || x === null || x <= 0) return null
        return { model: m, ratio: y / x }
      })
      .filter(Boolean)
      .sort((a, b) => b!.ratio - a!.ratio) as { model: Model; ratio: number }[]
  }, [filtered, costAxis])

  return (
    <div className="analysis-layout">
      <nav className="analysis-rail" aria-label="Analysis categories">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" className="analysis-rail-link" onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            {s.label}
          </button>
        ))}
      </nav>
      <section className="section" aria-labelledby="analysis-heading">
        <div className="section-head">
          <h2 className="section-title" id="analysis-heading">
            <span className="section-index">[02]</span> Analysis
          </h2>
          <p className="section-note">
            Compare models across intelligence, capability, benchmarks, openness, cost, performance,
            token use, context, and size. Filter the catalog, choose the models you want, and see
            which ones are worth it.
          </p>
        </div>

        <div className="stack" style={{ marginTop: 16 }}>
        <FilterBar
          filters={filters}
          vendors={vendorOptionsList}
          shown={filtered.length}
          total={snapshot.models.length}
          onChange={changeFilters}
        />

        <div className="panel" style={{ padding: 12 }}>
          <VendorFilter models={snapshot.models} selected={vendors} onChange={setVendors} />
        </div>

        <div className="panel" style={{ padding: 12 }}>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span className="meta meta-strong">Cost axis</span>
            <div className="segmented" role="group" aria-label="Cost axis">
              {COST_AXES.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={costAxis === a.key}
                  onClick={() => setCostAxis(a.key)}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <span className="meta" style={{ marginLeft: 'auto' }}>
              {scatterData.length} plotted · {front.size} frontier
            </span>
          </div>
        </div>

        <div className="panel" style={{ padding: 12 }}>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span className="meta meta-strong">Models</span>
            <button type="button" className="btn btn-ghost" onClick={() => setIncluded(new Set(snapshot.models.map((m) => m.id)))}>
              All
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIncluded(new Set())}>
              None
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setIncluded(new Set(filtered.filter((m) => front.has(m.id)).map((m) => m.id)))}>
              Frontier only
            </button>
            <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginLeft: 8 }}>
              {snapshot.models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`badge ${included.has(m.id) ? 'badge-accent' : ''}`}
                  onClick={() => toggleModel(m.id)}
                  title={m.name}
                >
                  {m.name.length > 18 ? `${m.name.slice(0, 17)}…` : m.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div id="intelligence" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[01]</span> Intelligence vs. cost
            <InfoPopover title="How to read intelligence vs cost">
              <p>
                Each point is a model. The vertical axis is the Artificial Analysis Intelligence
                Index; the horizontal axis is the cost option selected above.
              </p>
              <ul>
                <li><strong>Blended $ / 1M:</strong> published API price, 75% input + 25% output.</li>
                <li><strong>Go monthly $:</strong> the model's monthly usage allowance inside the $10 Go plan.</li>
                <li><strong>Requests / 5h:</strong> the rate limit. Higher is better.</li>
                <li><strong>AA $ per II task:</strong> the average cost of one Intelligence Index task.</li>
                <li><strong>Color:</strong> vendor. <strong>Ring:</strong> frontier.</li>
              </ul>
              <p>
                A frontier model is not beaten by another model on both intelligence and this cost
                axis. A blank point means the model has no Intelligence Index or no value for this
                axis.
              </p>
            </InfoPopover>
          </h3>
          <div style={{ width: '100%', height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 30, bottom: 20, left: 4 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="x"
                  tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickFormatter={(v: number) => axis.format(v)}
                  label={{ value: axis.label, position: 'insideBottom', offset: -12, fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={yDomain as [number, number]}
                  tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                  width={34}
                  label={{ value: 'Intelligence Index', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const p = payload[0].payload as { name: string; x: number; y: number; frontier: boolean }
                    return (
                      <div className="panel" style={{ padding: '8px 10px', fontSize: 12 }}>
                        <strong>{p.name}</strong>
                        <div className="num muted" style={{ fontSize: 11 }}>
                          II {formatScore(p.y, 2)} · {axis.format(p.x)} {p.frontier ? '· frontier' : ''}
                        </div>
                      </div>
                    )
                  }}
                  cursor={{ stroke: 'var(--border-strong)' }}
                />
                <Scatter data={scatterData.filter((p) => !p.frontier)} isAnimationActive={false}>
                  {scatterData.filter((p) => !p.frontier).map((point) => (
                    <Cell key={point.id} fill={vendorColor(point.vendor)} fillOpacity={0.7} />
                  ))}
                </Scatter>
                <Scatter data={scatterData.filter((p) => p.frontier)} isAnimationActive={false}>
                  {scatterData.filter((p) => p.frontier).map((point) => (
                    <Cell key={point.id} fill={vendorColor(point.vendor)} stroke="var(--text)" strokeWidth={2} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-note">
            {axis.higherIsBetter ? 'Higher cost axis is better (more allowance/requests).' : 'Lower cost axis is better.'}{' '}
            {scatterData.length === 0 && 'No models have both an Intelligence Index and a value for this axis.'}
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {vendorLegend(filtered).map((item) => (
              <span className="legend-item" key={item.vendor}>
                <span className="legend-swatch" style={{ background: item.color }} /> {item.vendor}
              </span>
            ))}
          </div>
        </div>

        <div id="capability" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[02]</span> Capability Indexes
            <InfoPopover title="How to read capability indexes">
              <p>Rows are models, columns are Artificial Analysis capability scores. Darker means higher. Blank means AA did not publish that capability.</p>
              <p>These are separate from the Intelligence Index: a model can score well on finance or legal tasks without being the smartest overall.</p>
            </InfoPopover>
          </h3>
          <CapabilityHeatmap models={filtered} />
          <p className="chart-note">AA capability scores, 0–100 scale. Blank cells mean not published.</p>
        </div>

        <div id="benchmarks" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[03]</span> Benchmarks
            <InfoPopover title="How to read benchmarks">
              <p>Rows are models, columns are published benchmark scores, shown as percent. Darker means higher. Blank means AA did not publish that score.</p>
              <p>These are the raw eval scores behind the Intelligence Index. A high II usually comes from strong scores here, but the weighting is AA's.</p>
            </InfoPopover>
          </h3>
          <BenchmarkHeatmap models={filtered} />
          <p className="chart-note">Published benchmark scores as percent. Blank cells mean not published.</p>
        </div>

        <div id="openness" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[04]</span> Openness Index
            <InfoPopover title="How to read openness">
              <p>The Artificial Analysis Openness Index, 0–100. Higher means more transparent and more available: open weights, published methodology, published training data.</p>
              <p>Only open-weights models score well here. A proprietary model with a high Intelligence Index can still score zero on openness.</p>
            </InfoPopover>
          </h3>
          <OpennessChart models={filtered} />
          <p className="chart-note">AA Openness Index, 0–100. Missing bars mean AA did not publish openness for that model.</p>
        </div>

        <div id="cost" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[05]</span> Cost
            <InfoPopover title="What cost means here">
              <p>This page uses five different cost ideas. They are not interchangeable.</p>
              <ul>
                <li><strong>Plan price:</strong> what you pay OpenCode — $10 Go or $40 Go Plus per month.</li>
                <li><strong>Included allowance:</strong> the monthly usage budget for a model inside the plan.</li>
                <li><strong>Request cap:</strong> requests per 5 hours; a rate limit, not a budget.</li>
                <li><strong>API list price:</strong> input/output/blended $ per 1M tokens outside the plan.</li>
                <li><strong>AA evaluation cost:</strong> the total cost of running the full Artificial Analysis Intelligence Index suite, and the average cost per task.</li>
              </ul>
              <p>
                The stacked bar below is the AA evaluation cost, split into uncached input, cache
                read, cache write, reasoning and answer tokens. It is not your Go subscription and
                not the API price.
              </p>
            </InfoPopover>
          </h3>
          <CostConcepts />
          <div style={{ height: 10 }} />
          <CostBreakdown models={filtered} />
        </div>

        <div id="performance" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[06]</span> Performance
            <InfoPopover title="How to read performance">
              <p>Output speed in tokens per second against the Intelligence Index. Up and to the right is better: smarter and faster.</p>
              <p>Speeds come from AA's measured providers and vary by host. A slow but smart model may be the wrong choice for interactive use.</p>
            </InfoPopover>
          </h3>
          <PerformanceChart models={filtered} />
          <p className="chart-note">Output tokens per second vs Intelligence Index. Missing points mean no published speed.</p>
        </div>

        <div id="tokens" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[07]</span> Token Use
            <InfoPopover title="How to read token use">
              <p>Reasoning and answer tokens per Intelligence Index task. The bar is the total output tokens the model produced to solve the suite.</p>
              <p>More tokens usually means more reasoning, which costs more and takes longer. A model that matches the leader on intelligence with fewer tokens is cheaper to run.</p>
            </InfoPopover>
          </h3>
          <TokenChart models={filtered} />
          <p className="chart-note">Output tokens per Intelligence Index task, split into reasoning and answer.</p>
        </div>

        <div id="context" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[08]</span> Context Window
            <InfoPopover title="How to read context">
              <p>Intelligence Index against the context window in tokens. Right means more context. Intelligence and context are independent: a smart model can have a small window.</p>
            </InfoPopover>
          </h3>
          <ContextChart models={filtered} />
          <p className="chart-note">Context window in tokens vs Intelligence Index. Missing points mean no published window.</p>
        </div>

        <div id="size" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[09]</span> Model Size (open weights only)
            <InfoPopover title="How to read model size">
              <p>Intelligence Index against active parameters in billions, for open-weights models only. Up and to the left is more efficient: more intelligence from fewer active parameters.</p>
              <p>Active parameters matter more than total parameters for inference cost. A model with 2.8T total but 104B active is cheap to run.</p>
            </InfoPopover>
          </h3>
          <SizeChart models={filtered} />
          <p className="chart-note">Active parameters in billions vs Intelligence Index, open-weights models only.</p>
        </div>

        <div className="panel" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ fontSize: 14, marginBottom: 6 }}>
            Intelligence per cost ranking
            <InfoPopover title="How to read the ranking">
              <p>
                This is the Intelligence Index divided by the selected cost. For blended API price
                it is II per $1 per 1M tokens. For Go monthly it is II per $100 of allowance. For
                requests it is II per request.
              </p>
              <p>
                Higher is better, but the ratio ignores scale: a cheap model can win the ratio while
                being unable to handle long or hard tasks. Use it as a tie-breaker, not a verdict.
              </p>
            </InfoPopover>
          </h3>
          <DataTable
            columns={[
              'Model',
              'II',
              axis.label,
              costAxis === 'go' ? 'II per $100' : costAxis === 'requests' ? 'II per request' : 'II per $1',
            ]}
            rows={sortedByRatio.slice(0, 25).map((r) => [
              r.model.name,
              formatScore(r.model.aa?.intelligenceIndex),
              axis.format(xOf(r.model, costAxis)!),
              (r.ratio * (costAxis === 'go' ? 100 : 1)).toFixed(2),
            ])}
            caption="Models sorted by intelligence per cost unit for the selected axis."
          />
        </div>
      </div>
    </section>
  </div>
  )
}

// ---------- helper charts ----------

function CapabilityHeatmap({ models }: { models: Model[] }) {
  const labels = ['Finance & Accounting', 'Strategy & Ops', 'Legal', 'Healthcare & Medical', 'Engineering', 'Economics']
  const rated = models.filter((m) => m.aa && Object.keys(m.aa.capabilities).length > 0)
  if (rated.length === 0) return <p className="prose muted">No capability data for the selected models.</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ fontSize: 11 }}>
        <thead>
          <tr>
            <th>Model</th>
            {labels.map((l) => <th key={l}>{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {rated.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              {labels.map((l) => {
                const v = m.aa?.capabilities[l]
                const bg = typeof v === 'number' ? `rgba(59,130,246,${Math.min(1, v / 60)})` : 'transparent'
                return <td key={l} style={{ background: bg, textAlign: 'center' }}>{typeof v === 'number' ? v.toFixed(1) : '—'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BenchmarkHeatmap({ models }: { models: Model[] }) {
  const benchmarks = [
    'GPQA Diamond', "Humanity's Last Exam", 'SciCode', 'Terminal-Bench 2.1', 'Terminal-Bench 4.0',
    'IFBench', 'Tau2', 'MMMU-Pro', 'FrontierCode 2.0', 'CritPt', 'GDP PDF', 'Long Context Reasoning',
  ]
  const rated = models.filter((m) => m.aa && Object.keys(m.aa.evals).length > 0)
  if (rated.length === 0) return <p className="prose muted">No benchmark data for the selected models.</p>
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ fontSize: 10 }}>
        <thead>
          <tr>
            <th>Model</th>
            {benchmarks.map((b) => <th key={b}>{b}</th>)}
          </tr>
        </thead>
        <tbody>
          {rated.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              {benchmarks.map((b) => {
                const v = m.aa?.evals[b]
                const pct = typeof v === 'number' ? (v <= 1 ? v * 100 : v) : null
                const bg = pct !== null ? `rgba(59,130,246,${Math.min(1, pct / 100)})` : 'transparent'
                return <td key={b} style={{ background: bg, textAlign: 'center' }}>{pct !== null ? pct.toFixed(1) : '—'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OpennessChart({ models }: { models: Model[] }) {
  const rows = models.filter((m) => typeof m.aa?.opennessIndex === 'number')
  if (rows.length === 0) return <p className="prose muted">No openness data for the selected models.</p>
  return (
    <div style={{ width: '100%', height: Math.max(220, rows.length * 22 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows.map((m) => ({ name: m.name, value: m.aa!.opennessIndex! }))} layout="vertical" margin={{ left: 120, right: 20, top: 8, bottom: 8 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
          <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} width={110} />
          <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="panel" style={{ padding: '6px 8px', fontSize: 11 }}><strong>{payload[0].payload.name}</strong><div className="num muted">{formatScore(payload[0].value as number, 2)}</div></div> : null} />
          <Bar dataKey="value" fill="var(--accent)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CostConcepts() {
  const rows = [
    ['Plan price', '$10 Go / $40 Go Plus per month', 'What you pay OpenCode.'],
    ['Included allowance', 'Monthly usage budget per model', 'Not extra money; a budget inside the plan.'],
    ['Request cap', 'Requests per 5 hours', 'A rate limit, not a budget.'],
    ['API list price', 'Input/output/blended $ per 1M tokens', 'What the API costs outside the plan.'],
    ['AA evaluation cost', 'Total $ for the full AA Intelligence Index suite', 'The cost of running the benchmark, not your bill.'],
  ]
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ fontSize: 11 }}>
        <thead>
          <tr><th>Cost</th><th>Unit</th><th>What it means</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CostBreakdown({ models }: { models: Model[] }) {
  const rows = models.filter(
    (m) => m.aa?.intelligenceIndexCost && typeof m.aa.costPerIntelligenceTask === 'number',
  )
  if (rows.length === 0) {
    return <p className="prose muted">No total-cost data for the selected models.</p>
  }
  const data = rows.map((m) => {
    const parts = (m.aa?.intelligenceIndexCost ?? {}) as {
      nonCacheInput?: number
      cacheRead?: number
      cacheWrite?: number
      reasoning?: number
      answer?: number
    }
    return {
      name: m.name,
      nonCacheInput: parts.nonCacheInput ?? 0,
      cacheRead: parts.cacheRead ?? 0,
      cacheWrite: parts.cacheWrite ?? 0,
      reasoning: parts.reasoning ?? 0,
      answer: parts.answer ?? 0,
    }
  })
  return (
    <div style={{ width: '100%', height: Math.max(240, rows.length * 26 + 80) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 120, right: 20, top: 8, bottom: 8 }}>
          <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
          <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} width={110} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const total = payload.reduce((sum, item) => sum + (typeof item.value === 'number' ? item.value : 0), 0)
              return (
                <div className="panel" style={{ padding: '8px 10px', fontSize: 11 }}>
                  <strong>{payload[0].payload.name}</strong>
                  <div className="num muted">${total.toFixed(2)} total evaluation cost</div>
                </div>
              )
            }}
          />
          <Bar dataKey="nonCacheInput" stackId="cost" fill="#64748B" name="Uncached input" />
          <Bar dataKey="cacheRead" stackId="cost" fill="#06B6D4" name="Cache read" />
          <Bar dataKey="cacheWrite" stackId="cost" fill="#8B5CF6" name="Cache write" />
          <Bar dataKey="reasoning" stackId="cost" fill="#F59E0B" name="Reasoning" />
          <Bar dataKey="answer" stackId="cost" fill="#22C55E" name="Answer" />
        </BarChart>
      </ResponsiveContainer>
      <p className="chart-note">
        Total cost of running the full Artificial Analysis Intelligence Index suite, split by token
        type. This is not the Go subscription and not the API price. A missing bar means AA did not
        publish the cost breakdown for that model.
      </p>
    </div>
  )
}

function PerformanceChart({ models }: { models: Model[] }) {
  const data = models
    .map((m) => {
      const y = scoreOf(m)
      const x = m.aa?.outputSpeed ?? null
      if (y === null || x === null) return null
      return { id: m.id, name: m.name, x, y }
    })
    .filter(Boolean) as { id: string; name: string; x: number; y: number }[]
  if (data.length === 0) return <p className="prose muted">No performance data for the selected models.</p>
  const yMax = Math.ceil(Math.max(...data.map((d) => d.y)) + 5)
  return (
    <div style={{ width: '100%', height: 360 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 30, bottom: 20, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} label={{ value: 'Output speed (tok/s)', position: 'insideBottom', offset: -12, fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
          <YAxis type="number" dataKey="y" domain={[0, yMax]} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} width={34} />
          <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="panel" style={{ padding: '6px 8px', fontSize: 11 }}><strong>{(payload[0].payload as { name: string }).name}</strong></div> : null} />
          <Scatter data={data} fill="var(--accent)" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

function TokenChart({ models }: { models: Model[] }) {
  const rows = models.filter((m) => m.aa?.intelligenceIndexOutputTokensPerTask)
  if (rows.length === 0) return <p className="prose muted">No token-use data for the selected models.</p>
  const data = rows.map((m) => ({
    name: m.name,
    reasoning: m.aa!.intelligenceIndexOutputTokensPerTask!.reasoning,
    answer: m.aa!.intelligenceIndexOutputTokensPerTask!.answer,
  }))
  return (
    <div style={{ width: '100%', height: Math.max(220, rows.length * 24 + 60) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 120, right: 20, top: 8, bottom: 8 }}>
          <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
          <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} width={110} />
          <Tooltip />
          <Bar dataKey="reasoning" stackId="a" fill="var(--text-muted)" name="Reasoning tokens" />
          <Bar dataKey="answer" stackId="a" fill="var(--accent)" name="Answer tokens" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ContextChart({ models }: { models: Model[] }) {
  const data = models
    .map((m) => {
      const y = scoreOf(m)
      const x = m.aa?.contextWindow ?? m.context ?? null
      if (y === null || x === null) return null
      return { id: m.id, name: m.name, x, y }
    })
    .filter(Boolean) as { id: string; name: string; x: number; y: number }[]
  if (data.length === 0) return <p className="prose muted">No context data for the selected models.</p>
  const yMax = Math.ceil(Math.max(...data.map((d) => d.y)) + 5)
  return (
    <div style={{ width: '100%', height: 360 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 30, bottom: 20, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tickFormatter={(v: number) => formatCompact(v)} label={{ value: 'Context window (tokens)', position: 'insideBottom', offset: -12, fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
          <YAxis type="number" dataKey="y" domain={[0, yMax]} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} width={34} />
          <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="panel" style={{ padding: '6px 8px', fontSize: 11 }}><strong>{(payload[0].payload as { name: string }).name}</strong></div> : null} />
          <Scatter data={data} fill="var(--accent)" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

function SizeChart({ models }: { models: Model[] }) {
  const data = models
    .filter((m) => m.openWeights)
    .map((m) => {
      const y = scoreOf(m)
      const x = m.aa?.activeParameters ?? null
      if (y === null || x === null) return null
      return { id: m.id, name: m.name, x, y, params: m.aa?.parameters }
    })
    .filter(Boolean) as { id: string; name: string; x: number; y: number; params: number | null }[]
  if (data.length === 0) return <p className="prose muted">No open-weights model size data for the selected models.</p>
  const yMax = Math.ceil(Math.max(...data.map((d) => d.y)) + 5)
  return (
    <div style={{ width: '100%', height: 360 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 30, bottom: 20, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} label={{ value: 'Active parameters (B)', position: 'insideBottom', offset: -12, fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
          <YAxis type="number" dataKey="y" domain={[0, yMax]} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} width={34} />
          <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="panel" style={{ padding: '6px 8px', fontSize: 11 }}><strong>{(payload[0].payload as { name: string }).name}</strong><div className="num muted">{formatScore((payload[0].payload as { params: number | null }).params, 0)}B total</div></div> : null} />
          <Scatter data={data} fill="var(--accent)" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}