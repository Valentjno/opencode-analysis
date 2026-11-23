# OpenCode Model Radar

**Live:** https://opencode-analysis.pages.dev

An independent dashboard for OpenCode developers: every Go and free model in one
place, joined with [Artificial Analysis](https://artificialanalysis.ai/)
intelligence scores, published Go allowances, and honest privacy terms. It
answers a practical question — **which model should I use for this task, given
my monthly allowance and my privacy needs?**

It is not affiliated with OpenCode or Artificial Analysis. There are no paid
Console-only models, no server, no account, no secrets, no cookies, and no
analytics.

## What you get

- **Catalog** — all Go and free models, searchable, filterable and sortable.
  Unrated models stay visible and are labeled "Not rated".
- **Details** — the full Artificial Analysis breakdown, eval scores, pricing,
  context, monthly and 5-hour Go allowances, privacy terms, and source links.
- **Value** — Pareto frontiers for intelligence vs. price and vs. monthly Go
  allowance, with an accessible table equivalent.
- **Picks** — five deterministic suggestions: best planner, best cheap builder,
  best for medium tasks, cheapest capable model, and most private option.
- **Changes** — a newest-first feed of additions, removals, and changes to
  prices, scores, allowances, privacy, and access.
- **About** — the methodology, every rule, and explicit attribution.

The interface follows OpenCode's own visual language and offers both dark and
light themes. The theme choice is stored locally; nothing is transmitted.

## Data sources

| Source | Used for |
|--------|----------|
| [`opencode.ai/inference/go/v1/models`](https://opencode.ai/inference/go/v1/models) | Go catalog (mandatory) |
| [`opencode.ai/inference/v1/models`](https://opencode.ai/inference/v1/models) | Full catalog, to discover free models (mandatory) |
| [`opencode.ai/console/go`](https://opencode.ai/console/go) | Published monthly and 5-hour allowances (optional) |
| [`artificialanalysis.ai`](https://artificialanalysis.ai/) | Intelligence Index, evals, capability scores, speed, cost per task (optional) |

Model data and allowances come from OpenCode. Benchmark data comes from
Artificial Analysis. Both are credited in the site footer and methodology
page. Scores are matched by published page slug with a small curated alias map
in `data/aliases.json`; privacy terms for free models are curated in
`data/free-privacy.json` because the Go API does not carry those flags.

## How it runs

1. `.github/workflows/refresh.yml` runs every 12 hours (and can be triggered
   manually).
2. `scripts/refresh.mjs` fetches the sources, validates the result against the
   JSON Schemas and semantic rules, and writes `public/data/latest.json` and
   `public/data/changes.json` atomically. If a mandatory OpenCode catalog
   fails, it exits without writing anything.
3. The workflow commits the two JSON files only when they changed.
4. Cloudflare Pages rebuilds on each push to `main`. The build command is
   `npm run build` and the output directory is `dist`.

No runtime API calls, no database, no environment variables.

## Local development

```bash
npm ci
npm run refresh     # regenerate data (network required)
npm run validate    # check the published JSON files
npm test            # 32 unit tests
npm run lint
npm run dev         # http://localhost:5173
npm run build
```

Node 24 or newer is required.

## Deployment

The repository is public under `Valentjno/opencode-analysis` and licensed under
the [MIT license](LICENSE). Cloudflare Pages is connected to that repository;
the project name is `opencode-analysis`, so the site is served at
`opencode-analysis.pages.dev`.

## Privacy note

Go models use OpenCode's structured `training` and `zdr` flags. Free models use
a curated, dated map built from the OpenCode privacy documentation. Models with
undocumented terms are labeled **Unknown** — never "private". The recommended
private option requires no training, zero retention, and an Intelligence Index
of at least 30; when nothing qualifies, the site says so instead of inventing a
pick. A model that trains on requests is never presented as equivalent to one
that does not.
