# Tasks: OpenCode Model Radar

**Input**: Design documents from `/specs/001-model-radar-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included because Constitution Principle V requires verifiable automation.
Unit tests cover the pure analytics; `scripts/validate-data.mjs` covers the data
contract; the quickstart covers end-to-end scenarios.

**Organization**: Tasks are grouped by user story. US1 and US2 are both P1; the
catalog ships first, then the detail panel on the same data.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US6 from spec.md
- Every task includes the exact file path(s)

## Path Conventions

Single project at the repository root: `src/`, `scripts/`, `data/`, `public/`,
`tests/`, `.github/workflows/`, `specs/001-model-radar-dashboard/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the scaffold, dependencies, and automation skeleton.

- [ ] T001 Verify the Vite + React + TypeScript scaffold and install runtime deps (React 19, Recharts, Lucide, Cheerio, clsx) plus dev deps (Tailwind 4, Vitest, Ajv) in `package.json` and `package-lock.json`.
- [ ] T002 [P] Configure Tailwind v4 via `@tailwindcss/vite` and the base theme (colors, fonts, spacing) in `vite.config.ts` and `src/index.css`.
- [ ] T003 [P] Confirm the contract artifacts exist and are referenced by the validator: `specs/001-model-radar-dashboard/contracts/dataset.schema.json`, `changes.schema.json`, `upstream-sources.md`.
- [ ] T004 [P] Add the MIT license and crawler policy in `LICENSE` and `public/robots.txt`.
- [ ] T005 [P] Add the CI workflow (install, lint, test, validate, build) in `.github/workflows/ci.yml`.
- [ ] T006 [P] Add the 12-hour refresh workflow (`schedule` + `workflow_dispatch`, commit data only on change) in `.github/workflows/refresh.yml`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data contract, pipeline libraries, and validation. Nothing in the
UI can be trusted until these exist.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T007 [P] Define the dataset contract types in `src/lib/types.ts`, covering every field and nullability in `data-model.md`: `Snapshot.schemaVersion`, `Snapshot.generatedAt`, `Snapshot.plans`, `Snapshot.sources`, `Snapshot.stats`, `Snapshot.recommendations`, `Snapshot.models`; `Model.id`, `Model.name`, `Model.canonicalId`, `Model.vendor`, `Model.description`, `Model.family`, `Model.openWeights`, `Model.releaseDate`, `Model.lastUpdated`, `Model.knowledge`, `Model.access`, `Model.pricing`, `Model.context`, `Model.maxOutput`, `Model.modalities`, `Model.capabilities`, `Model.go`, `Model.privacy`, `Model.aaSlug`, `Model.aa`, `Model.aaStatus`; `Access.go`, `Access.free`, `Access.limitedRegions`; `Pricing.input`, `Pricing.output`, `Pricing.cacheRead`, `Pricing.blended`; `GoAccess.monthly.go`, `GoAccess.monthly.goPlus`, `GoAccess.monthly.goTeams`, `GoAccess.requests5h.go`, `GoAccess.requests5h.goPlus`, `GoAccess.requests5h.goUnlimited`, `GoAccess.requests5h.goPlusUnlimited`, `GoAccess.featured`; `Privacy.training`, `Privacy.zdr`, `Privacy.retentionDays`, `Privacy.limitedRegions`, `Privacy.source`, `Privacy.note`; `AAProfile.slug`, `AAProfile.url`, `AAProfile.variant`, `AAProfile.suffix`, `AAProfile.effort`, `AAProfile.releaseDate`, `AAProfile.deprecated`, `AAProfile.deprecatedTo`, `AAProfile.intelligenceIndex`, `AAProfile.capabilities`, `AAProfile.evals`, `AAProfile.omniscience`, `AAProfile.contextWindow`, `AAProfile.outputSpeed`, `AAProfile.timeToFirstToken`, `AAProfile.costPerTask`, `AAProfile.aaPrice`, `AAProfile.isOpenWeights`; `Recommendation.slot`, `Recommendation.title`, `Recommendation.modelId`, `Recommendation.rule`, `Recommendation.reason`, `Recommendation.caveat`, `Recommendation.intelligenceIndex`, `Recommendation.blendedPrice`, `Recommendation.monthlyGo`; `ChangeEvent.at`, `ChangeEvent.type`, `ChangeEvent.id`, `ChangeEvent.name`, `ChangeEvent.message`, `ChangeEvent.field`, `ChangeEvent.from`, `ChangeEvent.to`.
- [ ] T008 [P] Implement value formatting (price, allowance, tokens, dates, relative time, "Not rated"/"—") in `src/lib/format.ts`.
- [ ] T009 [P] Implement privacy tiering and labels (`private`, `no-training`, `trains`, `unknown`) per `data-model.md` `Privacy.training`, `Privacy.zdr` in `src/lib/privacy.ts`.
- [ ] T010 [P] Implement catalog filter and sort predicates (access, vendor, privacy, rating, search; unrated sorts last by score) in `src/lib/filters.ts`.
- [ ] T011 [P] Implement the non-dominated frontier for price (minimize) and Go allowance (maximize; unlimited excluded) per `data-model.md` and `research.md` R8 in `src/lib/pareto.ts`.
- [ ] T012 [P] Implement the five recommendation rules with deterministic tie-breaks and null results per `data-model.md` `Recommendation.*` and `research.md` R7 in `scripts/lib/recommend.mjs`.
- [ ] T013 Implement the OpenCode source library: both catalogs, chat-model filter, free detection, Go page parsing, vendor normalization, privacy resolution per `data-model.md` `Model.access`, `Model.pricing`, `Model.go`, `Model.privacy` in `scripts/lib/opencode.mjs`.
- [ ] T014 Implement the Artificial Analysis library: sitemap parsing, RSC frame decoding, `initialModels` selection by slug, score extraction, and alias matching per `data-model.md` `AAProfile.*` in `scripts/lib/artificial-analysis.mjs`.
- [ ] T015 Implement dataset assembly: per-model merge, `stats` counters, sorting, and change-event generation per `data-model.md` `Stats`, `ChangeEvent.*`, and `research.md` R13 in `scripts/lib/dataset.mjs`.
- [ ] T016 Implement the validator: Ajv schema checks plus Validation Rules 1–10 from `data-model.md`, with clear error output, in `scripts/validate-data.mjs`.
- [ ] T017 Rewrite `scripts/refresh.mjs` as the orchestrator: mandatory-catalog failure policy, optional AA/Go-page degradation, recommendation generation, `schemaVersion`/`generatedAt`, atomic write, validate-before-write (`scripts/lib/*`, `public/data/latest.json`, `public/data/changes.json`).
- [ ] T018 [P] Add shared test fixtures (rated, unrated, unlimited allowance, unknown privacy, zero-rated) in `tests/fixtures/dataset.ts`.
- [ ] T019 Implement the dataset loader with a `schemaVersion` compatibility guard, staleness check (>13 h), and derived maps in `src/lib/data.ts`.
- [ ] T020 Add unit tests for Pareto, recommendations, filters, privacy tiers, and formatting in `tests/pareto.test.ts`, `tests/recommend.test.ts`, `tests/filters.test.ts`, `tests/privacy.test.ts`, `tests/format.test.ts`.

