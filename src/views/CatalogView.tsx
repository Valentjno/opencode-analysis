import { useMemo, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import type { ResearchFeed, Snapshot } from '../lib/types'
import {
  DEFAULT_FILTERS,
  defaultDirection,
  filterModels,
  sortModels,
  vendorOptions,
  type CatalogFilters,
  type SortKey,
} from '../lib/filters'
import { formatDateTime } from '../lib/format'
import { FilterBar } from '../components/FilterBar'
import { ModelTable } from '../components/ModelTable'
import { RecommendationGrid } from '../components/RecommendationGrid'
import { StatsBar } from '../components/StatsBar'

interface Props {
  snapshot: Snapshot
  research: ResearchFeed | null
  onOpen: (id: string) => void
}

export function CatalogView({ snapshot, research, onOpen }: Props) {
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS)
  const models = snapshot.models

  const shown = useMemo(
    () => sortModels(filterModels(models, filters), filters),
    [models, filters],
  )
  const vendors = useMemo(() => vendorOptions(models), [models])

  const changeFilters = (patch: Partial<CatalogFilters>) => {
    setFilters((current) => {
      const next = { ...current, ...patch }
      if (patch.sortKey && patch.sortKey !== current.sortKey) {
        next.sortDirection = defaultDirection(patch.sortKey)
      }
      return next
    })
  }

  const onSort = (key: SortKey) => {
    setFilters((current) => ({
      ...current,
      sortKey: key,
      sortDirection:
        current.sortKey === key
          ? current.sortDirection === 'asc'
            ? 'desc'
            : 'asc'
          : defaultDirection(key),
    }))
  }

  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-eyebrow meta meta-strong">
          Independent · {formatDateTime(snapshot.generatedAt)} · updates every 12h
        </div>
        <h1 id="hero-heading">
          Every Go and free model, <em>compared.</em>
        </h1>
        <div className="hero-copy">
          <p>
            Artificial Analysis scores, published Go allowances, API prices, context windows, and
            privacy terms in one catalog. Find the model that fits your budget and your data.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => document.getElementById('catalog-table')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Browse models <ArrowDown size={13} aria-hidden="true" />
            </button>
            <a className="btn" href="#about">How it works</a>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="picks-heading">
        <div className="section-head">
          <h2 className="section-title" id="picks-heading">
            <span className="section-index">[00]</span> Today's picks
          </h2>
          <p className="section-note">
            Five deterministic picks from the current snapshot. Open a card to see the numbers and
            the rule behind it.
          </p>
        </div>
        <RecommendationGrid
          recommendations={snapshot.recommendations}
          models={models}
          onOpen={onOpen}
        />
      </section>

      <section className="section" aria-labelledby="catalog-heading">
        <div className="section-head">
          <h2 className="section-title" id="catalog-heading">
            <span className="section-index">[01]</span> Model catalog
          </h2>
          <p className="section-note">
            The full Go and free catalog. Filter by access, vendor, rating, privacy, price, and
            context. Prices are published API prices; Go allowances are plan limits, not a live
            balance.
          </p>
        </div>

        <div className="stack">
          <StatsBar stats={snapshot.stats} />
          <FilterBar
            filters={filters}
            vendors={vendors}
            shown={shown.length}
            total={models.length}
            onChange={changeFilters}
          />
          <div id="catalog-table">
            <ModelTable models={shown} filters={filters} research={research} onSort={onSort} onOpen={onOpen} />
          </div>
        </div>
      </section>
    </>
  )
}
