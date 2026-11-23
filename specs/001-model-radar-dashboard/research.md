# Phase 0 Research: OpenCode Model Radar

**Feature**: 001-model-radar-dashboard | **Date**: 2026-11-23

All unknowns from the technical context are resolved below. Findings come from
live reconnaissance of the upstream endpoints and the existing refresher run.

## R1. Hosting and delivery

**Decision**: Cloudflare Pages, project name `opencode-analysis`, build command
`npm run build`, output directory `dist`, automatic production deploy on every
push to `main`. Public URL `https://opencode-analysis.pages.dev`.

**Rationale**: zero cost, global CDN, unlimited static requests, clean
`*.pages.dev` hostname (the user rejected the `github.io/<repo>` subpath), and
no server to operate. Cloudflare builds on push; the 12-hour data commit also
triggers a fresh deploy.

**Alternatives considered**: GitHub Pages (free but path-based URL, rejected);
Vercel/Netlify (equivalent but no advantage); Cloudflare Workers + Cron (needs a
Worker and secrets for commits, more moving parts).

**One-time manual step**: connect the GitHub repository to Cloudflare Pages in
the dashboard (authorize GitHub, pick repo, set build command/output). This
cannot be done from the repository alone; documented in the README.

## R2. Refresh orchestration

**Decision**: GitHub Actions workflow `refresh.yml` on `schedule: 0 */12 * * *`
and `workflow_dispatch`, Node 24, `npm ci`, `npm run refresh`, then commit
`public/data/` to `main` only if `git diff` shows a change. Use the built-in
`GITHUB_TOKEN` with `contents: write`; no PAT or secret.

**Rationale**: the schedule lives with the code, is free on public repositories,
and every refresh is auditable in the Actions log. Committing the data makes the
site a pure static artifact and keeps a Git history of catalog changes.

**Alternatives considered**: Cloudflare Cron Triggers (requires a Worker and a
GitHub token secret); client-side fetching from AA (CORS + rate limits + no
history); a database (violates the free/serverless principle).

**Caveat**: GitHub schedules can be delayed by a few minutes under load; the UI
therefore treats data older than 13 hours as stale (R13).

## R3. Upstream data acquisition

**Decision**:

- Go catalog: `GET https://opencode.ai/inference/go/v1/models` (JSON).
- Full catalog: `GET https://opencode.ai/inference/v1/models` (JSON), used to
  find free models.
- Go allowances: `GET https://opencode.ai/console/go`, parsed with Cheerio from
  `tr[data-model]` rows and `[data-allowance-type]` cells.
- AA coverage: `GET https://artificialanalysis.ai/sitemap.xml` for model slugs,
  then `GET https://artificialanalysis.ai/models/<slug>` per mapped model.
- AA extraction: concatenate `self.__next_f.push([1,"…"])` RSC frames, locate
  `"initialModels":`, slice the balanced JSON array, and select the object whose
  `slug` matches the page. Prefer an object with a numeric `intelligenceIndex`.

**Rationale**: the OpenCode JSON is stable and documented by use; the Go page is
the only source for estimated requests per 5 hours; AA's legacy API returns 410
Gone and its replacement needs a key, while the RSC payload is complete and
public. No headless browser is needed.

**Alternatives considered**: AA API key (registration + secret; rejected); DOM
scraping with Playwright (heavy, slow, brittle); regex on rendered HTML (the RSC
payload is more structured).

**Verified baseline**: 39 in-scope models (30 Go, 12 free, 3 both), 32 mapped to
AA slugs, 25 rated. Missing ratings are expected and rendered as "Not rated".

## R4. Catalog scope

**Decision**: include a model if it appears in the Go catalog, or if its input
and output prices are both exactly `0` in the full catalog. Exclude non-chat
entries (embeddings, image generation, `decision`/`jev-*` helpers). De-duplicate
by model id; a model in both sets gets both badges.

**Rationale**: matches the user's "only and exclusively the Go and free models"
constraint without hard-coding a model list, so new models appear automatically.
`qwen4-max-free` demonstrates why the API, not the docs table, is authoritative:
it exists in the catalog but not in the documentation list.

**Alternatives considered**: hard-coded allowlist (stale within days); scraping
the console table only (misses free models and structured pricing).

## R5. Model identity and AA mapping

**Decision**: resolve in this order: curated `data/aliases.json` → normalized id
→ normalized display name (parentheticals and `free`/`preview` removed) →
normalized `canonical_id` basename → no match. Matching is exact after
normalization; no fuzzy matching. Every model records `aaSlug` and `aaStatus`
(`rated`, `unrated`, `missing`, `stale`, `error`).

**Rationale**: free models frequently correspond to a paid twin (for example
`deepseek-v4.1-flash-free` → `deepseek-v4-1-flash-1017`) and need explicit
aliases. Fuzzy matching would create confident wrong comparisons, which violates
source fidelity.

