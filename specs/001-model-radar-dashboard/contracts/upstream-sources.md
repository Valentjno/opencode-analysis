# Upstream Sources Contract

**Feature**: 001-model-radar-dashboard · **Verified**: 2026-11-23

This document records every external source the refresher depends on, what is
extracted, and how failure is handled. It is the audit trail behind Principle II
(Source Fidelity & Attribution).

## 1. OpenCode Go catalog (mandatory)

`GET https://opencode.ai/inference/go/v1/models`

Response shape: `{ "data": [Model, …] }`.

Extracted per model:

| Upstream field | Dataset field |
|----------------|---------------|
| `id` | `id` |
| `name` | `name` |
| `canonical_id` | `canonicalId` |
| `owned_by` | fallback vendor |
| `description`, `family`, `open_weights` | same names |
| `release_date`, `last_updated`, `knowledge` | same names |
| `limit.context`, `limit.output` | `context`, `maxOutput` |
| `modalities` | `modalities` |
| `capabilities` | `capabilities` |
| `cost.text.input.price`, `cost.text.output.price`, `cost.text.input.cache.read` | `pricing.*` |
| `go.monthly_usage.go`, `['go-plus']`, `['go-teams']` | `go.monthly.*` |
| `go.training`, `go.zdr` | `privacy.training`, `privacy.zdr` |
| `go.limited_regions` | `access.limitedRegions`, `privacy.limitedRegions` |
| `go.featured` | `go.featured` |

Failure: abort the run, do not write. The previous dataset remains live.

## 2. OpenCode full catalog (mandatory)

`GET https://opencode.ai/inference/v1/models`

Same model shape, all Console models. Used only to discover free models: a model
is free when both `cost.text.input.price === 0` and
`cost.text.output.price === 0`. Non-chat entries (`type !== "chat"`) and
embedding/image/decision helpers are excluded. Models already in the Go catalog
are merged by id.

Failure: abort the run, do not write.

## 3. OpenCode Go console page (optional)

`GET https://opencode.ai/console/go`

HTML table rows: `tr[data-model]`. Within each row:

- `td[data-allowance-type="requests"] [data-layer="allowance"][data-plan]`
- `td[data-allowance-type="usage"] [data-layer="allowance"][data-plan]`

The visible value is in `[data-layer="current-value"]`; `∞` means unlimited.
Plans are `go` and `go-plus`. 31 rows were present at verification.

Failure: `sources.goPage.ok = false`, all `requests5h` values become `null`, the
run continues. Monthly values still come from the Go catalog JSON.

## 4. Artificial Analysis sitemap (optional)

`GET https://artificialanalysis.ai/sitemap.xml`

Extract slugs from `<loc>https://artificialanalysis.ai/models/<slug></loc>`.
543 slugs at verification. Used to validate auto-matching; the curated alias map
works without it.

Failure: `sources.artificialAnalysis.ok = false`, only curated aliases are used,
previous AA values are preserved.

## 5. Artificial Analysis model page (optional, per model)

`GET https://artificialanalysis.ai/models/<slug>`

The page is a Next.js app. Data is embedded in:

```html
<script>self.__next_f.push([1,"…escaped JSON…"])</script>
```

Steps:

1. Concatenate all `self.__next_f.push([1,"…"])` payloads (JSON-decode each
   string, then concatenate).
2. Find `"initialModels":` and slice the balanced `[...]` array.
3. Select the object whose `slug` (or `release.slug`) equals the page slug.
   Prefer an object with a numeric `intelligenceIndex`, then non-deprecated,
   then `chartDefaultSelected`.
4. Extract `intelligenceIndex`, `capabilities`, `scores`, `contextWindowTokens`,
   `outputSpeed`, `timeToFirstToken`, `intelligenceIndexCostPerTask`,
   `price1mInputTokens`, `price1mOutputTokens`, `isOpenWeights`.

Request policy: one request at a time per worker, concurrency 4, 250 ms pause
between pages, 60 s timeout, 2 retries with backoff, custom User-Agent naming
this project and its repository.

Failure per model: keep the previous `aa` object and mark `aaStatus: "stale"`; if
no previous value exists, `aaStatus: "missing"`. A 404 means the slug is wrong or
retired and is treated as missing.

**Important**: a model page also embeds the default 28-model leaderboard. Never
take `initialModels[0]`; always match the page slug.

## 6. OpenCode privacy documentation (curated, not fetched)

The docs at `https://opencode.ai/docs/zen/` describe exceptions in prose. The
structured Go API is authoritative for Go models; free models are captured in
`data/free-privacy.json` with a note and a review date. Unknown entries are
`null`, which the UI shows as "Not documented".

Failure mode: docs change without the map being updated. Mitigation: the map is
small, dated, reviewed when a model is added, and the source URL is linked from
the methodology page.

## 7. Attribution

- Artificial Analysis: link every AA-derived number to
  `https://artificialanalysis.ai/models/<slug>` and credit "Artificial Analysis
  Intelligence Index" in the footer and methodology page.
- OpenCode: link the catalog to `https://opencode.ai/console/go` and credit
  "OpenCode Go & free models".
- This project is independent and not affiliated with either.

## 8. Out of scope

- OpenCode account balance, billing, or session endpoints. No credentials.
- Paid-only Console models.
- AA's retired `/api/v2/data/llms/models` endpoint (HTTP 410).
- Any mutation of upstream services (read-only GETs only).
