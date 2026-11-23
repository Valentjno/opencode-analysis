import type { Snapshot } from '../lib/types'
import { formatDateTime } from '../lib/format'

interface Props {
  snapshot: Snapshot
}

export function MethodologyView({ snapshot }: Props) {
  const { sources, stats } = snapshot

  return (
    <section className="section" aria-labelledby="about-heading">
      <div className="section-head">
        <h2 className="section-title" id="about-heading">
          <span className="section-index">[04]</span> How this works
        </h2>
        <p className="section-note">
          This is an independent view for OpenCode developers. It is not affiliated with OpenCode or
          Artificial Analysis. Its purpose is to help you choose models based on your monthly Go
          allowance and your privacy needs.
        </p>
      </div>

      <div className="prose" style={{ maxWidth: 860 }}>
        <h2>Sources and freshness</h2>
        <p>
          A GitHub Action runs every 12 hours and writes two JSON files: <code>latest.json</code>{' '}
          (the catalog) and <code>changes.json</code> (the change feed). Cloudflare Pages rebuilds
          the site on each commit. No server, no account, no secrets, no cookies, and no analytics.
          The only browser storage is one key remembering your theme.
        </p>
        <ul>
          <li>
            <strong>OpenCode Go catalog</strong> —{' '}
            <a href="https://opencode.ai/inference/go/v1/models" target="_blank" rel="noreferrer noopener">
              opencode.ai/inference/go/v1/models
            </a>
            : {sources.opencodeGo.count ?? '—'} chat models. Mandatory.
          </li>
          <li>
            <strong>OpenCode full catalog</strong> —{' '}
            <a href="https://opencode.ai/inference/v1/models" target="_blank" rel="noreferrer noopener">
              opencode.ai/inference/v1/models
            </a>
            : {sources.opencodeAll.count ?? '—'} chat models, used to find free models. Mandatory.
          </li>
          <li>
            <strong>OpenCode Go page</strong> —{' '}
            <a href="https://opencode.ai/console/go" target="_blank" rel="noreferrer noopener">
              opencode.ai/console/go
            </a>
            : {sources.goPage.rows ?? '—'} rows of published monthly and 5-hour allowances. Optional.
          </li>
          <li>
            <strong>Artificial Analysis</strong> —{' '}
            <a href="https://artificialanalysis.ai/" target="_blank" rel="noreferrer noopener">
              artificialanalysis.ai
            </a>
            : {sources.artificialAnalysis.sitemapSlugs ?? '—'} model pages in the sitemap,{' '}
            {sources.artificialAnalysis.matched ?? '—'} matched, {sources.artificialAnalysis.rated ?? '—'}{' '}
            with an Intelligence Index. Optional.
          </li>
        </ul>
        <p>
          Every model page is read from its published HTML. Scores are matched by page slug, with a
          small auditable alias map for names that do not match automatically. A failed Artificial
          Analysis page keeps the last published score and is marked as cached; a model that has
          never been rated stays visible as “Not rated”. If either OpenCode catalog fails, the run
          exits without writing data. The last successful snapshot is shown with a staleness banner
          after 13 hours. Current snapshot: {formatDateTime(snapshot.generatedAt)}.
        </p>

        <h2>What is included</h2>
        <p>
          Only models that are in Go, free, or both: {stats.total} in total ({stats.go} in Go,{' '}
          {stats.free} free, {stats.both} in both). Paid Console-only models are excluded, even when
          Artificial Analysis rates them. Live dollar balances are out of scope; allowances are the
          published plan limits, not an account readout.
        </p>

        <h2>Recommendation rules</h2>
        <p>
          All picks are computed deterministically at refresh time from models with a numeric
          Intelligence Index. Ties are broken by lower blended price, then by id. There are{' '}
          {stats.rated} rated models in this snapshot.
        </p>
        <ol>
          <li>
            <strong>Best planner</strong> — highest Intelligence Index overall.
          </li>
          <li>
            <strong>Best cheap builder</strong> — cheaper than the planner and within 10 index points
            of it; highest index divided by (1 + blended price).
          </li>
          <li>
            <strong>Best for medium tasks</strong> — highest index among models at or below the
            median blended price of rated models.
          </li>
          <li>
            <strong>Cheapest capable</strong> — lowest blended price among models with an index of at
            least 25.
          </li>
          <li>
            <strong>Most private</strong> — no training on requests, zero data retention, and an index
            of at least 30; highest index wins. If none qualifies, the best no-training model is shown
            with a “not zero-retention” caveat. If none exists, the slot explains why.
          </li>
        </ol>
        <p>
          A caveat is attached whenever a pick trains on requests or has undocumented terms. This is
          why Gemini 4 Argon (no training, but no zero-retention guarantee) and Muse Spark (training
          on requests) are never presented as equivalent: {stats.private} models are fully private and{' '}
          {stats.trains} are documented as training on requests.
        </p>

        <h2>Pareto frontier</h2>
        <p>
          A model is dominated when another rated model has an Intelligence Index at least as high
          and a blended price no higher (or a monthly Go allowance at least as high), with at least
          one strict difference. The frontier is the set of non-dominated models. Lower price and
          higher allowance are better. Models without a score cannot be placed, and unlimited request
          caps are reported separately rather than treated as a number.
        </p>
        <p>
          Blended price is 75% input + 25% output per 1M tokens. It is a published API price, not the
          effective cost inside a Go subscription. The allowance view uses the published monthly Go
          usage limit instead.
        </p>

        <h2>Privacy tiers</h2>
        <ul>
          <li><strong>Private</strong> — no training and zero retention, both explicit.</li>
          <li><strong>No training</strong> — no training, but zero retention is not guaranteed.</li>
          <li><strong>Trains on requests</strong> — the provider may train on requests.</li>
          <li><strong>Unknown</strong> — terms are not documented; never treated as private.</li>
        </ul>
        <p>
          Go models use the structured training and zero-retention flags in the OpenCode API. Free
          models use a curated, dated map built from the OpenCode privacy documentation. When the
          documentation is silent, the answer is “unknown”, never “private”.
        </p>

        <h2>Limitations</h2>
        <ul>
          <li>Artificial Analysis does not rate every model, and its scores change over time.</li>
          <li>Allowances are published estimates and can be changed by OpenCode without notice.</li>
          <li>Regional availability and plan details are outside this project.</li>
          <li>This site does not read your account or tell you how much allowance you have left.</li>
        </ul>

        <h2>Credits</h2>
        <p>
          Model data and allowances come from{' '}
          <a href="https://opencode.ai/" target="_blank" rel="noreferrer noopener">OpenCode</a>.
          Intelligence Index, eval scores, capability scores, speed, and cost-per-task come from{' '}
          <a href="https://artificialanalysis.ai/" target="_blank" rel="noreferrer noopener">
            Artificial Analysis
          </a>
          . This project is an independent, community-made view and is not endorsed by either.
          Source code and data are published under the MIT license.
        </p>
      </div>
    </section>
  )
}