**Checkpoint**: `npm run refresh`, `npm run validate`, `npm test` pass on real data.

---

## Phase 2b: OpenCode Design System (Blocking for all UI)

**Purpose**: Encode OpenCode's verified palette, type, and shape, plus the
light/dark theme, before any screen is built.

- [ ] T021 [P] Encode the OpenCode tokens from `research.md` R19 (canvas, surface, raised, borders, text tiers, accent, status colors, 3/5/8 px radii, 24 px gutter, 76 px header) as CSS custom properties with `[data-theme="light"]` overrides in `src/index.css`.
- [ ] T022 [P] Implement theme state (`system` / `light` / `dark`), a single persisted key (`oar-theme`), and a blocking inline boot script in `src/lib/theme.ts` and `index.html` so the correct theme paints before first frame.
- [ ] T023 Build the three-state theme toggle with accessible labels and system-change listening in `src/components/ThemeToggle.tsx` (depends on T022).
- [ ] T024 Add self-hosted Inter and JetBrains Mono via Fontsource, map `--font-sans` / `--font-mono`, and confirm no third-party font request in `src/index.css` and `package.json`.

**Checkpoint**: Both palettes render, the toggle persists, and there is no flash
of the wrong theme. Quickstart V9 passes.

---

## Phase 3: User Story 1 — Browse every Go and free model (Priority: P1) 🎯 MVP

