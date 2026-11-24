import type { Snapshot, ResearchFeed } from '../lib/types'
import { formatDateTime } from '../lib/format'
import { StatsBar } from '../components/StatsBar'
import { RecommendationGrid } from '../components/RecommendationGrid'
import { ValueChart } from '../components/ValueChart'
import { ArrowRight } from 'lucide-react'

interface Props {
  snapshot: Snapshot
  research: ResearchFeed | null
  onOpen: (id: string) => void
}

export function OverviewView({ snapshot, research: _research, onOpen }: Props) {
  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-eyebrow meta meta-strong">
          Independent · {formatDateTime(snapshot.generatedAt)} · updates every 12h
        </div>
        <h1 id="hero-heading">
          Every Go and free model. <em>Measured.</em>
        </h1>
        <div className="hero-copy">
          <p>
            OpenCode's Go and free models joined with Artificial Analysis intelligence scores,
            published allowances, and honest privacy terms. Built for developers deciding what to
            run this month — not a leaderboard for its own sake.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#models">
              Browse models <ArrowRight size={13} aria-hidden="true" />
            </a>
            <a className="btn" href="#analysis">Intelligence vs cost</a>
            <a className="btn" href="#about">How it works</a>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="overview-value-heading">
        <div className="section-head">
          <h2 className="section-title" id="overview-value-heading">
            <span className="section-index">[00]</span> Intelligence per dollar
          </h2>
          <p className="section-note">
            Blended API price per 1M tokens on the x-axis, Artificial Analysis Intelligence Index on
            the y-axis. Points on the frontier are non-dominated: no rated model is both smarter and
            cheaper. Free models sit at $0.
          </p>
        </div>
        <ValueChart mode="price" models={snapshot.models} />
      </section>

      <section className="section" aria-labelledby="picks-heading">
        <div className="section-head">
          <h2 className="section-title" id="picks-heading">
            <span className="section-index">[01]</span> Today's picks
          </h2>
          <p className="section-note">
            Deterministic, recomputed on every refresh. Select a card to inspect the model and the
            exact values behind the pick.
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