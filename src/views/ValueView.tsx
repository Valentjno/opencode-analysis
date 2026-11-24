import { useMemo, useState } from 'react'
import {
  CartesianGrid,
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

type CostAxis = 'blended' | 'go' | 'requests' | 'aaTask'

const COST_AXES: { key: CostAxis; label: string; higherIsBetter: boolean; format: (v: number) => string }[] = [
  { key: 'blended', label: 'Blended $ / 1M tokens', higherIsBetter: false, format: (v) => `$${v}` },
  { key: 'go', label: 'Go monthly $', higherIsBetter: true, format: (v) => `$${v}` },
  { key: 'requests', label: 'Requests / 5h', higherIsBetter: true, format: (v) => String(v) },
  { key: 'aaTask', label: 'AA $ per II task', higherIsBetter: false, format: (v) => `$${v.toFixed(3)}` },
]

function xOf(model: Model, axis: CostAxis): number | null {
  switch (axis) {
    case 'blended':
      return typeof model.pricing.blended === 'number' ? model.pricing.blended : null
    case 'go':
      return typeof model.go?.monthly?.go === 'number' ? model.go.monthly.go : null
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
  const vendors = useMemo(() => vendorOptions(snapshot.models), [snapshot.models])

  const filtered = useMemo(() => {
    const base = filterModels(snapshot.models, filters)
    return base.filter((m) => included.has(m.id))
  }, [snapshot.models, filters, included])

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
        return { id: m.id, name: m.name, x, y, frontier: front.has(m.id) }
      })
      .filter(Boolean) as { id: string; name: string; x: number; y: number; frontier: boolean }[]
  }, [filtered, costAxis, front])

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
            Non-dominated models on intelligence versus cost. Higher intelligence and lower cost (or
            higher allowance) is better. Unrated models cannot be placed on the intelligence axis.
          </p>
        </div>

        <div className="stack" style={{ marginTop: 16 }}>
        <FilterBar
          filters={filters}
          vendors={vendors}
          shown={filtered.length}
          total={snapshot.models.length}
          onChange={changeFilters}
        />

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
                  domain={[0, 100]}
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
                <Scatter data={scatterData.filter((p) => !p.frontier)} fill="var(--text-muted)" fillOpacity={0.6} isAnimationActive={false} />
                <Scatter data={scatterData.filter((p) => p.frontier)} fill="var(--accent)" isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-note">
            {axis.higherIsBetter ? 'Higher cost axis is better (more allowance/requests).' : 'Lower cost axis is better.'}{' '}
            {scatterData.length === 0 && 'No models have both an Intelligence Index and a value for this axis.'}
          </p>
        </div>

        <div id="capability" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[02]</span> Capability Indexes
          </h3>
          <CapabilityHeatmap models={filtered} />
        </div>

        <div id="benchmarks" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[03]</span> Benchmarks
          </h3>
          <BenchmarkHeatmap models={filtered} />
        </div>

        <div id="openness" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[04]</span> Openness Index
          </h3>
          <OpennessChart models={filtered} />
        </div>

        <div id="cost" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[05]</span> Cost
          </h3>
          <CostBreakdown models={filtered} />
        </div>

        <div id="performance" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[06]</span> Performance
          </h3>
          <PerformanceChart models={filtered} />
        </div>

        <div id="tokens" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[07]</span> Token Use
          </h3>
          <TokenChart models={filtered} />
        </div>

        <div id="context" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[08]</span> Context Window
          </h3>
          <ContextChart models={filtered} />
        </div>

        <div id="size" className="panel" style={{ padding: 16 }}>
          <h3 className="section-title" style={{ fontSize: 16, marginBottom: 8 }}>
            <span className="section-index">[09]</span> Model Size (open weights only)
          </h3>
          <SizeChart models={filtered} />
        </div>

        <div className="panel" style={{ padding: 12 }}>
          <h3 className="section-title" style={{ fontSize: 14, marginBottom: 6 }}>Intelligence per dollar ranking</h3>
          <DataTable
            columns={['Model', 'II', axis.label, 'II / unit']}
            rows={sortedByRatio.slice(0, 25).map((r) => [
              r.model.name,
              formatScore(r.model.aa?.intelligenceIndex),
              axis.format(xOf(r.model, costAxis)!),
              r.ratio.toFixed(2),
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

function CostBreakdown({ models }: { models: Model[] }) {
  const rows = models.filter((m) => typeof m.pricing.blended === 'number' || typeof m.aa?.costPerTask === 'number')
  if (rows.length === 0) return <p className="prose muted">No cost data for the selected models.</p>
  const data = rows.map((m) => ({
    name: m.name,
    blended: m.pricing.blended ?? 0,
    costPerTask: m.aa?.costPerTask ?? 0,
    costPerII: m.aa?.costPerIntelligenceTask ?? 0,
  }))
  return (
    <div style={{ width: '100%', height: Math.max(220, rows.length * 24 + 60) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 120, right: 20, top: 8, bottom: 8 }}>
          <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
          <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} width={110} />
          <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="panel" style={{ padding: '6px 8px', fontSize: 11 }}><strong>{payload[0].payload.name}</strong></div> : null} />
          <Bar dataKey="blended" fill="var(--text-muted)" name="Blended $/1M" />
          <Bar dataKey="costPerTask" fill="var(--accent)" name="Cost per II task" />
        </BarChart>
      </ResponsiveContainer>
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
  return (
    <div style={{ width: '100%', height: 360 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 30, bottom: 20, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} label={{ value: 'Output speed (tok/s)', position: 'insideBottom', offset: -12, fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
          <YAxis type="number" dataKey="y" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} width={34} />
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
  return (
    <div style={{ width: '100%', height: 360 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 30, bottom: 20, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tickFormatter={(v: number) => formatCompact(v)} label={{ value: 'Context window (tokens)', position: 'insideBottom', offset: -12, fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
          <YAxis type="number" dataKey="y" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} width={34} />
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
  return (
    <div style={{ width: '100%', height: 360 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 30, bottom: 20, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} label={{ value: 'Active parameters (B)', position: 'insideBottom', offset: -12, fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
          <YAxis type="number" dataKey="y" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} width={34} />
          <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="panel" style={{ padding: '6px 8px', fontSize: 11 }}><strong>{(payload[0].payload as { name: string }).name}</strong><div className="num muted">{formatScore((payload[0].payload as { params: number | null }).params, 0)}B total</div></div> : null} />
          <Scatter data={data} fill="var(--accent)" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}