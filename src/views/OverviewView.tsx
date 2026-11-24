import { useMemo, useState } from 'react'
import type { Snapshot, ResearchFeed } from '../lib/types'
import { formatDateTime } from '../lib/format'
import { StatsBar } from '../components/StatsBar'
import { RecommendationGrid } from '../components/RecommendationGrid'
import { PlanValue } from '../components/PlanValue'
import { VendorFilter } from '../components/VendorFilter'
import { InfoPopover } from '../components/InfoPopover'
import { ArrowRight } from 'lucide-react'

interface Props {
  snapshot: Snapshot
  research: ResearchFeed | null
  onOpen: (id: string) => void
}

export function OverviewView({ snapshot, research: _research, onOpen }: Props) {
  const [vendors, setVendors] = useState<Set<string>>(
    () => new Set(snapshot.models.map((m) => m.vendor)),
  )
  const filtered = useMemo(
    () => snapshot.models.filter((m) => vendors.has(m.vendor)),
    [snapshot.models, vendors],
  )

  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-eyebrow meta meta-strong">
          Independent · {formatDateTime(snapshot.generatedAt)} · updated every 12 hours
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
            <a className="btn btn-primary" href="#models">
              Browse models <ArrowRight size={13} aria-hidden="true" />
            </a>
            <a className="btn" href="#analysis">Compare intelligence vs cost</a>
            <a className="btn" href="#about">How it works</a>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="overview-value-heading">
        <div className="section-head">
          <h2 className="section-title" id="overview-value-heading">
            <span className="section-index">[00]</span> What your Go plan buys
          </h2>
          <p className="section-note">
            Go is $10/month and Go Plus is $40/month. Each model has its own monthly usage
            allowance inside the plan and its own 5-hour request cap. This view shows both, so you
            can see how much of a model you can actually use.
            <InfoPopover title="How to read the plan view">
              <p>
                The plan price is what you pay OpenCode. The allowance is the monthly usage budget
                published for a specific model inside that plan. Requests per 5 hours is a separate
                rate limit.
              </p>
              <p>
                A model with a large allowance but a low request cap is good for long, expensive
                work; a model with a small allowance but a high request cap is better for many short
                requests. The table labels each model as budget-heavy, rate-heavy or balanced.
              </p>
            </InfoPopover>
          </p>
        </div>
        <div className="stack">
          <VendorFilter models={snapshot.models} selected={vendors} onChange={setVendors} />
          <PlanValue models={filtered} />
        </div>
      </section>

      <section className="section" aria-labelledby="picks-heading">
        <div className="section-head">
          <h2 className="section-title" id="picks-heading">
            <span className="section-index">[01]</span> Today's picks
          </h2>
          <p className="section-note">
            Five deterministic picks from the current snapshot. Open a card to see the numbers and
            the rule behind it.
          </p>
        </div>
        <RecommendationGrid
          recommendations={snapshot.recommendations}
          models={snapshot.models}
          onOpen={onOpen}
        />
      </section>

      <section className="section" aria-labelledby="overview-stats-heading">
        <div className="section-head">
          <h2 className="section-title" id="overview-stats-heading">
            <span className="section-index">[02]</span> Snapshot
          </h2>
        </div>
        <StatsBar stats={snapshot.stats} />
      </section>
    </>
  )
}
