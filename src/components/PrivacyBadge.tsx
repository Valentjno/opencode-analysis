import { clsx } from 'clsx'
import type { Privacy } from '../lib/types'
import { privacyLabel } from '../lib/privacy'

interface Props {
  privacy: Privacy | null | undefined
  compact?: boolean
}

export function PrivacyBadge({ privacy, compact = false }: Props) {
  const label = privacyLabel(privacy)
  return (
    <span
      className={clsx('badge', `badge-${label.tone}`)}
      title={privacy?.note || label.description}
    >
      <span className="dot" aria-hidden="true" />
      {compact ? label.short : label.label}
    </span>
  )
}
