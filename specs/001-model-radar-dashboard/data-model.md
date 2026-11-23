# Phase 1 Data Model: OpenCode Model Radar

**Feature**: 001-model-radar-dashboard | **Date**: 2026-11-23

The published dataset is the product. This document defines every field, its
units, its null semantics, and the invariants enforced by
`scripts/validate-data.mjs`. JSON Schema files live in
[`contracts/`](./contracts/).

## Conventions

- **Units**: money is US dollars; prices are per 1,000,000 tokens; context and
  output limits are tokens; speeds are tokens/second; time to first token is
  seconds; dates are ISO 8601 (`YYYY-MM-DD`); timestamps are ISO 8601 UTC
  (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- **Null means "not published"**, never zero or unknown-as-safe. The UI renders
  null score as "Not rated", null price as "—", null privacy as "Not
  documented".
- **Unknown extra fields** are allowed by the schema for forward compatibility
  within `schemaVersion: 1`; consumers ignore them.
- **Identity**: `id` is the OpenCode model id and is unique within a snapshot.
  `aaSlug` is the Artificial Analysis page slug, or null.

## Snapshot (`latest.json`)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `schemaVersion` | integer | must be `1` | Breaking changes bump this |
| `generatedAt` | string (date-time) | required | Start time of the refresh run |
| `plans` | object | required | `go` and `goPlus` names/prices as published |
| `sources` | object | required | Health of each upstream (below) |
| `stats` | object | required | Aggregate counts, validated against models |
| `recommendations` | object | required | Five slots, each `Recommendation` or `null` |
| `models` | array of Model | required, unique ids | Sorted by II desc, then name |

### `plans`

```json
{ "go": { "name": "Go", "price": 10 }, "goPlus": { "name": "Go Plus", "price": 40 } }
```

The prices are display labels from the public plans; they are not used in any
computation.

### `sources`

| Key | Fields | Meaning |
|-----|--------|---------|
| `opencodeGo` | `url`, `ok`, `count` | Go catalog JSON |
| `opencodeAll` | `url`, `ok`, `count` | Full catalog JSON |
| `goPage` | `url`, `ok`, `rows` | Console allowances scrape |
| `artificialAnalysis` | `url`, `ok`, `sitemapSlugs`, `matched`, `rated` | AA coverage |

`ok` is false when the source failed or returned an unusable payload. The two
OpenCode catalogs are mandatory: a run with either `ok: false` must not write a
dataset.

### `stats`

| Field | Type | Invariant |
|-------|------|-----------|
| `total` | integer | `= models.length` |
| `go` | integer | `= count(access.go)` |
| `free` | integer | `= count(access.free)` |
| `both` | integer | `= count(access.go && access.free)` |
| `rated` | integer | `= count(aa.intelligenceIndex !== null)` |
| `unrated` | integer | `= total - rated` |
| `private` | integer | `= count(privacy.training === false && privacy.zdr === true)` |
| `trains` | integer | `= count(privacy.training === true)` |
| `limitedRegions` | integer | `= count(access.limitedRegions)` |

## Model

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | string | unique, non-empty | OpenCode id |
| `name` | string | non-empty | Display name |
| `canonicalId` | string \| null | | Upstream canonical id |
| `vendor` | string | non-empty | Normalized vendor label |
| `description` | string | | May be empty |
| `family` | string \| null | | |
| `openWeights` | boolean | | From OpenCode catalog |
| `releaseDate` | string \| null | date | |
| `lastUpdated` | string \| null | date | |
| `knowledge` | string \| null | | Training cutoff label |
| `access` | Access | required | |
| `pricing` | Pricing | required | |
| `context` | integer \| null | ≥ 0 | Tokens |
| `maxOutput` | integer \| null | ≥ 0 | Tokens |
| `modalities` | object \| null | | `{ input: string[], output: string[] }` |
| `capabilities` | object \| null | | Raw OpenCode capability flags |
| `go` | GoAccess \| null | null for free-only | |
| `privacy` | Privacy | required | Never null |
| `aaSlug` | string \| null | | AA page slug |
| `aa` | AAProfile \| null | null when unmapped | |
| `aaStatus` | enum | `rated`, `unrated`, `missing`, `stale`, `error` | |

### `access`

| Field | Type | Notes |
|-------|------|-------|
| `go` | boolean | In the Go catalog |
| `free` | boolean | Input and output price both 0 |
| `limitedRegions` | boolean | From Go `limited_regions` |

At least one of `go` or `free` MUST be true. Paid-only models MUST NOT appear.

### `pricing`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `input` | number \| null | ≥ 0 | $/1M input tokens |
| `output` | number \| null | ≥ 0 | $/1M output tokens |
| `cacheRead` | number \| null | ≥ 0 | $/1M cached input tokens |
| `blended` | number \| null | ≥ 0 | `(3 × input + output) / 4`, rounded to 4 dp |

`free` is true only when `input === 0 && output === 0`. A null price is not free.

### `go`

| Field | Type | Notes |
|-------|------|-------|
| `monthly.go` | number \| null | Included $ usage per month on Go |
| `monthly.goPlus` | number \| null | Go Plus |
| `monthly.goTeams` | number \| null | Go Teams |
| `requests5h.go` | number \| null | Estimated requests / 5 h |
| `requests5h.goPlus` | number \| null | |
| `requests5h.goUnlimited` | boolean | True when the page shows ∞ |
| `requests5h.goPlusUnlimited` | boolean | |
| `featured` | boolean | Highlighted by OpenCode |

A null with `unlimited: false` means "not published"; the UI shows "—". A true
unlimited flag shows "∞" and excludes the model from numeric allowance ranking.

### `privacy`

| Field | Type | Notes |
|-------|------|-------|
| `training` | boolean \| null | `null` = not documented |
| `zdr` | boolean \| null | Zero data retention |
| `retentionDays` | integer \| null | `0` when ZDR is true; null if not stated |
| `limitedRegions` | boolean | |
| `source` | string | `OpenCode Go model API`, `OpenCode privacy documentation`, or `Not documented` |
| `note` | string | Human-readable explanation shown in the detail panel |

Tier derivation (implemented once, shared by UI and recommendations):

| Tier | Condition |
|------|-----------|
| `private` | `training === false && zdr === true` |
| `no-training` | `training === false && zdr !== true` |
| `trains` | `training === true` |
| `unknown` | `training === null` (regardless of `zdr`) |

## AAProfile

| Field | Type | Notes |
|-------|------|-------|
| `slug` | string | AA page slug |
| `url` | string (uri) | Canonical page |
| `variant` | string | Display variant, e.g. "… (Max)" |
| `suffix` | string \| null | Reasoning effort suffix |
| `effort` | string \| null | |
| `releaseDate` | string \| null | |
| `deprecated` | boolean | |
| `deprecatedTo` | string \| null | |
| `intelligenceIndex` | number \| null | 0–100; null = unrated |
| `capabilities` | object<string, number> | Six domain indexes; empty if none |
| `evals` | object<string, number> | Named evaluation scores; empty if none |
| `omniscience` | number \| null | Relative index; can be negative |
| `contextWindow` | integer \| null | |
| `outputSpeed` | number \| null | tokens/s |
| `timeToFirstToken` | number \| null | seconds |
| `costPerTask` | number \| null | USD |
| `aaPrice` | `{ input, output }` \| null | AA's published $/1M tokens |
| `isOpenWeights` | boolean | |

## Recommendation

| Field | Type | Notes |
|-------|------|-------|
| `slot` | enum | `planner`, `builder`, `medium`, `cheapest`, `private` |
| `title` | string | Display label |
| `modelId` | string \| null | Must exist in `models` when non-null |
| `rule` | string | One-sentence rule used |
| `reason` | string | Values that justify the pick |
| `caveat` | string \| null | Privacy or sample-size warning |
| `intelligenceIndex` | number \| null | Copied for display |
| `blendedPrice` | number \| null | Copied for display |
| `monthlyGo` | number \| null | Copied for display |

A slot with `modelId: null` MUST have a `reason` explaining why no model
qualified (e.g. "No model has no-training privacy terms and a score ≥ 30").

## ChangeEvent (`changes.json`)

| Field | Type | Notes |
|-------|------|-------|
| `at` | string (date-time) | Refresh timestamp |
| `type` | enum | `added`, `removed`, `price`, `access`, `allowance`, `requests`, `privacy`, `score`, `rated`, `unrated` |
| `id` | string | Model id |
| `name` | string | Display name at event time |
| `message` | string | Human-readable sentence |
| `field` | string \| null | Machine field, when applicable |
| `from` | any \| null | Previous value |
| `to` | any \| null | New value |

File shape:

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-23T12:00:00.000Z",
  "baseline": false,
  "events": []
}
```

- `baseline` is true only for the first snapshot, when no comparison exists.
- `events` is newest-first and capped at 500.
- An event is emitted at most once per transition. A no-change run emits none.
- A rename appears as `removed` + `added`, not a silent identity change.

## Validation Rules

1. `schemaVersion === 1`; unknown top-level keys allowed.
2. `models` non-empty, ids unique, at least one of `access.go` / `access.free`.
3. No model with both prices > 0 and `access.go === false`.
4. Every numeric field is finite and within range (prices ≥ 0, II 0–100,
   context ≥ 0).
5. `stats` exactly matches the models array.
6. `recommendations` has exactly the five slots; each non-null `modelId` exists.
7. Every `aaStatus === "rated"` model has a numeric `aa.intelligenceIndex`;
   `unrated`/`missing` have null aa or null II.
8. `sources.opencodeGo.ok` and `sources.opencodeAll.ok` are true in any written
   snapshot.
9. `changes.events.length <= 500`, timestamps non-increasing.
10. `generatedAt` parses as a valid date and is not in the future by more than
    five minutes.

## Example (abridged)

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-23T12:00:00.000Z",
  "plans": { "go": { "name": "Go", "price": 10 }, "goPlus": { "name": "Go Plus", "price": 40 } },
  "sources": {
    "opencodeGo": { "url": "https://opencode.ai/inference/go/v1/models", "ok": true, "count": 30 },
    "opencodeAll": { "url": "https://opencode.ai/inference/v1/models", "ok": true, "count": 83 },
    "goPage": { "url": "https://opencode.ai/console/go", "ok": true, "rows": 31 },
    "artificialAnalysis": { "url": "https://artificialanalysis.ai/", "ok": true, "sitemapSlugs": 543, "matched": 32, "rated": 25 }
  },
  "stats": { "total": 39, "go": 30, "free": 12, "both": 3, "rated": 25, "unrated": 14, "private": 23, "trains": 9, "limitedRegions": 3 },
  "recommendations": {
    "planner": { "slot": "planner", "title": "Best planner", "modelId": "gemini-4-argon", "rule": "Highest Intelligence Index overall.", "reason": "II 50.4 · $4.00/M blended", "caveat": "No zero-retention guarantee.", "intelligenceIndex": 50.41, "blendedPrice": 4, "monthlyGo": 15 },
    "builder": { "slot": "builder", "title": "Best cheap builder", "modelId": "deepseek-v4.1-flash", "rule": "Highest II per dollar within 10 points of the planner.", "reason": "II 32.6 · $0.26/M blended", "caveat": null, "intelligenceIndex": 32.59, "blendedPrice": 0.2625, "monthlyGo": 100 },
    "medium": { "slot": "medium", "title": "Best medium task", "modelId": "kimi-k3.1-pro", "rule": "Highest II at or below the median blended price.", "reason": "II 46.5 · $4.00/M blended", "caveat": null, "intelligenceIndex": 46.45, "blendedPrice": 4, "monthlyGo": 20 },
    "cheapest": { "slot": "cheapest", "title": "Cheapest capable", "modelId": "muse-spark-1.3-contributor", "rule": "Lowest price with II ≥ 25.", "reason": "II 36.6 · $0.13/M blended", "caveat": "Lab trains on requests.", "intelligenceIndex": 36.62, "blendedPrice": 0.125, "monthlyGo": 60 },
    "private": { "slot": "private", "title": "Most private", "modelId": "deepseek-v4.1-flash", "rule": "No training + zero retention with II ≥ 30.", "reason": "II 32.6 · $0.26/M blended", "caveat": null, "intelligenceIndex": 32.59, "blendedPrice": 0.2625, "monthlyGo": 100 }
  },
  "models": []
}
```

The values above illustrate shape, not a fixed recommendation.
