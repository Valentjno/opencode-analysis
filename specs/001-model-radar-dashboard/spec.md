# Feature Specification: OpenCode Model Radar

**Feature Branch**: `001-model-radar-dashboard`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "A public, always-free dashboard that refreshes every 12 hours from OpenCode Go + OpenCode free model catalogs, joins them with Artificial Analysis benchmarks, and shows intelligence versus cost/allowance with daily model recommendations. Only Go and free models. Viewable model details, privacy-aware picks, Pareto analysis, and a change log. Hosted free at opencode-analysis.pages.dev, deployed from GitHub on push."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse every Go and free model (Priority: P1)

An OpenCode user opens the dashboard to see which models their Go plan or the
free tier actually includes. They scan one table containing every Go model and
every free model, with the Artificial Analysis Intelligence Index, blended
price, context window, Go monthly allowance, and privacy posture visible at a
glance. They can filter by access, vendor, privacy, and rating status, search by
name, and sort any column. Models without a published AA score remain visible
and are clearly labeled "Not rated".

**Why this priority**: This is the core answer to "what can I use, and how good
is it?" Without it the rest of the dashboard has nothing to stand on.

**Independent Test**: Load the deployed site with a generated dataset, apply a
vendor filter and a privacy filter, sort by intelligence, and confirm that every
Go/free model in the dataset is represented exactly once and that unrated models
are present and labeled.

**Acceptance Scenarios**:

1. **Given** a fresh dataset, **When** the page loads, **Then** the table shows
   every model whose access is Go or free, and no paid-only model.
2. **Given** a model with no Artificial Analysis rating, **When** it is shown,
   **Then** its score cell reads "Not rated" and it is sorted last by score.
3. **Given** the search field, **When** the user types a model or vendor name,
   **Then** only matching rows remain and the result count updates.
4. **Given** the access filter set to "Free", **When** applied, **Then** only
   free models remain and Go-only models disappear.
5. **Given** a narrow phone screen, **When** the table is viewed, **Then** the
   primary columns remain readable without horizontal page scrolling.

---

### User Story 2 - Inspect a model in detail (Priority: P1)

The user taps a row to open a detail panel for that model. It shows the full
Artificial Analysis breakdown (domain indexes and individual evaluation scores),
price per million tokens, context and output limits, modalities, Go allowances
for Go / Go Plus / Teams, estimated requests per 5 hours, privacy terms with an
explanation, and outbound links to the OpenCode console and the AA model page.

**Why this priority**: The user asked to be able to "see it" — a row of summary
numbers is not enough to trust a recommendation. The sources must be one click
away.

**Independent Test**: Open any rated model's detail panel and verify that every
field matches the published dataset, that missing fields say "Not published",
and that both outbound links resolve to the correct pages.

**Acceptance Scenarios**:

1. **Given** a rated model, **When** its detail opens, **Then** the Intelligence
   Index, domain indexes, and available evaluation scores are shown with values.
2. **Given** a model with unknown privacy terms, **When** its detail opens,
   **Then** privacy reads "Not documented" with a caution, never "Private".
3. **Given** the detail panel is open, **When** the user presses Escape or the
   close control, **Then** the panel closes and focus returns to its row.

---

### User Story 3 - See what intelligence costs (Priority: P2)

The user opens the Value view to understand the trade-off between model quality
and what it consumes. A scatter chart plots Intelligence Index against blended
price per million tokens, with the Pareto frontier highlighted. A second view
compares Intelligence Index against Go monthly allowance, so the user can see
which models give the most capability for the allowance they consume. Every
point is labeled, and the chart has a textual table equivalent.

**Why this priority**: The comparison only becomes a decision aid when quality
and cost share an axis. It is the feature that distinguishes this from the
official catalog.

**Independent Test**: With a dataset containing at least three rated models,
confirm that the frontier contains only non-dominated models (no other model is
both cheaper and smarter), that unrated models are excluded with an explanatory
note, and that the table lists the same values as the chart.

