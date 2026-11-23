import { formatPercent, formatScore } from '../lib/format'

interface Props {
  label: string
  value: number | null
  max?: number
  digits?: number
  suffix?: string
}

export function ScoreBar({ label, value, max = 100, digits = 2, suffix = '' }: Props) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return (
      <div className="score-row">
        <span className="score-row-label" title={label}>{label}</span>
        <span className="score-track" aria-hidden="true" />
        <span className="score-row-value muted">—</span>
      </div>
    )
  }

  const width = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="score-row">
      <span className="score-row-label" title={label}>{label}</span>
      <span
        className="score-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <span style={{ width: `${width}%` }} />
      </span>
      <span className="score-row-value">
        {suffix ? formatPercent(value, digits) : formatScore(value, digits)}{suffix}
      </span>
    </div>
  )
}
