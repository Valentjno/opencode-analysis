# Implementation Plan: OpenCode Model Radar

**Branch**: `001-model-radar-dashboard` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-model-radar-dashboard/spec.md`

## Summary

Build a static, single-page comparison dashboard for every OpenCode Go and
OpenCode free chat model, enriched with Artificial Analysis intelligence data.
A Node script runs every 12 hours on GitHub Actions, fetches both OpenCode
catalogs plus the Go console allowances, maps models to AA pages, extracts
scores, computes recommendations and a change feed, validates the result, and
commits the JSON. Cloudflare Pages builds the Vite/React site on every push and
serves it at `opencode-analysis.pages.dev` for $0. The UI is a catalog, a value
view (intelligence vs price and vs Go allowance), a daily-picks panel, a change
feed, and a methodology page — with explicit "Not rated" and "Not documented"
states.

## Technical Context

**Language/Version**: TypeScript 7.0 (strict), Node.js 24 (refresh + CI scripts)

**Primary Dependencies**: React 19, Vite 8, Tailwind CSS 4, Recharts 3,
Lucide React, Cheerio (build-time only), clsx, self-hosted Inter and JetBrains
Mono (via Fontsource); Vitest and Ajv (dev only)

**Storage**: Static JSON committed under `public/data/` (`latest.json`,
`changes.json`). No database, no server, no cookies. The only browser storage is
one `localStorage` key for the theme preference; nothing is transmitted.

**Testing**: Vitest for pure analytics (Pareto, recommendations, filters,
formatting) and `scripts/validate-data.mjs` for contract invariants; CI runs
lint, tests, validation, and a production build.

**Target Platform**: Static site on Cloudflare Pages; evergreen desktop and
mobile browsers down to 360 px wide.

**Project Type**: Single-project web application with a build-time data pipeline

**Performance Goals**: Initial route usable under 3 s on simulated 4G; initial
JS under 300 KB gzipped (Recharts lazy-loaded); interactions at 60 fps for ~40
rows.

**Constraints**: $0 recurring cost; no secrets; 12-hour refresh; tolerate AA
partial failure; dataset under 1 MB; no analytics, trackers, or cookies; both
themes must match OpenCode's published palettes and pass WCAG AA.

**Scale/Scope**: ~40 models, ~30 AA page fetches per refresh, one page with four
views and one detail panel, unlimited public readers served by CDN.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Free & Serverless | Static build + GitHub Actions + Cloudflare Pages; no paid service, no secret | PASS |
| II. Source Fidelity & Attribution | Every number carries source URL and refresh time; unknowns labeled; Go/free scope enforced; visible credits | PASS |
| III. Honest Privacy & Cost | Structured flags first, curated doc map second, `null` for unknown; per-model allowance; documented rules | PASS |
| IV. Boring, Maintainable Stack | Vite/React/TS/Tailwind + Recharts/Lucide only; versioned JSON contract; no extra frameworks | PASS |
| V. Verifiable Automation | lint + tests + validate + build in CI; per-source failure isolation; commit only on change | PASS |

No violations; no complexity justification required.

## Design Language: OpenCode Parity

The theme is not an approximation. Tokens were extracted from the live OpenCode
stylesheets on 2026-11-23 (`shell-D8x4Q6q5.css`, `home-B2nwsUqQ.css`).

| Token | Dark | Light |
|-------|------|-------|
| Canvas | `#0c0c0c` | `#fbfbfb` |
| Surface | `#161616` | `#ffffff` |
| Raised | `#1a1a1a` | `#f5f5f5` |
| Border | `#2e2e2e` | `#e0e0e0` |
| Border strong | `#4b4b4b` | `#d2d2d2` |
| Text | `#fafafa` | `#161616` |
| Text secondary | `#aeaeae` | `#5c5c5c` |
| Text muted | `#8f8f8f` | `#6b6b6b` |
| Accent/link | `#4f8bff` | `#3b5cf6` |
| Success | `#54d483` | `#239f50` |
| Warning | `#f4b434` | `#eb980a` |
| Danger | `#ed5a5a` | `#db2424` |

Typography: Inter for prose, JetBrains Mono (a close, OFL-licensed stand-in for
OpenTUI Mono) for labels, numbers, nav, and buttons. Radii 3 px / 5 px / 8 px.
Uppercase 13 px nav and button labels with `0.04em` tracking. Section indices
use bracket notation (`[01]`), thin 1 px rules, and a 24 px page gutter. Default
theme is dark; a three-state control (system / light / dark) sits in the header,
persists one `localStorage` key, and is initialized by a blocking inline script
to avoid a flash.

## Project Structure

### Documentation (this feature)

```text
specs/001-model-radar-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── dataset.schema.json
│   ├── changes.schema.json
│   └── upstream-sources.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
data/
├── aliases.json             # OpenCode model id -> AA slug (curated overrides)
└── free-privacy.json        # Curated privacy profile for free models

public/
├── data/
│   ├── latest.json          # Generated dataset (schemaVersion 1)
│   └── changes.json         # Generated change feed (max 500 events)
├── favicon.svg
└── robots.txt

scripts/
├── refresh.mjs              # Orchestrator: fetch, map, build, validate, write
├── validate-data.mjs        # Contract + invariant validator (CI + pre-write)
└── lib/
    ├── opencode.mjs         # Catalogs, Go page parsing, privacy resolution
    ├── artificial-analysis.mjs # Sitemap, RSC extraction, alias matching
    ├── dataset.mjs          # Model assembly, stats, change events
    └── recommend.mjs        # Pareto + daily recommendation rules

src/
├── components/
│   ├── Layout.tsx
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── StaleBanner.tsx
│   ├── StatsBar.tsx
│   ├── FilterBar.tsx
│   ├── ThemeToggle.tsx
│   ├── ModelTable.tsx
│   ├── ModelDetail.tsx
│   ├── PrivacyBadge.tsx
│   ├── ScoreBar.tsx
│   ├── RecommendationGrid.tsx
│   ├── ValueChart.tsx
│   └── DataTable.tsx
├── views/
│   ├── CatalogView.tsx
│   ├── ValueView.tsx
│   ├── ChangesView.tsx
│   └── MethodologyView.tsx
├── lib/
│   ├── types.ts             # Dataset contract types
│   ├── data.ts              # Load + validate at runtime, expose helpers
│   ├── format.ts            # Number, price, date, allowance formatting
│   ├── filters.ts           # Filter/sort state and pure predicates
│   ├── pareto.ts            # Non-dominated frontier
│   ├── recommendations.ts   # Display helpers + shared rule labels
│   ├── privacy.ts           # Tiering and labels
│   └── theme.ts             # Theme state, persistence, system listener
├── App.tsx                  # Hash routing: #catalog, #value, #changes, #about
├── main.tsx
└── index.css

tests/
├── pareto.test.ts
├── filters.test.ts
├── recommend.test.ts
└── format.test.ts

.github/workflows/
├── ci.yml                   # PR/push: install, lint, test, validate, build
└── refresh.yml              # 12h + manual: refresh, validate, commit if changed
```

**Structure Decision**: Single project. The refresh pipeline and the frontend
are separate entry points in one repository because they share the JSON
contract; there is no server, so no `backend/` directory exists. Pure analytics
live in `scripts/lib` (consumed at build time) and `src/lib` (display-side
derivations), with tests covering both.

## Complexity Tracking

No constitution violations. The only added dependency beyond the minimum is
Vitest (dev-only) to make the recommendation and Pareto rules testable.