**Acceptance Scenarios**:

1. **Given** rated models with prices, **When** the Value view opens, **Then**
   each appears as a labeled point and the Pareto frontier is visually distinct.
2. **Given** a model that is dominated on both intelligence and price, **When**
   the frontier is computed, **Then** that model is not on the frontier.
3. **Given** a model with an unlimited or unknown allowance, **When** the
   allowance view renders, **Then** it is marked "unlimited" and excluded from
   numeric ranking with an explanation.
4. **Given** the chart is not readable (screen reader or mobile), **When** the
   user requests the data table, **Then** the same values are available as text.

---

### User Story 4 - Get a daily recommendation (Priority: P2)

The user wants a short, opinionated answer for today: which model to use for a
complex task (a planner plus a cheaper builder), which for medium work, the
cheapest capable option, and the most private option that is still useful. Each
pick states the rule that produced it, the model's score and cost, and a caveat
when privacy terms are unknown. The picks change automatically as the catalog or
scores change.

**Why this priority**: This is the user's stated end goal — turning the catalog
into an actionable daily choice — but it depends on the catalog and value data.

**Independent Test**: Load the page and verify that all five recommendation slots
are filled when at least two rated models exist, that each card names a model
present in the dataset, and that changing the dataset changes the picks
deterministically.

**Acceptance Scenarios**:

1. **Given** rated models, **When** the page loads, **Then** the complex-task
   card shows a planner and a builder, and the builder is cheaper than the
   planner.
2. **Given** a model whose provider trains on requests, **When** it would
   otherwise win "most private", **Then** it is excluded and the next eligible
   model is chosen.
3. **Given** no model qualifies for a slot, **When** the card renders, **Then**
   it explains why instead of showing an empty card.
4. **Given** the user returns the next day, **When** data has been refreshed,
   **Then** the picks reflect the new dataset without any user action.

---

### User Story 5 - Understand what changed (Priority: P3)

The user checks a "Changes" view to see what the last refreshes brought: new
models, removed models, price changes, score changes, allowance changes, privacy
changes, and models that became free. Each entry has a timestamp and a readable
sentence, newest first.

**Why this priority**: The catalog changes often (free models appear and
disappear), and a change log makes the automation trustworthy. It is valuable
but not required for the first useful version.

**Independent Test**: Compare two generated datasets and confirm that each
difference produces exactly one event, that no-change runs produce no events,
and that the newest event appears first.

**Acceptance Scenarios**:

1. **Given** a model added since the previous snapshot, **When** changes render,
   **Then** an "added" entry names it and its access tier.
2. **Given** a model whose price changed, **When** changes render, **Then** the
   entry shows both the old and new price.
3. **Given** a refresh with no differences, **When** changes render, **Then**
   the view states that nothing changed rather than showing stale events as new.

---

### User Story 6 - Trust the data and its sources (Priority: P3)

The user wants to know when the data was refreshed, where each number came from,
and how the recommendations are computed. The page footer shows the last
successful refresh time, flags data older than 13 hours, credits Artificial
Analysis and OpenCode with links, states that the project is independent and
MIT-licensed, and links to a methodology page explaining the scoring and picking
rules.

**Why this priority**: Attribution and freshness are credibility requirements,
but the dashboard is still useful before the methodology page is polished.

**Independent Test**: Age the dataset timestamp past 13 hours and confirm the
staleness banner appears; open the methodology link and confirm it explains
every rule used by the recommendations and the Pareto calculation.

**Acceptance Scenarios**:

1. **Given** a dataset older than 13 hours, **When** the page loads, **Then** a
   visible banner states the age and that a refresh is due.
2. **Given** any AA-derived number, **When** the user follows its source link,
   **Then** the AA model page opens in a new tab.
3. **Given** the footer, **When** read, **Then** it names OpenCode and Artificial
   Analysis, links both, and states the project is not affiliated with either.

