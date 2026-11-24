import { useMemo, useState } from 'react'
import type { ChangeFeed, ChangeType } from '../lib/types'
import { formatDateTime, relativeTime } from '../lib/format'

interface Props {
  feed: ChangeFeed | null
  onOpen: (id: string) => void
}

const TYPES: { value: ChangeType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'added', label: 'Added' },
  { value: 'removed', label: 'Removed' },
  { value: 'price', label: 'Price' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'requests', label: 'Requests' },
  { value: 'score', label: 'Score' },
  { value: 'rated', label: 'Rated' },
  { value: 'privacy', label: 'Privacy' },
  { value: 'access', label: 'Access' },
]

export function ChangesView({ feed, onOpen }: Props) {
  const [type, setType] = useState<ChangeType | 'all'>('all')
  const events = useMemo(
    () => (feed?.events ?? []).filter((event) => type === 'all' || event.type === type),
    [feed, type],
  )

  return (
    <section className="section" aria-labelledby="changes-heading">
      <div className="section-head">
        <h2 className="section-title" id="changes-heading">
          <span className="section-index">[03]</span> What changed
        </h2>
        <p className="section-note">
          What changed between snapshots: new models, price moves, allowance changes, and score
          updates. Newest first.
        </p>
      </div>

      <div className="stack">
        <div className="segmented" role="group" aria-label="Filter changes" style={{ alignSelf: 'flex-start' }}>
          {TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={type === option.value}
              onClick={() => setType(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {events.length === 0 ? (
          <div className="empty-state">
            <p>
              {feed?.baseline
                ? 'This is the first published snapshot, so there is nothing to compare it with yet.'
                : type === 'all'
                  ? 'The last refresh found no changes. OpenCode and Artificial Analysis data were unchanged.'
                  : 'No changes of this type in the published feed.'}
            </p>
          </div>
        ) : (
          <div className="change-list">
            {events.map((event, index) => (
              <article className="change-item" key={`${event.at}-${event.id}-${event.type}-${index}`}>
                <span className={`change-type badge-${event.type === 'removed' || event.type === 'unrated' ? 'danger' : event.type === 'added' || event.type === 'rated' ? 'success' : 'accent'}`}>
                  {event.type}
                </span>
                <div>
                  <p className="change-message">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ minHeight: 0, padding: 0, textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-sans)', fontSize: 13 }}
                      onClick={() => onOpen(event.id)}
                    >
                      {event.name}
                    </button>{' '}
                    {event.message.slice(event.name.length).trim()}
                  </p>
                  <div className="change-time">
                    <time dateTime={event.at} title={formatDateTime(event.at)}>
                      {relativeTime(event.at)}
                    </time>
                    {event.field && ` · ${event.field}`}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