**Goal**: One searchable, filterable, sortable catalog of all Go and free models,
with unrated models visible and labeled.

**Independent Test**: Quickstart V1 — compare row count with `stats.total`,
filter to Free, sort by intelligence, search a vendor, resize to 390 px.

- [ ] T025 [US1] Build the app shell with OpenCode-style header, bracket section indices, theme toggle, and hash routing (`#catalog`, `#value`, `#changes`, `#about`) in `src/App.tsx`, `src/main.tsx`, and `src/components/Layout.tsx`.
- [ ] T026 [P] [US1] Build the summary counters (total, Go, free, rated, private) from `stats` in `src/components/StatsBar.tsx`.
- [ ] T027 [P] [US1] Build the privacy badge (tier + label + tooltip) in `src/components/PrivacyBadge.tsx`.
- [ ] T028 [P] [US1] Build the filter/search controls with accessible labels and a result count in `src/components/FilterBar.tsx`.
- [ ] T029 [US1] Build the catalog table: sortable headers, unrated-last score sort, price/allowance/context columns, row activation, and a mobile card layout in `src/components/ModelTable.tsx` (depends on T026–T028).
- [ ] T030 [US1] Build the catalog view that composes stats, filters, table, and empty state in `src/views/CatalogView.tsx`.
- [ ] T031 [US1] Add sort/filter unit tests for the unrated-last rule and access/search combinations in `tests/filters.test.ts`.
- [ ] T032 [US1] Verify Quickstart V1 and record the result in `specs/001-model-radar-dashboard/quickstart.md` notes.

**Checkpoint**: The catalog is independently useful and deployable.

---

## Phase 4: User Story 2 — Inspect a model in detail (Priority: P1)

**Goal**: A detail panel with full AA breakdown, pricing, allowances, privacy,
and outbound links for every model, including unrated ones.

**Independent Test**: Quickstart V2 — open a rated model, verify every value
against `latest.json`, open an unrated model, press Escape, deep-link a model.

- [ ] T033 [P] [US2] Build the score bar component for domain indexes and eval scores in `src/components/ScoreBar.tsx`.
- [ ] T034 [US2] Build the detail panel: header, score sections, pricing, context, Go monthly and request allowances, privacy note, and outbound links in `src/components/ModelDetail.tsx` (depends on T033).
- [ ] T035 [US2] Implement "Not published"/"Not documented" states for every empty section and mark stale AA data in `src/components/ModelDetail.tsx`.
- [ ] T036 [US2] Wire open/close from `ModelTable.tsx`, Escape/focus return, and `#model=<id>` deep links in `src/App.tsx` and `src/components/ModelDetail.tsx`.
- [ ] T037 [US2] Verify Quickstart V2 and record the result in `quickstart.md` notes.

**Checkpoint**: Every number is inspectable and traceable to its source.

---

## Phase 5: User Story 3 — See what intelligence costs (Priority: P2)

**Goal**: Pareto scatter of intelligence vs blended price and vs Go monthly
allowance, with a complete textual equivalent.

