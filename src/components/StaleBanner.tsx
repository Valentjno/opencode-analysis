import { AlertTriangle } from 'lucide-react'
import { ageLabel } from '../lib/data'
import { formatDateTime } from '../lib/format'

interface Props {
  generatedAt: string
}

export function StaleBanner({ generatedAt }: Props) {
  return (
    <div className="stale-banner" role="status">
      <AlertTriangle size={15} aria-hidden="true" />
      <span>
        This snapshot is {ageLabel(generatedAt)} (generated {formatDateTime(generatedAt)}). The
        refresh job may be late; the values below are the last published data.
      </span>
    </div>
  )
}