### Edge Cases

- An AA model page returns 404 or changes structure: the model remains listed
  with its last known score marked "stale"; a model never rated shows "Not
  rated". The refresh still succeeds for every other model.
- The AA sitemap is unreachable: fall back to the curated alias map and keep the
  previous scores; record the degraded source state in the dataset.
- A free model has no documented privacy terms: show "Not documented" as a
  distinct amber state; never count it as private in recommendations.
- A model is both Go and free: show both badges once and compute its cost using
  the Go price, with the free status noted.
- A Go allowance is unlimited or blank: show "∞" or "—" and exclude it from
  numeric allowance ranking.
- The entire upstream fetch fails: keep the previous dataset untouched, do not
  overwrite it with an empty file, and let the site continue serving the last
  good snapshot.
- Two consecutive refreshes produce identical data: no commit, no new change
  events, deployment untouched.
- A model is renamed upstream: it appears as one removed and one added entry
  rather than silently changing identity.
- The dataset has fewer than two rated models: recommendation cards explain the
  insufficient sample instead of inventing a pick.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST publish only models that are in the OpenCode Go
  catalog or are free on OpenCode; paid-only Console models MUST NOT appear.
- **FR-002**: The system MUST refresh its dataset automatically at most every 12
  hours and at least once every 13 hours while the repository is active.
- **FR-003**: The dataset MUST record a generation timestamp, the source URLs,
  and a per-model mapping status for Artificial Analysis.
- **FR-004**: The system MUST display the Intelligence Index for every model
  that AA publishes and MUST label every other model "Not rated".
- **FR-005**: The system MUST display blended price per million tokens, Go
  monthly allowance, and estimated requests per 5 hours when published.
- **FR-006**: The system MUST display a privacy classification derived from
  OpenCode's published flags or documentation, including training use, zero
  retention, retention days, and regional limits; unknown values MUST read "Not
  documented".
- **FR-007**: Users MUST be able to filter by access (Go, Free, both), vendor,
  privacy class, and rating status, and to search by model or vendor name.
- **FR-008**: Users MUST be able to sort the catalog by intelligence, price,
  allowance, context, vendor, and name, in both directions.
- **FR-009**: Users MUST be able to open a detail view for every model, including
  unrated models, without leaving the page.
- **FR-010**: The detail view MUST show all published AA domain indexes and
  evaluation scores, or an explicit "Not published" state for each section.
- **FR-011**: The system MUST compute and display a Pareto frontier of
  intelligence versus blended price over rated models.
- **FR-012**: The system MUST provide a second value comparison of intelligence
  versus Go monthly allowance.
- **FR-013**: Every chart MUST have an accessible textual equivalent containing
  the same data.
- **FR-014**: The system MUST generate daily recommendations for: best planner,
  best cheap builder, best medium-task model, cheapest capable model, and most
  private useful model.
- **FR-015**: Each recommendation MUST state the rule used, the model's score,
  its cost or allowance, and a privacy caveat when applicable.
- **FR-016**: Privacy-sensitive recommendations MUST exclude models that train
  on requests and MUST prefer zero-retention models; if no model qualifies, the
  card MUST say so.
- **FR-017**: The system MUST present a change feed of additions, removals,
  price changes, score changes, allowance changes, privacy changes, and
  free-status changes, newest first.
- **FR-018**: The change feed MUST NOT duplicate events across refreshes and
  MUST cap retained history at a documented limit.
- **FR-019**: The system MUST show the last successful refresh time and MUST
  warn when the dataset is older than 13 hours.
- **FR-020**: The system MUST credit Artificial Analysis and OpenCode with
  outbound links, state its independence, and link to a methodology explanation.
- **FR-021**: The system MUST remain fully usable as a static site with no
  account, cookie, analytics, or server-side processing.
- **FR-022**: The system MUST tolerate partial upstream failure without
  discarding the last known good model data.