**Independent Test**: Quickstart V3 — every rated priced model is a point, the
frontier has no dominated points, unlimited allowances are separate, and the
table matches.

- [ ] T038 [P] [US3] Build the lazy-loaded Recharts scatter with labeled points, frontier highlight, tooltips, and price/allowance modes in `src/components/ValueChart.tsx`.
- [ ] T039 [P] [US3] Build the accessible data-table equivalent for chart series in `src/components/DataTable.tsx`.
- [ ] T040 [US3] Build the Value view with mode toggle, frontier explanation, excluded-unrated note, and unlimited-allowance list in `src/views/ValueView.tsx` (depends on T038, T039).
- [ ] T041 [US3] Lazy-load the Value view and its chart bundle from `src/App.tsx`.
- [ ] T042 [US3] Verify Quickstart V3 and record the result in `quickstart.md` notes.

**Checkpoint**: Value comparison works and is accessible without a chart.

---

## Phase 6: User Story 4 — Get a daily recommendation (Priority: P2)

**Goal**: Five deterministic picks (planner, cheap builder, medium, cheapest
capable, most private) with rule, values, and privacy caveats.

**Independent Test**: Quickstart V4 — five cards, builder cheaper than planner,
private pick excludes training models, insufficient-sample state explains itself.

- [ ] T043 [P] [US4] Build the recommendation card and grid with rule, reason, caveat, and empty-state display in `src/components/RecommendationGrid.tsx`.
- [ ] T044 [US4] Implement display helpers that resolve `Recommendation.modelId` to a model and format its values in `src/lib/recommendations.ts`.
- [ ] T045 [US4] Integrate the picks panel above the catalog and link each card to its model detail in `src/views/CatalogView.tsx` and `src/App.tsx` (depends on T043, T044).
- [ ] T046 [US4] Verify Quickstart V4 and record the result in `quickstart.md` notes.

**Checkpoint**: The dashboard answers "what should I use today?".

---

## Phase 7: User Story 5 — Understand what changed (Priority: P3)

**Goal**: A newest-first change feed with additions, removals, price/score/
allowance/privacy/access changes, no duplicates, and a no-change state.

**Independent Test**: Quickstart V5 — one event per difference, no-change run
emits nothing, 500-event cap, rename becomes remove + add.

- [ ] T047 [P] [US5] Build the change feed view with type filters, relative timestamps, old→new values, and a no-change state in `src/views/ChangesView.tsx`.
- [ ] T048 [US5] Add unit tests for change generation, dedupe, cap, and rename behavior in `tests/changes.test.ts`.
- [ ] T049 [US5] Load `changes.json` with a missing-file fallback and wire the route in `src/lib/data.ts` and `src/App.tsx` (depends on T047).
- [ ] T050 [US5] Verify Quickstart V5 and record the result in `quickstart.md` notes.

**Checkpoint**: Automation is auditable.

---

## Phase 8: User Story 6 — Trust the data and its sources (Priority: P3)

**Goal**: Freshness banner, visible attribution and independence, and a
methodology page that explains every rule.

**Independent Test**: Quickstart V6 — age the data past 13 h, verify the banner,
credits/links, independence statement, and methodology coverage.

- [ ] T051 [P] [US6] Build the footer with OpenCode and Artificial Analysis credits, links, independence statement, MIT license, and repository link in `src/components/Footer.tsx`.
- [ ] T052 [P] [US6] Build the methodology view covering recommendation rules, Pareto definition, privacy tiers, refresh cadence, and limitations in `src/views/MethodologyView.tsx`.
- [ ] T053 [US6] Implement the staleness banner (>13 h) and source-health note in `src/components/StaleBanner.tsx` and `src/lib/data.ts`.
- [ ] T054 [US6] Wire `#about`, footer links, and per-model source links in `src/App.tsx` and `src/components/ModelDetail.tsx`.
- [ ] T055 [US6] Write the README: purpose, live URL, screenshots placeholder, data sources, independence, attribution, local dev, deployment, and "how to use your Go allowance based on privacy needs" in `README.md`.
- [ ] T056 [US6] Verify Quickstart V6 and record the result in `quickstart.md` notes.

