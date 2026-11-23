# CI Benchmark Research Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 12-hour GitHub Actions research job that fills missing Artificial Analysis benchmarks with verified, cited external values, without exposing provider keys.

**Architecture:** A small Node pipeline reads the published snapshot, selects `(model, benchmark)` gaps, searches official sources, asks Free-LLM Router for two independent structured extractions, verifies the exact quote and agreement, and commits `public/data/research.json` separately from the AA dataset. The static site loads that file and shows external values in a distinct, labeled layer; picks and Pareto remain AA-only.

**Tech Stack:** Node 24, native `fetch`, Cheerio, Ajv, Vitest, React/TypeScript, Tailwind v4, GitHub Actions, Free-LLM Router pinned to `85864c4d0f29b74db442b296087862b96f4d84a1`.

**Spec:** `docs/superpowers/specs/2026-11-23-ci-benchmark-research-design.md` and `specs/001-model-radar-dashboard/contracts/dataset.schema.json`.

## Global Constraints

- Only models with **no numeric AA Intelligence Index** are eligible; rated models are never researched.
- Skip models without a canonical vendor identity: `big-pickle`, `iceman-contributor-free`, `iceman-free`, `tidepool-alpha-free`.
- Core benchmark set is exactly: `GPQA Diamond`, `Humanity's Last Exam`, `SciCode`, `Terminal-Bench 2.1`, `IFBench`, `Tau2`, `MMMU-Pro`, `FrontierCode 2.0`.
- Caps: 5 models per run, 3 benchmarks per model, 15 pairs per run, 3 fetched pages per benchmark, 10 search results.
- `verified` requires an exact quote naming model + benchmark + number, an allowed vendor-specific source, and agreement between two **different providers** (tolerance 0.05 for percentages, 0.1% relative for raw scores).
- `artificialanalysis.ai` is excluded as evidence for the external layer.
- No key, token, or secret may appear in the repo, logs, artifacts, committed JSON, or built bundle.
- Router code SHA is `85864c4d0f29b74db442b296087862b96f4d84a1`; catalog must be pinned and checksum-verified before the router starts.
- External values never enter recommendations, Pareto frontiers, or the AA Intelligence Index column.
- `data/research-overrides.json` is human-owned and must never be written by the job.

## Review Focus

| Input / condition | Expected behaviour | Test that pins it |
|---|---|---|
| Model with no canonical identity (Big Pickle) | Skipped, never researched | Task 2, `skips models without canonical vendor identity` |
| Page contains a number but not the model and benchmark names | `quote-mismatch`, not published | Task 5, `rejects a quote that lacks model or benchmark` |
| Only one provider configured | `single-source`, not published | Task 5, `requires two different providers` |
| Source URL redirects to a private IP or localhost | Rejected before fetch | Task 3, `blocks SSRF redirects` |
| Manual override exists for a pair | Override wins; generated entry cannot overwrite it; UI shows “Manual review” | Task 2 `preserves locked overrides` and Task 6 `shows manual badge` |

---

### Task 1: Research contract, benchmark registry, source registry, validator

**Files:**
- Create: `specs/001-model-radar-dashboard/contracts/research.schema.json`
- Create: `data/benchmarks-core.json`
- Create: `data/research-sources.json`
- Create: `data/research-overrides.json`
- Create: `scripts/research/registry.mjs`
- Create: `scripts/validate-research.mjs`
- Modify: `package.json` (add `validate:research`)
- Test: `tests/research-registry.test.ts`, `tests/research-schema.test.ts`

**Interfaces:**
- Consumes: nothing beyond existing contracts.
- Produces:
  - `coreBenchmarks(): BenchmarkEntry[]` where `BenchmarkEntry = { id, label, unit, scale, max|null, higherIsBetter, aliases }`
  - `benchmarkById(id: string): BenchmarkEntry | null`
  - `sourceForVendor(canonicalId: string): { vendor: string; hosts: string[]; orgs: string[] } | null`
  - `normalizeValue(benchmarkId: string, raw: number, unitHint?: string): number | null`
  - `validateResearch(feed: unknown): string[]` (Ajv + semantic rules)

