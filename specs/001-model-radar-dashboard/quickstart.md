# Quickstart Validation Guide: OpenCode Model Radar

**Feature**: 001-model-radar-dashboard | **Date**: 2026-11-23

A runnable guide for proving the dashboard works end to end. Implementation
details live in [plan.md](./plan.md) and the code; contracts live in
[data-model.md](./data-model.md) and [contracts/](./contracts/).

## Prerequisites

- Node.js 24+ and npm 11+
- Git
- Network access to `opencode.ai` and `artificialanalysis.ai`
- Optional: a Cloudflare account for deployment

## Setup

```bash
npm ci
npm run refresh     # fetch upstreams, write public/data, validate
npm run dev         # http://localhost:5173
```

## Quality Gates

```bash
npm run lint        # oxlint
npm test            # vitest run
npm run validate    # JSON Schema + invariants on public/data
npm run build       # tsc -b && vite build
npm run preview     # serve dist/ locally
```

All five MUST pass before merge (Constitution V).

## Validation Scenarios

### V1 — Catalog completeness (User Story 1)

1. Run `npm run refresh`, then `npm run dev`.
2. Open the catalog. Compare the row count with `stats.total` in
   `public/data/latest.json`.
3. Set the access filter to "Free"; only free rows remain.
4. Sort by Intelligence descending; unrated models appear last with "Not rated".
5. Search "deepseek"; only matching models remain.
6. Resize to 390 px; the catalog remains usable without horizontal page scroll.

**Expected**: every Go/free model appears once, no paid-only model, filters and
search update the count, unrated models are never hidden.

### V2 — Detail view (User Story 2)

1. Click a rated model (e.g. a Go model with II).
2. Verify II, domain indexes, evals, price, context, allowance, privacy, and
   both outbound links.
3. Click an unrated model; sections without data read "Not published".
4. Press Escape; the panel closes and focus returns to the table row.
5. Open `#model=<id>` directly; the same panel opens.

**Expected**: values match `latest.json`; links open AA and the OpenCode console
in a new tab; unknown privacy reads "Not documented", never "Private".

### V3 — Value view (User Story 3)

1. Open the Value tab.
2. Confirm every rated model with a price appears as a labeled point.
3. Identify the frontier; verify no frontier point is dominated (another point
   has ≥ II and ≤ price).
4. Switch to the Go allowance view; unlimited models are listed separately.
5. Toggle "Show data table"; values match the chart.

**Expected**: frontier is correct, unrated models are excluded with a note, and
the table is a complete equivalent.

### V4 — Recommendations (User Story 4)

1. Open the daily picks panel.
2. Confirm five cards: planner, cheap builder, medium, cheapest capable, most
   private.
3. Verify the builder's blended price is lower than the planner's and its II is
   within 10 points.
4. Verify the private pick has no training and zero retention; if none exists,
   the card explains why.
5. Check the caveat on any pick whose model trains on requests.

**Expected**: every non-empty pick references an existing model; rules are
printed on the card; no fabricated pick when the sample is insufficient.

### V5 — Change feed (User Story 5)

1. Copy `public/data/latest.json`, change one model's `pricing.blended`, and run
   `node scripts/validate-data.mjs` followed by the refresh comparison path (or
   use the unit tests with fixtures).
2. Open the Changes tab.
3. Confirm one price event with old and new values, newest first.
4. Run a refresh with no upstream changes; confirm no new events and the
   "nothing changed" state.

**Expected**: no duplicate events, no false events, cap of 500 respected.

### V6 — Freshness, attribution, methodology (User Story 6)

1. Edit `generatedAt` in `latest.json` to 14 hours ago and reload.
2. Confirm the stale banner appears; restore the value.
3. Scroll to the footer: OpenCode and Artificial Analysis are credited and
   linked; the independence statement and MIT license are visible.
4. Open the methodology page; every recommendation rule and the Pareto
   definition are explained.

**Expected**: stale data is flagged on every view; all sources are one click
away; no claim is unexplained.

### V7 — Failure tolerance

1. Temporarily point one alias at a non-existent AA slug and run `npm run
   refresh`.
2. Confirm the run completes, the model keeps its previous score marked stale,
   and the dataset is still valid.
3. Temporarily set the OpenCode Go URL to an invalid host and run the refresh.
4. Confirm the run exits non-zero and `latest.json` is unchanged.

**Expected**: optional failures degrade gracefully; mandatory failures never
destroy the last good dataset.

### V8 — Deployment

1. Push to `main`.
2. Cloudflare Pages builds `npm run build` and publishes `dist`.
3. Open `https://opencode-analysis.pages.dev`.
4. Manually run the "Refresh data" workflow; confirm a data commit triggers a
   new deployment within 30 minutes.

**Expected**: zero manual steps after the one-time Pages connection; the site is
served over HTTPS with no console errors.

### V9 — OpenCode visual parity and themes

1. Load the site with the OS in dark mode; confirm the canvas is `#0c0c0c`, the
   header is 76 px, labels are uppercase 13 px mono, and the accent is
   `#4f8bff`.
2. Toggle to Light; confirm the canvas is `#fbfbfb`, text is `#161616`, borders
   are `#e0e0e0`, and the accent is `#3b5cf6`.
3. Reload; confirm the chosen theme is applied before first paint (no white
   flash in dark mode, no dark flash in light mode).
4. Set the control back to System and change the OS theme; the site follows.
5. Run a contrast check on body text, muted text, links, and badges in both
   themes; all pass WCAG 2.1 AA.
6. Confirm no request is made to Google Fonts or any third party.

**Expected**: the site is immediately recognizable as OpenCode's design language
in both themes, and the toggle never causes a flash or layout shift.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `refresh` exits before writing | OpenCode catalog fetch failed | Check network/upstream status; rerun |
| Many models "Not rated" | AA sitemap or slug changed | Update `data/aliases.json`; rerun |
| Privacy shows "Not documented" | Free model missing from the curated map | Add an entry from the docs |
| Stale banner persists | Scheduled workflow failing | Inspect the Actions run log |
| Charts missing | AA data absent for all models | Expected; catalog remains usable |
| Pages build fails | Node version or build command mismatch | Set Node 24, build `npm run build`, output `dist` |