**Alternatives considered**: title similarity (risk of false positives); AA
search page scraping (extra request, same ambiguity).

## R6. AA extraction details

**Decision**: extract `intelligenceIndex`, six domain capabilities (finance,
strategy/ops, legal, healthcare, engineering, economics), the curated evaluation
score map, context window, output speed, time to first token, cost per task, AA
price, and open-weights flag. Choose the matching `initialModels` object with the
highest score preference: has intelligence index → not deprecated → chart
default → newest. Store the AA URL per model.

**Rationale**: a model page embeds both the default 28-model leaderboard and the
page's own model; taking `arr[0]` yields the wrong model. The preference rule
was validated against sampled pages.

**Alternatives considered**: parse the visible DOM (numbers are duplicated and
abbreviated); use the comparison page (only selected models).

## R7. Recommendation rules (deterministic, documented)

**Decision**: compute at refresh time and store in the dataset. Universe = models
with a numeric Intelligence Index (II). Constants live in `recommend.mjs` and are
reproduced on the methodology page.

| Slot | Rule |
|------|------|
| Best planner | Highest II overall; tie → lower blended price → id |
| Best cheap builder | Models cheaper than the planner and within 10 II points of it; highest `II / (1 + blendedPrice)`; tie → higher II |
| Best medium task | Highest II among models at or below the median blended price of rated models; tie → lower price |
| Cheapest capable | Lowest blended price among models with II ≥ 25; tie → higher II |
| Most private | `training === false && zdr === true && II ≥ 30`; highest II; tie → lower price. If none, relax to `training === false` with a "not zero-retention" caveat; if still none, return no pick with an explanation |

Every pick carries the rule label and a caveat when `training` is true or
unknown. If fewer than two rated models exist, cards explain the insufficient
sample.

**Rationale**: each rule is a sentence a reader can verify, uses only published
values, and has deterministic tie-breaks. The privacy slot directly implements
the user's distinction between Gemini 4 Argon (no training, not ZDR) and Muse
Spark (training on requests).

**Alternatives considered**: a weighted composite score (opaque, easy to game);
LLM-generated picks (non-deterministic, unreproducible, costs money).

## R8. Pareto frontier

**Decision**: for the price view, a model is dominated when another rated model
has II ≥ and blended price ≤, with at least one strict inequality. The frontier
is the non-dominated set, sorted by price. For the Go allowance view, dominance
is II ≥ and monthly Go allowance ≥ (higher allowance is better); unlimited
allowances are shown separately and excluded from the numeric frontier.

**Rationale**: this is the standard definition, matches the user's "real
credits/usage affordable vs intelligence" ask, and is testable with small
fixtures.

**Alternatives considered**: score-per-dollar only (hides the frontier shape);
include unrated models (impossible without a y-value).

## R9. Privacy model

**Decision**: four tiers — `private` (no training + zero retention), `no-training`
(no training, retention/ZDR unclear), `unknown` (either flag undocumented), and
`trains` (training on requests). Go models use the structured `go.training` and
`go.zdr` flags. Free models use a curated, dated map in
`data/free-privacy.json`, built from the OpenCode privacy documentation. Unknown
is never treated as private.

**Rationale**: the structured Go flags are authoritative; free models often lack
them, and the docs list exceptions in prose. A curated map is auditable and can
be updated in one place when the docs change.

**Alternatives considered**: assume all free models are private (dangerously
wrong); parse prose at runtime (brittle, and the docs change wording).

## R10. Data contract and validation

**Decision**: JSON Schema draft 2020-12 for `latest.json` and `changes.json`,
validated by Ajv (dev-only) plus hand-written invariants in
`scripts/validate-data.mjs`: counts match `stats`, ids are unique, every
recommendation references an existing model, every rated model has a numeric II,
prices are non-negative, no paid-only models, and `schemaVersion` is supported.
CI and the refresh both run the validator before writing/publishing.

**Rationale**: the dataset is the product; a malformed file should fail the build
rather than render nonsense. Ajv is build-time only and does not affect the
bundle.

**Alternatives considered**: runtime Zod validation (adds bundle weight);
TypeScript-only types (erased at runtime, cannot validate committed JSON).

## R11. Routing and deep links

**Decision**: hash-based views (`#catalog`, `#value`, `#changes`, `#about`) and
`#model=<id>` for the detail panel. No router dependency, no server rewrite
rules.

**Rationale**: hash URLs work on any static host, survive refreshes, and let a
user share a specific model or view.

## R12. Charts and accessibility

**Decision**: Recharts scatter plots, lazy-loaded with `React.lazy` so the
catalog's initial bundle stays small. Points use shape + label as well as color.
A "Show data table" disclosure renders the same series as an accessible table.
The catalog itself is a real `<table>` with sortable headers.

**Rationale**: satisfies SC-005 and keeps the initial route fast; avoids adding
a second charting library.