- [ ] **Step 1: Write failing tests for the registry**

```ts
// tests/research-registry.test.ts
import { describe, expect, it } from 'vitest'
import { benchmarkById, coreBenchmarks, normalizeValue, sourceForVendor } from '../scripts/research/registry.mjs'

describe('benchmark registry', () => {
  it('has exactly the eight core benchmarks', () => {
    expect(coreBenchmarks().map((b) => b.label)).toEqual([
      'GPQA Diamond', "Humanity's Last Exam", 'SciCode', 'Terminal-Bench 2.1',
      'IFBench', 'Tau2', 'MMMU-Pro', 'FrontierCode 2.0',
    ])
  })
  it('normalizes a fraction benchmark to percent and rejects unit mismatch', () => {
    expect(normalizeValue('gpqa-diamond', 0.897)).toBe(89.7)
    expect(normalizeValue('gpqa-diamond', 89.7)).toBe(89.7)
    expect(normalizeValue('unknown-benchmark', 0.5)).toBeNull()
  })
  it('resolves vendor sources and skips OpenCode-internal models', () => {
    expect(sourceForVendor('moonshotai/kimi-k3')?.orgs).toContain('moonshotai')
    expect(sourceForVendor(undefined as unknown as string)).toBeNull()
  })
  it('exposes GPQA by id', () => {
    expect(benchmarkById('gpqa-diamond')?.label).toBe('GPQA Diamond')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/research-registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the registry data and module**

Create `data/benchmarks-core.json` with the eight entries. Use `scale: "fraction"` and `max: 100` for the seven percentage benchmarks; use `scale: "raw"`, `unit: "raw"`, `max: null` for `FrontierCode 2.0`. For fraction benchmarks, accept a raw value ≤ 1 as a fraction and multiply by 100; reject values > 100. Add aliases such as `GPQA`, `HLE`, `Terminal Bench 2.1`.

Create `data/research-sources.json` mapping canonical vendor prefixes to `hosts` and `orgs`. Include `moonshotai`, `tencent`, `alibaba`, `meta`, `meituan`, `stepfun`, `recursive`, and `z-ai`. Explicitly list `"artificialanalysis.ai"` in a `deniedHosts` array. Return `null` for any id with a missing or unmapped vendor.

- [ ] **Step 4: Write the schema test**

```ts
// tests/research-schema.test.ts
import { describe, expect, it } from 'vitest'
import { validateResearch } from '../scripts/validate-research.mjs'
const ok = {
  schemaVersion: 1,
  generatedAt: '2026-11-23T12:30:00.000Z',
  run: { status: 'ok', modelsConsidered: 11, modelsResearched: 1, accepted: 1, rejected: 0, reasons: {} },
  models: [{ id: 'kimi-k3', name: 'Kimi K3', benchmarks: [{
    benchmarkId: 'gpqa-diamond', label: 'GPQA Diamond', value: 93.5, unit: '%',
    sourceUrl: 'https://github.com/MoonshotAI/Kimi-K3', sourceTitle: 'Kimi K3',
    quote: 'Kimi K3 — GPQA Diamond: 93.5%', retrievedAt: '2026-11-23T12:29:00.000Z',
    sourceHash: 'sha256:abc', method: 'two-provider+quote', confidence: 'high',
    modelsUsed: ['google-ai-studio/gemini-3.8-flash', 'groq-cloud/openai/gpt-oss-120b'],
    status: 'verified', stale: false, supersededByAA: false,
  }] }],
}
describe('research validator', () => {
  it('accepts a valid feed', () => expect(validateResearch(ok)).toEqual([]))
  it('rejects a duplicate benchmark', () => {
    const bad = structuredClone(ok)
    bad.models[0].benchmarks.push({ ...bad.models[0].benchmarks[0] })
    expect(validateResearch(bad).some((e) => e.includes('duplicate'))).toBe(true)
  })
  it('rejects a non-https source', () => {
    const bad = structuredClone(ok)
    bad.models[0].benchmarks[0].sourceUrl = 'http://example.com'
    expect(validateResearch(bad).some((e) => e.includes('https'))).toBe(true)
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run tests/research-schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 6: Implement schema and validator**

Create `research.schema.json` from the design §8 contract. `additionalProperties: false` is not required; `status` enum is `verified | conflict | single-source`; `value` finite. Reject duplicate `benchmarkId` per model, disallowed hosts from `research-sources.json`, and entries whose `models[].id` is absent from `public/data/latest.json` when that file is readable. `validateResearch` returns human-readable strings.

- [ ] **Step 7: Run tests and commit**

Run: `npx vitest run tests/research-registry.test.ts tests/research-schema.test.ts`
Expected: PASS.
Commit: `feat: add research contracts and registries`.

---

### Task 2: Gap selection and verified-result store

**Files:**
- Create: `scripts/research/gaps.mjs`
- Create: `scripts/research/store.mjs`
- Test: `tests/research-store.test.ts`

**Interfaces:**
- Consumes: `coreBenchmarks()`, `benchmarkById()`, `sourceForVendor()` from Task 1; `src/lib/types.ts` `Model`.
- Produces:
  - `selectGaps({ snapshot, research, overrides, now, maxModels = 5, maxPerModel = 3 }): Gap[]`
    where `Gap = { model: Model; benchmark: BenchmarkEntry; reason: string }`
  - `mergeResearch({ previous, overrides, candidates, now }): ResearchFeed`
  - `markStale(feed, now): ResearchFeed`
  - `applyOverrides(feed, overrides): ResearchFeed`

- [ ] **Step 1: Write failing tests**

```ts
// tests/research-store.test.ts
const rated = makeModel('rated', { ii: 60 })
const noIdentity = makeModel('big-pickle', { vendor: 'opencode', canonicalId: null, ii: null })
const eligible = makeModel('kimi-k3', { ii: null, canonicalId: 'moonshotai/kimi-k3' })

it('skips rated and no-identity models', () => {
  expect(selectGaps({ snapshot: { models: [rated, noIdentity] }, research: empty, overrides: empty, now: NOW })
    .map((g) => g.model.id)).toEqual([])
})
it('caps pairs and skips benchmarks already in AA', () => {
  const model = makeModel('m', { ii: null, canonicalId: 'moonshotai/m', evals: { 'GPQA Diamond': 0.9 } })
  const gaps = selectGaps({ snapshot: { models: [model] }, research: empty, overrides: empty, now: NOW })
  expect(gaps.some((g) => g.benchmark.id === 'gpqa-diamond')).toBe(false)
  expect(gaps.length).toBeLessThanOrEqual(3)
})
it('preserves locked manual overrides', () => {
  const override = { ...entry, method: 'manual', locked: true, status: 'verified' }
  const next = mergeResearch({ previous: empty, overrides: { entries: [override] }, candidates: [{ ...entry, value: 1 }], now: NOW })
  expect(next.models[0].benchmarks[0].value).toBe(entry.value)
  expect(next.models[0].benchmarks[0].locked).toBe(true)
})
it('marks entries stale after 30 days and superseded when AA has an index', () => {
  const feed = mergeResearch({ previous: empty, overrides: empty, candidates: [entry], now: NOW })
  const old = markStale(feed, NOW + 31 * DAY)
  expect(old.models[0].benchmarks[0].stale).toBe(true)
  const ratedSnapshot = { models: [{ ...eligible, aa: { intelligenceIndex: 50 } }] }
  const superseded = applyOverrides(feed, empty, ratedSnapshot)
  expect(superseded.models[0].benchmarks[0].supersededByAA).toBe(true)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/research-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `gaps.mjs` and `store.mjs`**

`selectGaps` filters models by `typeof aa?.intelligenceIndex !== 'number'`, requires `sourceForVendor(canonicalId) !== null`, removes core benchmarks present in `aa.evals`, removes pairs already `verified` and not stale in research/overrides, sorts by fewest existing external values then id, applies caps. `mergeResearch` keeps existing entries, replaces only non-locked entries for the same `(id, benchmarkId)`, appends new candidates, caps 500 models, and sorts deterministically. `markStale` sets `stale` when `now - retrievedAt > 30d`; hides nothing. `applyOverrides` merges locked manual entries and sets `supersededByAA` when the model has a numeric AA Index.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/research-store.test.ts`
Expected: PASS.
Commit: `feat: select gaps and merge research results`.

---

### Task 3: Safe search and page fetching

**Files:**
- Create: `scripts/research/search.mjs`
- Create: `scripts/research/fetch-page.mjs`
- Test: `tests/research-search.test.ts`

**Interfaces:**
- Consumes: `sourceForVendor()` from Task 1.
- Produces:
  - `search({ model: Model, benchmark: BenchmarkEntry, fetchImpl? }): Promise<SearchResult[]>`
  - `fetchPage(url: string, { fetchImpl?, maxBytes?, timeoutMs? }): Promise<{ text: string; hash: string } | null>`
  - `officialUrlAllowed(url: string, canonicalId: string): boolean`

- [ ] **Step 1: Write failing tests with a local mock server**

```ts
it('parses DuckDuckGo results and ranks official hosts first', async () => {
  const results = await search({ model, benchmark, fetchImpl: stubDDG })
  expect(results[0].url).toContain('github.com/MoonshotAI')
})
it('blocks SSRF redirects', async () => {
  const page = await fetchPage('https://example.test/redirect', {
    fetchImpl: stubRedirectTo('http://127.0.0.1:4000/admin'),
  })
  expect(page).toBeNull()
})
it('rejects oversized and non-html responses', async () => {
  expect(await fetchPage('https://example.test/big', { fetchImpl: stubLarge })).toBeNull()
  expect(await fetchPage('https://example.test/json', { fetchImpl: stubJson })).toBeNull()
})
it('excludes AA as evidence', () => {
  expect(officialUrlAllowed('https://artificialanalysis.ai/models/kimi-k3', 'moonshotai/kimi-k3')).toBe(false)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/research-search.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement search and fetch**

`search` uses `https://html.duckduckgo.com/html/?q=…` with query template `"<model name>" "<benchmark label>" benchmark score`, parses result links with Cheerio, caps 10, then filters with `officialUrlAllowed`. If DDG returns 202/429/CAPTCHA, return only direct official URLs built from the source registry. `fetchPage` follows at most 3 redirects, rejects non-`https` final URLs, private/link-local/loopback IPs, non-HTML/text content types, >2 MB bodies, and timeouts >20 s. It returns normalized text plus SHA-256 of that text.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/research-search.test.ts`
Expected: PASS.
Commit: `feat: add SSRF-safe search and fetch`.

---

### Task 4: Router client, extraction, and key redaction

**Files:**
- Create: `scripts/research/redact.mjs`
- Create: `scripts/research/router-client.mjs`
- Create: `scripts/research/extract.mjs`
- Test: `tests/research-router.test.ts`

**Interfaces:**
- Consumes: `BenchmarkEntry` from Task 1, `fetchPage()` from Task 3.
- Produces:
  - `redact(message: string, secrets?: string[]): string`
  - `chat({ profile: string; messages: Message[]; fetchImpl? }): Promise<{ text: string; provider: string }>`
  - `providerFromResponse(response: Response): string | null` reads `x-free-llm-provider`.
  - `extract({ model, benchmark, page, profile, fetchImpl? }): Promise<Extracted | null>`
    where `Extracted = { value: number; unit: string; quote: string; sourceUrl: string; provider: string; profile: string }`

- [ ] **Step 1: Write failing tests with a mock OpenAI-compatible server**

```ts
it('redacts fake keys and bearer tokens', () => {
  expect(redact('key gsk_abc123 failed', ['gsk_abc123'])).not.toContain('gsk_abc123')
})
it('sends temperature 0 and the requested router profile', async () => {
  const body = await chatWithCapture({ profile: 'auto:smart', messages: [] })
  expect(body.temperature).toBe(0)
  expect(body.model).toBe('auto:smart')
})
it('reads the provider from the router response header', async () => {
  const reply = await chat({ profile: 'auto:smart', messages: [], fetchImpl: stubHeader })
  expect(reply.provider).toBe('groq-cloud')
})
it('returns structured extraction from a JSON response', async () => {
  const result = await extract({ model, benchmark, page, profile: 'auto:smart', fetchImpl: stubJSON })
  expect(result).toMatchObject({ value: 93.5, unit: '%' })
})
it('returns null on malformed JSON and retries once on 429', async () => {
  expect(await extract({ ..., fetchImpl: stubMalformed })).toBeNull()
  expect(stub429.calls).toBe(2)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/research-router.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the router client**

`chat` posts to `http://127.0.0.1:4000/v1/chat/completions` with `Authorization: Bearer ${FREE_LLM_API_KEY}`, `temperature: 0`, `response_format: { type: 'json_object' }`, bounded `max_tokens`, 20 s timeout, one retry on 429/5xx. It returns the assistant text plus the provider reported in `x-free-llm-provider`. Never log request/response headers or bodies; only the provider label is retained. `redact` replaces known secret values and patterns `gsk_`, `sk-`, `AIza`, `fllm-`, `Bearer ` with `[redacted]`. `extract` builds a prompt that treats page text as untrusted data, requires the exact JSON shape `{value, unit, quote, sourceUrl}`, and returns `null` when validation fails.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run tests/research-router.test.ts`
Expected: PASS.
Commit: `feat: add redacted router extraction client`.

---

### Task 5: Verification and orchestrator CLI

**Files:**
- Create: `scripts/research/verify.mjs`
- Create: `scripts/research/cli.mjs`
- Create: `scripts/research.mjs` (thin CLI entry)
- Modify: `package.json` (add `research`)
- Test: `tests/research-integration.test.ts`, `tests/research-verify.test.ts`

**Interfaces:**
- Consumes: all of Tasks 1–4.
- Produces:
  - `verifyCandidate({ candidate, other, model, benchmark, pageText }): { status: 'verified' | 'conflict' | 'quote-mismatch' | 'single-source'; entry?: ResearchEntry }`
  - `runResearch(options): Promise<ResearchFeed>`

- [ ] **Step 1: Write failing verification tests**

```ts
it('accepts an exact quote naming model, benchmark and number', () => {
  const page = 'Kimi K3 results: GPQA Diamond 93.5%. Other: 1%'
  expect(verifyCandidate({ candidate: { value: 93.5, unit: '%', quote: 'Kimi K3 results: GPQA Diamond 93.5%.' }, other: sameOtherProvider, model, benchmark, pageText: page }).status).toBe('verified')
})
it('rejects a quote that lacks model or benchmark', () => {
  expect(verifyCandidate({ candidate: { value: 93.5, quote: 'Score: 93.5%' }, ... }).status).toBe('quote-mismatch')
})
it('requires two different providers and tolerates rounding', () => {
  expect(verifyCandidate({ candidate, other: { ...candidate, provider: sameProvider }, ... }).status).toBe('single-source')
  expect(verifyCandidate({ candidate: { value: 93.5 }, other: { value: 93.52, provider: differentProvider }, ... }).status).toBe('verified')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/research-verify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement verification**

Normalize whitespace and punctuation before containment. The quote must contain a model alias (from `research-sources.json`), the benchmark label or alias, and the value in either raw or percent form. Agreement tolerance: `0.05` for `%`, `0.1%` relative for raw. Providers differ when `provider` strings differ; using two model names from the same provider is `single-source`.

- [ ] **Step 4: Write the end-to-end integration test**

```ts
// tests/research-integration.test.ts
it('runs gaps → search → fetch → extract → verify → store with mocks', async () => {
  const feed = await runResearch({
    snapshot: snapshotWithOneGap,
    research: emptyFeed,
    overrides: emptyOverrides,
    fetchImpl: mockFetch,
    chatImpl: mockChat,
    maxModels: 1, maxPerModel: 1,
  })
  expect(feed.models[0].benchmarks[0].status).toBe('verified')
  expect(feed.run.rejected).toBeGreaterThanOrEqual(0)
  expect(JSON.stringify(feed)).not.toMatch(/gsk_|AIza|fllm-/)
})
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run tests/research-integration.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 6: Implement the orchestrator**

`runResearch` calls `selectGaps`, then for each gap searches, fetches up to 3 pages, extracts twice using only router profiles (`auto:smart`, then `auto:spread`, then `auto:reasoning`), reading `x-free-llm-provider` after each call. If both calls used the same provider it retries with the next profile; if no distinct provider is available it records `single-source`. It verifies, stores accepted entries, and returns a feed with a `run` summary. All errors are redacted. `--dry-run` prints a summary without writing. The CLI reads `public/data/latest.json`, `public/data/research.json`, and `data/research-overrides.json`.

- [ ] **Step 7: Run tests and commit**

Run: `npx vitest run tests/research-integration.test.ts tests/research-verify.test.ts`
Expected: PASS.
Commit: `feat: add research orchestrator and verification`.

---

### Task 6: Surface AA evals and external benchmarks in the UI

**Files:**
- Create: `src/lib/benchmarks.ts`
- Create: `src/components/ExternalBenchmarks.tsx`
- Modify: `src/lib/data.ts`
- Modify: `src/components/ModelDetail.tsx`
- Modify: `src/components/ModelTable.tsx`
- Modify: `src/views/CatalogView.tsx`
- Modify: `src/views/MethodologyView.tsx`
- Test: `tests/ui-benchmarks.test.ts`

**Interfaces:**
- Consumes: `ResearchFeed` from Task 2, core benchmark labels from Task 1.
- Produces:
  - `formatBenchmark(label: string, value: number|null|undefined): string`
  - `visibleExternal(feed: ResearchFeed, model: Model): ResearchEntry[]`

- [ ] **Step 1: Write failing tests**

```ts
it('formats fraction evals as percentages but raw scores as numbers', () => {
  expect(formatBenchmark('GPQA Diamond', 0.897)).toBe('89.7%')
  expect(formatBenchmark('GDPval', 1068.94)).toBe('1,068.94')
})
it('hides external data when AA has an index or benchmark', () => {
  const entries = visibleExternal(feed, ratedModel)
  expect(entries).toEqual([])
})
it('hides conflict and single-source entries', () => {
  expect(visibleExternal(feedWithRejected, unratedModel)).toEqual([])
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui-benchmarks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement UI changes**

`formatBenchmark` consults a TS mirror of `benchmarks-core.json`; unknown labels use raw formatting. In `ModelDetail`, show existing `aa.evals` for unrated models with the label “AA eval scores; no AA Intelligence Index published”, and render `visibleExternal()` in a separate section with source link, retrieved date, Verified/Manual badge, and a `<details>` quote. `ModelTable` adds an `EXT` badge when visible external entries exist. `MethodologyView` adds a paragraph explaining the external layer, two-provider verification, and that it never affects picks. `data.ts` loads `research.json` with a missing-file fallback and a schemaVersion guard.

- [ ] **Step 4: Run tests, lint, and build**

Run: `npx vitest run tests/ui-benchmarks.test.ts && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: surface AA evals and external benchmarks`.

---

### Task 7: CI workflow, pinned router/catalog, and setup docs

**Files:**
- Create: `.github/workflows/research.yml`
- Create: `data/vendor/free-llm-catalog.json`
- Create: `docs/research-setup.md`
- Create: `.env.example`
- Modify: `README.md`
- Test: `tests/research-security.test.ts`

**Interfaces:**
- Consumes: `npm run research`, `npm run validate:research`.
- Produces: a workflow that creates `public/data/research.json` and commits only that file.

- [ ] **Step 1: Write failing security tests**

```ts
it('contains no secret placeholders with real-looking values', async () => {
  const files = ['package.json', 'README.md', '.env.example', 'public/data/latest.json']
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    expect(text).not.toMatch(/gsk_[A-Za-z0-9]{20,}/)
    expect(text).not.toMatch(/AIza[A-Za-z0-9_-]{30,}/)
  }
})
it('pins the router commit and catalog checksum', async () => {
  const workflow = await readFile('.github/workflows/research.yml', 'utf8')
  expect(workflow).toContain('85864c4d0f29b74db442b296087862b96f4d84a1')
  expect(workflow).toMatch(/sha256|checksum/i)
  expect(workflow).not.toContain('pull_request')
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/research-security.test.ts`
Expected: FAIL — workflow missing.

- [ ] **Step 3: Implement the workflow**

Download `https://free-llm.com/catalog.json`, commit it at `data/vendor/free-llm-catalog.json`, and record its SHA-256. Workflow: `schedule: '30 */12 * * *'`, `workflow_dispatch` with `max_models` and `dry_run` inputs, `environment: research`, `concurrency: group: data-write`, `timeout-minutes: 20`, top-level `contents: read` and write permission only on the commit step. Steps: checkout, Node 24, `npm install`, `npm install github:nejib1/Free-LLM#85864c4...`, checksum verify, copy catalog into `$FREE_LLM_HOME/catalog.json`, write config with `log_requests:false` and `catalog.refresh_hours:8760`, start router with env keys, `npm run research`, `npm run validate:research`, stop router, delete temp home, commit only `public/data/research.json` after `git pull --rebase`. No artifacts, no `set -x`, no secret echo.

- [ ] **Step 4: Document key setup**

`docs/research-setup.md` lists the three GitHub secrets (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`), where to create them, the local `/tmp/opencode/free-llm-keys.env` flow, and how the job reads them via env only. README links to it and states the independence/attribution policy.

- [ ] **Step 5: Run tests, lint, build**

Run: `npx vitest run tests/research-security.test.ts && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit: `feat: add pinned CI research workflow`.

---

### Task 8: Live smoke test and rollout

**Files:**
- Modify: `.github/workflows/research.yml` (enable schedule after smoke test)
- Test: manual run recorded in `docs/research-setup.md`

**Interfaces:**
- Consumes: all previous tasks and the three GitHub secrets.
- Produces: a verified `public/data/research.json` committed by the bot.

- [ ] **Step 1: Ask for keys**

At this point only, ask the human to create the three free keys and place them in `/tmp/opencode/free-llm-keys.env`. Create the `research` GitHub environment and set secrets by reading that file without printing values.

- [ ] **Step 2: Dry run**

Run: `gh workflow run research.yml -F dry_run=true -F max_models=1`
Expected: job succeeds, no commit, summary shows 0 or 1 verified entry and no leaked secrets.

- [ ] **Step 3: One-model live run**

Run: `gh workflow run research.yml -F max_models=1`
Expected: `public/data/research.json` contains only `verified` entries from two providers; inspect the file and workflow log manually.

- [ ] **Step 4: Enable the schedule**

Uncomment the `schedule` trigger, set `max_models` to 3 for a week, then to 5 if the quota and logs are clean. Confirm `npm run validate:research`, `npm run lint`, `npm test`, and `npm run build` still pass.

- [ ] **Step 5: Commit and explain**

Commit: `chore: enable scheduled research`. Then explain the final design to the human: the four layers (refresh, research, verification, display), where keys live, what is and is not published, and how to audit a value.