- **FR-023**: The system MUST NOT publish API keys, tokens, or personal data in
  the repository or the built site.
- **FR-024**: The system MUST keep the published dataset backwards compatible
  within a schema version and MUST expose the version in the file.
- **FR-025**: The interface MUST adopt OpenCode's published visual language:
  monospace-forward labels and numbers, Inter-style body text, thin neutral
  borders, sharp 3–8 px corners, bracket notation (for example `[01]`), and the
  OpenCode blue accent.
- **FR-026**: The system MUST offer both a dark theme (default, matching
  OpenCode's `#0c0c0c` palette) and a light theme (matching its `#fbfbfb`
  palette), switchable at any time, with the choice remembered locally and no
  flash of the wrong theme on load.

### Key Entities

- **Model**: A chat model offered by OpenCode. Attributes: identifier, display
  name, vendor, description, canonical upstream identifier, release date,
  context window, maximum output, modalities, capabilities, open-weights flag.
- **Access**: Whether the model is included in Go, free on OpenCode, or both,
  plus any regional restriction.
- **Price**: Input, output, cache-read, and blended cost per million tokens, in
  US dollars, as published by OpenCode.
- **Go Allowance**: Per-model monthly usage allowance for Go, Go Plus, and Go
  Teams, plus estimated requests per 5 hours for Go and Go Plus.
- **Privacy Profile**: Training use, zero-retention status, retention period,
  limited regions, source of the claim, and a human-readable note.
- **Benchmark Profile**: AA Intelligence Index, domain indexes, individual
  evaluation scores, output speed, time to first token, AA cost per task, and
  the AA page identifier.
- **Recommendation**: A named slot, the selected model, the rule that selected
  it, the supporting values, and an optional caveat.
- **Change Event**: Timestamp, type, model identity, human-readable message,
  and previous/next values where applicable.
- **Snapshot**: The generated dataset as a whole: schema version, generation
  time, source health, aggregate counts, models, and recommendations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Go and free models present in the upstream catalogs appear
  in the published dataset, and 0 paid-only models appear.
- **SC-002**: 100% of displayed intelligence, price, allowance, and privacy
  values can be traced to a recorded source within two clicks.
- **SC-003**: A first-time visitor can identify the best model for a complex task
  and its cost in under 60 seconds without reading documentation.
- **SC-004**: The primary catalog is readable and interactive on a 390 px wide
  screen with no horizontal page scrolling.
- **SC-005**: 100% of charts have a text equivalent with matching values.
- **SC-006**: The automated refresh completes within 15 minutes and updates the
  live site within 30 minutes of its scheduled start.
- **SC-007**: A push to the default branch deploys the site with zero manual
  steps and zero recurring cost.
- **SC-008**: A dataset older than 13 hours is visibly flagged on every page.
- **SC-009**: Every recommendation names a model that exists in the current
  dataset, or explicitly states that no eligible model exists.
- **SC-010**: The site loads its primary content in under 3 seconds on a
  simulated 4G connection and mid-range phone.
- **SC-011**: A reader familiar with OpenCode recognizes the same visual system,
  and both themes pass WCAG 2.1 AA contrast for text; switching themes changes
  every surface without a reload or a flash.

## Assumptions

- The audience is OpenCode users and maintainers evaluating Go/free models; no
  login or personalization is required in v1.
- The published dataset is public; no private account balance is included, and
  Go allowance is shown per model exactly as OpenCode publishes it.
- Artificial Analysis remains publicly readable without an API key; if that
  changes, the last good data remains served with a stale marker.
- "Free" means the OpenCode list price is $0 for both input and output at the
  time of refresh.
- The site is English-only in v1; the data model keeps vendor and model names
  verbatim.
- A 12-hour refresh cadence is sufficient; intraday live updates are out of
  scope.
- Historical trend charts beyond the change feed are out of scope for v1.
- The repository is public, hosted under the user's GitHub account, and
  deployed to a free static host; the exact provider may change without
  affecting this specification.
