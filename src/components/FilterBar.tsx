import { Search } from 'lucide-react'
import type {
  AccessFilter,
  CatalogFilters,
  PrivacyFilter,
  RatingFilter,
  SortKey,
} from '../lib/filters'

interface Props {
  filters: CatalogFilters
  vendors: string[]
  shown: number
  total: number
  onChange: (patch: Partial<CatalogFilters>) => void
}

const ACCESS: { value: AccessFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'go', label: 'Go' },
  { value: 'free', label: 'Free' },
  { value: 'both', label: 'Both' },
]

const RATINGS: { value: RatingFilter; label: string }[] = [
  { value: 'all', label: 'Any rating' },
  { value: 'rated', label: 'Rated' },
  { value: 'unrated', label: 'Not rated' },
]

const PRIVACY: { value: PrivacyFilter; label: string }[] = [
  { value: 'all', label: 'Any privacy' },
  { value: 'private', label: 'Private' },
  { value: 'no-training', label: 'No training' },
  { value: 'trains', label: 'Trains' },
  { value: 'unknown', label: 'Unknown' },
]

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'score', label: 'Intelligence' },
  { value: 'price', label: 'Price' },
  { value: 'allowance', label: 'Go allowance' },
  { value: 'context', label: 'Context' },
  { value: 'name', label: 'Name' },
  { value: 'vendor', label: 'Vendor' },
]

export function FilterBar({ filters, vendors, shown, total, onChange }: Props) {
  return (
    <div className="filters" role="search" aria-label="Filter models">
      <div className="filters-row">
        <label className="field search-field">
          <Search size={14} aria-hidden="true" className="muted" />
          <span className="sr-only">Search models</span>
          <input
            type="search"
            value={filters.query}
            placeholder="Search model, vendor or family…"
            onChange={(event) => onChange({ query: event.target.value })}
          />
        </label>

        <div className="segmented" role="group" aria-label="Access">
          {ACCESS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filters.access === option.value}
              onClick={() => onChange({ access: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="field">
          <span className="field-label">Rating</span>
          <select
            aria-label="Rating"
            value={filters.rating}
            onChange={(event) => onChange({ rating: event.target.value as RatingFilter })}
          >
            {RATINGS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Privacy</span>
          <select
            aria-label="Privacy"
            value={filters.privacy}
            onChange={(event) => onChange({ privacy: event.target.value as PrivacyFilter })}
          >
            {PRIVACY.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Vendor</span>
          <select
            aria-label="Vendor"
            value={filters.vendor}
            onChange={(event) => onChange({ vendor: event.target.value })}
          >
            <option value="all">All vendors</option>
            {vendors.map((vendor) => (
              <option key={vendor} value={vendor}>
                {vendor}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="filters-row">
        <label className="field">
          <span className="field-label">Sort</span>
          <select
            aria-label="Sort by"
            value={filters.sortKey}
            onChange={(event) => onChange({ sortKey: event.target.value as SortKey })}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented" role="group" aria-label="Sort direction">
          <button
            type="button"
            aria-pressed={filters.sortDirection === 'asc'}
            onClick={() => onChange({ sortDirection: 'asc' })}
          >
            Asc
          </button>
          <button
            type="button"
            aria-pressed={filters.sortDirection === 'desc'}
            onClick={() => onChange({ sortDirection: 'desc' })}
          >
            Desc
          </button>
        </div>
        <span className="filters-meta right">
          {shown} / {total} models
        </span>
      </div>
    </div>
  )
}