**Checkpoint**: A skeptical reader can verify the project's claims.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, performance, failure drills, and the live deploy.

- [ ] T057 Responsive and accessibility audit: 390 px layout, keyboard path, focus visibility, contrast, reduced motion, chart table toggle in `src/**`.
- [ ] T058 Performance audit: lazy chunks, initial JS < 300 KB gzipped, Lighthouse mobile run, fix regressions in `vite.config.ts` and `src/App.tsx`.
- [ ] T059 Run all quality gates and fix failures: `npm run lint`, `npm test`, `npm run validate`, `npm run build` (`package.json`, `scripts/validate-data.mjs`).
- [ ] T060 Failure drills: bad AA slug (stale, run completes) and bad OpenCode host (run exits, data unchanged) per Quickstart V7; record in `quickstart.md`.
- [ ] T061 Publish: create `Valentjno/opencode-analysis`, push `main`, connect Cloudflare Pages (build `npm run build`, output `dist`), verify `https://opencode-analysis.pages.dev` and a manual refresh deploy (Quickstart V8).
- [ ] T062 Converge: check off completed tasks, run the spec-kit converge command, and list any remaining gaps in `specs/001-model-radar-dashboard/tasks.md`.

---

## Dependencies

```text
Phase 1 (T001–T006)
        │
        ▼
Phase 2 (T007–T020)  ── data + pipeline
        │
        ▼
Phase 2b (T021–T024) ── design system + themes
        │
        ├──► US1 (T025–T032) ── MVP
        │          │
        │          ▼
        │      US2 (T033–T037) ── needs table + dataset
        │
        ├──► US3 (T038–T042) ── needs dataset + frontier lib
        ├──► US4 (T043–T046) ── needs recommendations in dataset + detail deep link
        ├──► US5 (T047–T050) ── needs changes.json + change tests
        └──► US6 (T051–T056) ── needs staleness + all views for methodology links
                   │
                   ▼
             Phase 9 (T057–T062)
```

- US1 is the hard prerequisite for US2 and US4 (table row activation).
- US3, US5, and US6 can proceed in parallel once Phase 2b is complete.
- Phase 9 starts only when US1–US6 are demonstrably passing.

## Parallel Execution Examples

**Phase 2 (after T007 types land)**:

```text
T008 format      ─┐
T009 privacy     ─┤
T010 filters     ─┼─► T020 tests
T011 pareto      ─┤
T012 recommend   ─┘

T013 opencode ──► T015 dataset ──► T016 validator ──► T017 orchestrator
T014 AA       ──┘
```

**Phase 2b**:

```text
T021 tokens ─► T022 theme state ─► T023 toggle ─┐
T024 fonts  ────────────────────────────────────┴─► T025 shell
```

**US1**:

```text
T026 StatsBar ─────┐
T027 PrivacyBadge ─┼─► T029 ModelTable ─► T030 CatalogView ─► T032 verify
T028 FilterBar ────┘
```

**US3**: T038 ValueChart and T039 DataTable in parallel, then T040 ValueView.

## Implementation Strategy

1. **MVP** = Phase 1 + Phase 2 + Phase 2b + US1 + US2 (T001–T037). This delivers
   the full catalog, detail panel, and OpenCode visual system, which is the core
   user value.
2. **Increment 2** = US3 + US4 (value + picks). This is the decision layer.
3. **Increment 3** = US5 + US6 (changes + trust). This makes it maintainable.
4. **Release** = Phase 9, including the failure drills and the Cloudflare Pages
   connection.

Commit after each phase. Do not start a phase until the previous checkpoint
passes its quickstart scenario.