## R13. Freshness and failure handling

**Decision**: `generatedAt` drives a staleness banner at >13 hours. The two
OpenCode catalogs are mandatory: if either fails, the run exits non-zero without
writing, preserving the last good dataset. The Go page and AA sitemap are
optional: missing allowances become `null`, and missing scores fall back to the
previous value marked `stale`, then `missing`. AA page failures are isolated per
model. The workflow never commits an empty or partial file.

**Rationale**: a stale dashboard is acceptable if labeled; a blank or fabricated
one is not. This also keeps the scheduled job green when AA rate-limits a single
page.

## R14. Schema versioning

**Decision**: `schemaVersion: 1`. Additive optional fields stay within version 1;
removing or renaming a field requires a version bump and a UI guard that shows an
explicit incompatibility message.

**Rationale**: the static site and the committed data can briefly diverge during
a deploy; the guard prevents a white screen.

## R15. Testing strategy

**Decision**: Vitest (node environment) for `pareto`, `recommend`, `filters`, and
`format`; fixture datasets for edge cases (unlimited allowance, unknown privacy,
zero rated models). `scripts/validate-data.mjs` is exercised against the real
generated dataset in CI.

**Rationale**: the risky logic is arithmetic and selection, not rendering; unit
tests cover it cheaply. No E2E framework in v1 — the quickstart provides manual
end-to-end checks.

## R16. Licensing, attribution, and independence

**Decision**: MIT for the code. The README and footer credit OpenCode and
Artificial Analysis with links, state that the project is independent and not
affiliated with either, and explain that AA data is used under its public
publishing terms. The repository is public under the user's GitHub account.

**Rationale**: required by the constitution and by basic data ethics; also what
the user explicitly requested ("license free and contribution to artificial
analysis, explicit that is a view for the opencode developers").

## R17. CI/CD pipeline

**Decision**: `ci.yml` on pull requests and pushes runs `npm ci`, `npm run lint`,
`npm test`, `npm run validate`, `npm run build`. `refresh.yml` runs the refresher
on schedule/manual, validates, commits only `public/data/`, and lets Cloudflare
Pages deploy. Both use Node 24 and npm caching; refresh has a 30-minute timeout
and a concurrency group.

**Rationale**: every merge is checked, every data change is validated, and no
workflow needs a secret beyond the default token.

## R18. Live balance

**Decision**: out of scope. Only per-model published allowances are shown. No
account credentials, session cookies, or undocumented billing endpoints are
used.

**Rationale**: the user chose "Go allowance only"; there is no documented balance
API, and storing a console session would violate the no-secrets principle.

## R19. OpenCode visual system and themes

**Decision**: extract the live tokens from `https://opencode.ai/_build/assets/shell-D8x4Q6q5.css`
and `home-B2nwsUqQ.css` and encode them as CSS custom properties with a
`data-theme="light|dark"` override. Default follows the system; a three-state
control (system / light / dark) persists one key (`oar-theme`) and an inline
head script applies it before first paint.

Verified palette (dark → light):

| Role | Dark | Light |
|------|------|-------|
| Canvas | `#0c0c0c` | `#fbfbfb` |
| Surface | `#161616` | `#ffffff` |
| Raised | `#1a1a1a` | `#f5f5f5` |
| Border | `#2e2e2e` | `#e0e0e0` |
| Border strong | `#4b4b4b` | `#d2d2d2` |
| Text | `#fafafa` | `#161616` |
| Secondary | `#aeaeae` | `#5c5c5c` |
| Muted | `#8f8f8f` | `#6b6b6b` |
| Accent | `#4f8bff` | `#3b5cf6` |
| Success | `#54d483` | `#239f50` |
| Warning | `#f4b434` | `#eb980a` |
| Danger | `#ed5a5a` | `#db2424` |

Typography: body Inter (OpenCode's `--font-sans`), labels/numbers OpenTUI Mono.
OpenTUI Mono is served by OpenCode and has no clear redistribution license, so
the app self-hosts **JetBrains Mono** (OFL) as the closest terminal-mono stand-in
and keeps `ui-monospace` as fallback. Inter is self-hosted via Fontsource; no
Google Fonts request, no third-party script.

Shape and rhythm: radii 3/5/8 px, 1 px rules, 13 px uppercase meta labels,
`[01]` section indices, 24 px page gutter, 76 px header, 8 px grid gaps. Buttons
are outlined or solid ink, never pill-shaped. Charts use the same blue accent
plus success/warning/danger only for semantic states.

**Rationale**: the user explicitly asked the site to look like OpenCode and to
offer a light view. Copying the token values (not the font binaries or logo
paths) gives immediate recognition while keeping the project independent and
license-clean.

**Alternatives considered**: approximate Tailwind palette (not faithful);
Google Fonts (third-party request, privacy leak); bundled OpenTUI Mono (unclear
license); dark-only (user explicitly requested light).
