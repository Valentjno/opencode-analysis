import type { Stats } from '../lib/types'
import { formatInteger } from '../lib/format'

interface Props {
  stats: Stats
}

const CELLS: { key: keyof Stats; label: string }[] = [
  { key: 'total', label: 'Models' },
  { key: 'go', label: 'In Go' },
  { key: 'free', label: 'Free' },
  { key: 'rated', label: 'Rated by AA' },
  { key: 'private', label: 'Fully private' },
]

export function StatsBar({ stats }: Props) {
  return (
    <div className="stats" aria-label="Catalog summary">
      {CELLS.map(({ key, label }) => (
        <div className="stat" key={key}>
          <span className="stat-value">{formatInteger(stats[key])}</span>
          <span className="stat-label">{label}</span>
        </div>
      ))}
    </div>
  )
}
