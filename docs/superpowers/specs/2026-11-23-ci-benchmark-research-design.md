# CI Benchmark Research Agent — Design

**Date:** 2026-11-23
**Status:** Revised after builder review (awaiting approval)
**Project:** `opencode-analysis`
**Feature area:** missing Artificial Analysis coverage, external benchmark evidence

## 1. Intent and why

Artificial Analysis does not rate every Go or free model. Of the 39 models in
the current snapshot, 5 have an AA page with eval scores but no Intelligence
Index, and 9 have no AA page at all. Three of the nine are OpenCode-internal
models with no canonical vendor identity. Today the interface says “Not rated” and
hides the eval scores that do exist.

The goal is a **CI research job** that:

1. notices which models or benchmarks are missing;
2. searches public sources for the missing benchmark values;
3. extracts them with free models through Free-LLM Router;
4. verifies each value against the exact fetched page and a second independent
   extraction;
5. publishes only verified values, in a clearly separate “External benchmark”
   layer, with source, quote, and retrieval date.

The public site remains static, deterministic, and secret-free. The research job
runs in GitHub Actions, uses free providers, and never writes credentials to the
repository, logs, artifacts, or the built site.

## 2. Goals

- Surface AA eval scores that already exist for models without an AA Index.
- Fill genuinely missing eval scores from public sources when possible.
- Produce a machine-readable provenance record for every accepted value.
- Keep AA-sourced data and external data visibly distinct.
- Keep picks, Pareto frontiers, and the headline Intelligence Index AA-only.
- Fail closed: if a value cannot be verified, publish nothing for it.
- Run unattended every 12 hours without exposing provider keys.
- Cover weird data: nulls, duplicates, conflicting sources, unit mismatches,
  negative scores, 404/429/timeouts, prompt injection, oversized pages.

## 3. Non-goals

- Do **not** synthesize an Intelligence Index from external benchmarks.
- Do **not** overwrite, extrapolate, or “correct” AA values.
- Do **not** run the agent in the browser or on Cloudflare Pages.
- Do **not** add paid APIs, paid search, or a database.
- Do **not** scrape pages behind a login, paywall, or CAPTCHA.
- Do **not** bypass provider rate limits or create multiple accounts to dodge
  them.
- Do **not** feed external values into the five recommendation rules or the
  Pareto frontier.

## 4. Anti-goals

- A public endpoint that holds provider keys.
- A number with no source URL and no verifiable quote.
- A confident-looking score derived from one model’s memory or a search snippet.
- Silent fallback from “not rated” to a guessed value.
- A CI job that leaks keys through logs, artifacts, command lines, or error
  messages.

## 5. Approaches considered

| Approach | What it gives | Why not chosen |
|----------|---------------|----------------|
| **Local research CLI** | Keys stay on one machine; human reviews output | Not automatic; user asked for CI |
| **CI research job (chosen)** | Runs every 12h, commits verified output, no local machine needed | Requires GitHub secrets and careful log hygiene |
| **Curated manual overrides** | Highest reliability per value | Does not scale; kept as the fallback when verification fails |

The CI job is the chosen approach. Manual overrides remain possible through the
same `research.json` contract if a value needs a human decision.

### 5.1 Resolved after builder review

**Target set.** Only models with **no numeric AA Intelligence Index** are
eligible. Rated models are never researched: AA is authoritative there. The
eligible set is 11 models with a canonical vendor identity; the 3 OpenCode
models with no canonical id (`big-pickle`, `iceman-*`, `tidepool-alpha-free`)
are skipped because there is no official source to verify against.

The unit of work is a `(model, benchmark)` pair. The benchmark target is a fixed
**core eight**, chosen because they are coding/reasoning-relevant and comparable
across vendors:

| Benchmark | Why it is in the core |
|-----------|-----------------------|
| GPQA Diamond | Hard science reasoning |
| Humanity's Last Exam | Frontier reasoning |
| SciCode | Scientific coding |
| Terminal-Bench 2.1 | Agentic coding |
| IFBench | Instruction following |
| Tau2 | Tool use |
| MMMU-Pro | Multimodal reasoning |
| FrontierCode 2.0 | Coding capability |

A benchmark already present in the model's AA profile is skipped. Caps: 5
models, 3 benchmarks per model, 15 pairs per run. Priority: models with zero
external values first, then fewest values; ties by id. A full AA label sweep
(31 labels) is explicitly out of scope for v1.

**Acceptable sources.** A source must be the vendor's own identity:

- the vendor's official domain or docs;
- `github.com/<vendor-org>/…` for the canonical org;
- `huggingface.co/<vendor-org>/…` for the canonical org;
- an arXiv paper only when the vendor's model card links to it.

Third-party re-uploads, blogs, Reddit, Medium, LinkedIn, search snippets and
aggregators are rejected. `artificialanalysis.ai` is **excluded** as evidence:
the external layer must never duplicate an AA value the refresher failed to map.
`data/research-sources.json` maps each canonical vendor to its allowed hosts and
orgs; an unknown vendor means no research.

**Pinning.** At implementation time we review and pin the current Free-LLM
`main` commit SHA. We also commit a reviewed snapshot of
`free-llm.com/catalog.json` at `data/vendor/free-llm-catalog.json`, verify its
SHA-256 in CI, copy it to `$FREE_LLM_HOME/catalog.json` before starting the
router, and set `catalog.refresh_hours` high enough that the router uses the
pinned catalog. This pins both the code **and** the provider base URLs. Without
it, a compromised live catalog could redirect a key.

**Definition of verified.** A value is `verified` only when:

1. the exact quote is found on the fetched page;
2. the quote names the model (or a registered alias) **and** the benchmark
   **and** the number;
3. two independent extractions from **different providers** agree after
   normalization (tolerance: 0.05 for percentages, 0.1% relative for raw
   scores); and
4. the source is on the official allowlist.

If only one provider is available, the candidate is `single-source`, not
published. A single extraction with a perfect quote is not enough. The smoke
test therefore targets `kimi-k3`, which has an AA page and evals but no AA
Index, rather than an OpenCode-internal model.

**Lifecycle.** The job fills gaps; it does not re-fetch verified values every
run. Each entry stores `sourceHash` (SHA-256 of normalized page text),
`retrievedAt`, and the quote. Values are re-verified after 30 days or when the
page hash changes. If AA later publishes an Index for the model, existing
external values are kept in JSON with `supersededByAA: true` but hidden by the
UI. If AA later publishes the same benchmark, AA wins and the duplicate is
hidden. If the page disappears, the last verified value stays with
`stale: true` until 30 days, then is hidden.

**Manual overrides.** Human corrections live in
`data/research-overrides.json`, a committed file the job never writes. Overrides
take precedence, carry `method: "manual"`, `locked: true`, and the badge
“Manual review”. They still need a source URL and quote; a manual entry without
a quote is `manual-unverified` and is hidden by default. The generated
`public/data/research.json` never overwrites, upgrades, or deletes a locked
override.

## 6. Security model (keys must never be visible)

### 6.1 Secret inventory

| Secret | Purpose | Scope |
|--------|---------|-------|
| `GEMINI_API_KEY` | Google AI Studio free models | `research` environment |
| `GROQ_API_KEY` | Groq free models | `research` environment |
| `OPENROUTER_API_KEY` | OpenRouter `:free` models | `research` environment |
| `FREE_LLM_API_KEY` | Router’s own bearer key, random per rotation | `research` environment |
| `FREE_LLM_MASTER_KEY` | Encrypts the ephemeral router config | `research` environment |
| `SEARCH_API_KEY` (optional) | Fallback search provider | `research` environment |

Keys are created by the repository owner, never by the agent. The job works with
two keys, but three providers give real failover.

### 6.2 Controls

1. **No secrets in the repository.** `.env*` is gitignored except
   `.env.example` with empty placeholders. No key appears in `latest.json`,
   `research.json`, prompts, fixtures, docs, or source maps.
2. **GitHub Environment.** The job uses `environment: research`, restricted to
   the `main` branch. Secrets are environment-scoped, not repository-wide.
3. **No fork or PR access.** The workflow triggers only on `schedule` and
   `workflow_dispatch`. It never runs on `pull_request`, so fork code cannot
   read secrets.
4. **Least privilege.** Top-level `permissions: contents: read`; only the final
   commit step receives `contents: write`.
5. **No secret arguments.** Keys are passed only as environment variables.
   Free-LLM imports `GEMINI_API_KEY`, `GROQ_API_KEY`, and
   `OPENROUTER_API_KEY` directly. No `free-llm keys add <key>` command, because
   arguments can appear in process listings.
6. **Ephemeral home.** `FREE_LLM_HOME` points inside `${{ runner.temp }}` and is
   deleted at the end. `FREE_LLM_MASTER_KEY` comes from a secret, so no
   plaintext master key is written to the runner.
7. **Quiet router.** A generated config sets `log_requests: false`. Router
   stdout/stderr goes to a temp file that is deleted and never uploaded. On
   failure the job reports an exit code and a sanitized reason, not the log.
8. **Redaction layer.** The orchestrator redacts anything matching
   `gsk_`, `sk-`, `AIza`, `fllm-`, `Bearer `, and known secret values before
   printing or storing a message. Unit-tested with fake keys.
9. **No artifacts.** The only uploaded/committed output is
   `public/data/research.json`. The workflow has no `actions/upload-artifact`
   step.
10. **Supply chain.** `nejib1/Free-LLM` is pinned to a reviewed commit SHA, not
    `main`. The router is installed with `npm install github:…#<sha>`. The live
    model catalog is also pinned: a reviewed `catalog.json` snapshot is
    committed, checksum-verified, copied into the ephemeral home, and the
    router’s refresh interval is disabled for the run. Code pinning without
    catalog pinning would still let a changed catalog redirect a key.
11. **Masking.** GitHub masks secret values automatically. The workflow never
    echoes them, never runs `set -x`, and never prints the environment.
12. **Rotation.** Keys are dedicated to this job; if a key is suspected leaked,
    revoke it at the provider, rotate the GitHub secret, and re-run. The README
    documents this.
13. **Branch protection.** `main` requires checks; only the bot and maintainers
    can push. The research workflow commits only `research.json`.

### 6.3 What a leaked log could still reveal

Prompts contain only public model names and public benchmark names. Fetched page
text is public. The only sensitive values are provider keys and the router key;
both are excluded by construction and redaction. The job never logs request
headers.

## 7. Architecture

```text
GitHub Actions (12h, after refresh)
  ├─ checkout main, Node 24, npm install
  ├─ install Free-LLM Router at pinned commit
  ├─ start router on 127.0.0.1:4000 with env keys
  ├─ npm run research -- --max-models 5
  │    ├─ gaps.mjs       read latest.json + research.json + registry
  │    ├─ search.mjs     DDG HTML → official source registry
  │    ├─ fetch-page   safe fetch, size cap, text extraction
  │    ├─ extract.mjs   two router calls → strict JSON
  │    ├─ verify.mjs    quote match + unit + range + consensus
  │    └─ store.mjs     merge, validate, atomic write
  ├─ npm run validate:research
  ├─ stop router, delete temp home/logs
  └─ commit public/data/research.json if changed
```

### 7.1 Module map

| File | Responsibility |
|------|----------------|
| `scripts/research/gaps.mjs` | Select models/benchmarks to research; caps and priorities |
| `scripts/research/search.mjs` | Query templates, DDG HTML, official-domain registry, ranking |
| `scripts/research/fetch-page.mjs` | SSRF-safe fetch, redirect/domain checks, size/time limits, text extraction |
| `scripts/research/registry.mjs` | Benchmark metadata: id, label, unit, scale, max, aliases |
| `scripts/research/extract.mjs` | Router client, prompts, JSON schema, two-model calls |
| `scripts/research/verify.mjs` | Quote containment, number normalization, consensus, conflicts |
| `scripts/research/store.mjs` | Read/merge/cap/atomic-write `research.json` |
| `scripts/research/cli.mjs` | CLI flags, orchestration, sanitized summary |
| `scripts/research/redact.mjs` | Secret redaction, tested |
| `scripts/validate-research.mjs` | Ajv schema + semantic validation |
| `specs/001-model-radar-dashboard/contracts/research.schema.json` | Contract |

### 7.2 Router client

- Base URL: `http://127.0.0.1:4000/v1`.
- Auth: `FREE_LLM_API_KEY`.
- The orchestrator talks **only** to the router. It never calls provider APIs
  and never hardcodes a provider’s model id, base URL, or key.
- Extraction uses router profiles: first `auto:smart`, then `auto:spread`
  (which rotates providers), then `auto:reasoning`. No model list to maintain.
- The router reports the chosen provider in the `x-free-llm-provider` response
  header. The client reads it and, if the second call used the same provider,
  retries with the next profile. If no distinct provider is available, the
  candidate is `single-source` and is not published.
- `temperature: 0`, bounded `max_tokens`, JSON-only response, no tools.
- One retry on 429/5xx with backoff; no infinite retries.
- Exact `provider/model` strings are supported only as a manual debugging
  override, never as the normal path.

### 7.3 Search

- Primary: `https://html.duckduckgo.com/html/?q=…`, no key. Parse result titles,
  URLs, snippets; cap 10 results and 3 fetches per benchmark.
- Official registry first: AA model page, provider model card, GitHub repo
  README/model card, arXiv abstract/HTML, official leaderboard.
- Fallback when DDG is blocked (202/429/CAPTCHA): direct official URLs only.
  If `SEARCH_API_KEY` exists, a pluggable Brave/Tavily adapter may be used; this
  is optional and not required for v1.
- No search snippets are accepted as evidence. The value must come from the
  fetched page text.

### 7.4 Verification rules

A candidate is accepted only when all hold:

1. Source is `https`, public, and on the **vendor-specific** allowlist
   (`data/research-sources.json`). `artificialanalysis.ai` is excluded. A
   generic `github.com` or `huggingface.co` page is not enough; the org must
   match the canonical vendor.
2. The fetch succeeded with a 2xx HTML/text response under 2 MB.
3. The quote is at least 20 characters, appears verbatim after whitespace
   normalization, and contains the number in a recognized format.
4. The benchmark is in the registry and the value is within its declared range.
5. Units are normalized explicitly; a bare `0.897` and `89.7%` are not treated
   as the same value unless the registry says the scale is a fraction.
6. A second extraction from a **different provider** agrees after
   normalization (tolerance: 0.05 for percentages, 0.1% relative for raw
   scores). If it does not, the candidate is `conflict` and is not published.
   A single-source extraction is `single-source`, not `verified`.
7. The page is not a search-results page, a login page, or a snippet aggregator.

Rejected candidates keep a reason code (`no-source`, `fetch-failed`,
`quote-mismatch`, `out-of-range`, `conflict`, `single-source`,
`unknown-benchmark`) in the run summary, never as a published value.

### 7.5 Benchmark registry

AA evals use mixed scales. The registry records, per benchmark:

```json
{
  "id": "gpqa-diamond",
  "label": "GPQA Diamond",
  "unit": "%",
  "scale": "fraction",
  "max": 100,
  "aliases": ["GPQA", "GPQA-D"],
  "higherIsBetter": true
}
```

Known AA conventions: most evals are fractions (0–1) and render as percentages;
`GDPval` is a raw score; `Omniscience` can be negative. Unknown benchmarks are
stored as raw numbers with `unit: "raw"` and are not normalised.

## 8. Data contract

`public/data/research.json`:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-23T12:30:00.000Z",
  "run": {
    "status": "ok",
    "modelsConsidered": 14,
    "modelsResearched": 3,
    "accepted": 5,
    "rejected": 7,
    "reasons": { "quote-mismatch": 2, "no-source": 3, "conflict": 2 }
  },
  "models": [
    {
      "id": "big-pickle",
      "name": "Big Pickle",
      "benchmarks": [
        {
          "benchmarkId": "gpqa-diamond",
          "label": "GPQA Diamond",
          "value": 78.4,
          "unit": "%",
          "sourceUrl": "https://example.com/model-card",
          "sourceTitle": "Big Pickle model card",
          "quote": "Big Pickle — GPQA Diamond: 78.4%",
          "retrievedAt": "2026-11-23T12:28:00.000Z",
          "sourceHash": "sha256:…",
          "method": "two-provider+quote",
          "confidence": "high",
          "modelsUsed": ["google-ai-studio/gemini-3.8-flash", "groq-cloud/openai/gpt-oss-120b"],
          "status": "verified",
          "stale": false,
          "supersededByAA": false
        }
      ]
    }
  ]
}
```

Rules:

- `schemaVersion` is 1; a version mismatch is rejected by the UI and validator.
- `models[].id` must exist in `latest.json`; unknown ids are dropped.
- Only models without a numeric AA Index are eligible; rated models are skipped.
- `value` must be finite and within the registry range.
- `sourceUrl` must be `https` and on the vendor’s allowlist; `quote` non-empty;
  `retrievedAt` parseable; `sourceHash` is a SHA-256 of normalized page text.
- Duplicate `benchmarkId` per model is not allowed.
- `status` is `verified`, `conflict`, or `single-source`; only `verified` is
  rendered. `conflict` and `single-source` are kept for the run summary.
- `stale` is true after 30 days without re-verification; the UI hides stale
  values from the catalog badge but may show them with a “cached” label in the
  detail drawer until 30 days.
- `supersededByAA` is true when AA later publishes an Index or the same
  benchmark; the UI hides the external value.
- `run` contains no prompts, keys, or raw logs.
- `data/research-overrides.json` uses the same entry shape plus
  `method: "manual"`, `locked: true`; the generated file never overwrites it.

## 9. UI changes

- **AA evals for unrated models.** In `ModelDetail`, show the existing
  `aa.evals` even when `aa.intelligenceIndex` is null, labeled “AA eval scores;
  no AA Intelligence Index published.” Fix the current scale bug: fraction
  benchmarks render as percentages, raw benchmarks as raw values.
- **External benchmarks section.** A separate section under AA evals. Each row:
  label, value, source link, retrieval date, “Verified” badge, and a disclosure
  containing the exact quote and models used. A value is hidden when its model
  has an AA Index, when AA publishes the same benchmark, or when it is
  `conflict`/`single-source`. Manual overrides show “Manual review”.
- **Catalog.** A small `EXT` badge for models with at least one verified
  external value. The Intelligence Index column still says “Not rated”. The
  badge never implies an AA rating.
- **Methodology.** Explain that external values are not AA, are not used in
  picks or Pareto, and require quote verification.
- **Staleness.** External data older than 7 days is marked “cached”; older than
  30 days is hidden from the table but kept in JSON.
- **Picks/Pareto.** Unchanged. They use only `aa.intelligenceIndex`.

## 10. CI workflow

`.github/workflows/research.yml`:

- Triggers: `schedule: '30 */12 * * *'` (30 minutes after refresh) and
  `workflow_dispatch` with optional `max_models` and `dry_run`.
- `environment: research`.
- `concurrency: group: data-write` (shared with the refresh workflow).
- `timeout-minutes: 20`.
- Steps: checkout, Node 24, `npm install`, install pinned router, verify the
  catalog checksum, copy the pinned catalog into `$FREE_LLM_HOME`, write an
  ephemeral config with `log_requests: false` and a high
  `catalog.refresh_hours`, start the router, run research, validate research,
  stop the router, optionally commit.
- Commit only `public/data/research.json`; `git pull --rebase` before push.
- If the router cannot start, no keys are configured, or validation fails: exit
  non-zero and do not write.
- No artifacts. No `set -x`. No secret echo.

## 11. Failure and edge-case policy

| Case | Behaviour |
|------|-----------|
| AA page has evals but no index | Show AA evals; research only missing benchmarks |
| No search results | Reject with `no-source`; keep previous verified data |
| DDG 202/429/CAPTCHA | Fall back to official URLs; if none, skip |
| Page 404/410 | Reject; try next result |
| Page > 2 MB or non-HTML | Reject |
| Redirect to a non-allowlisted host | Reject |
| Private/localhost URL | Reject (SSRF guard) |
| Quote not found | Reject; never publish the value |
| Number appears in a different unit | Reject or convert only with explicit registry rule |
| Two models disagree | Mark `conflict`; do not publish as verified |
| Provider 429/quota | Router fails over; job continues |
| All providers down | Job exits non-zero; previous research remains |
| Prompt injection in page | Treat page as data; schema validation; no tool execution |
| Duplicate benchmark row | Keep the higher-confidence verified row; deterministic tie-break |
| Model renamed | Match by id; unknown id dropped; old entry expires |
| Clock skew | `retrievedAt` from server time; validator tolerates ±5 min |
| Huge/NaN/Infinity values | Schema rejects; no write |
| Negative omniscience | Allowed; range comes from the registry |
| Only one provider available | `single-source`; not published |
| AA later rates the model | External entries kept with `supersededByAA`; hidden |
| AA later publishes the same benchmark | AA wins; external duplicate hidden |
| Manual override exists | Override wins; generated entry cannot overwrite it |
| Pinned catalog checksum mismatch | Job fails before the router starts |

## 12. Testing

- **Unit:** registry normalization, quote matching, number parsing, unit
  conversion, range checks, URL allowlist, SSRF guard, redaction, gap selection,
  merge/cap/staleness, conflict handling.
- **Integration:** a mock OpenAI-compatible router and mock HTTP server with
  fixtures for happy path, 404, 429, timeout, oversized page, redirect to
  private IP, prompt injection, hallucinated quote, unit mismatch, conflicting
  values, duplicate rows, negative score, NaN.
- **Schema:** Ajv validation of `research.schema.json` plus semantic rules.
- **Lifecycle:** 30-day re-verification, page-hash change, AA supersession,
  manual-override precedence, and stale hiding.
- **Catalog pinning:** checksum mismatch fails; router never fetches a live
  catalog during the job.
- **Live smoke:** `npm run research -- --dry-run --model big-pickle` once keys
  exist; never in CI tests.
- **Security test:** scan the built bundle and committed JSON for known fake
  key patterns; assert no `Bearer` headers or keys in logs.

## 13. Rollout

1. **Phase 0 — AA evals UI.** Show evals that already exist; fix scale. No agent.
2. **Phase 1 — orchestrator offline.** Mock router/search tests; no keys.
3. **Phase 2 — one model.** Run in CI with `max_models=1`, inspect
   `research.json`, confirm no secrets.
4. **Phase 3 — three models.** Enable schedule; cap 3.
5. **Phase 4 — five models.** Cap 5, 12h cadence.

## 14. Decisions made

- CI research job, not local-only.
- Keys are GitHub environment secrets; no key in repo, logs, artifacts, or site.
- External values are separate from AA and never feed picks/Pareto.
- Only models without an AA Index are eligible; the 3 models with no canonical
  vendor identity are skipped.
- Core eight benchmarks; 5 models / 3 benchmarks / 15 pairs per run.
- Vendor-specific official sources only; AA excluded as evidence.
- DDG HTML + official pages; no paid search dependency.
- Free-LLM Router and its catalog pinned; orchestrator uses only `auto:*`
  profiles (`auto:smart`, `auto:spread`, `auto:reasoning`) and the provider
  response header, never provider-specific model IDs.
- Two independent providers required for `verified`; single-source values are
  not published.
- Verified-only publication; conflicts stay in the run summary.
- Manual overrides are locked and never overwritten.
- Three providers: Google AI Studio, Groq, OpenRouter.

## 15. Decisions needed from the human

1. Approve the external values as a separate “External benchmark” layer
   (recommended). Inline display would blur provenance.
2. Direct commits to `main` for verified research (recommended, keeps the 12h
   cadence), or a PR for human review?
3. Are Google AI Studio, Groq, and OpenRouter acceptable? Adding Cloudflare or
   FreeInference improves failover without a phone check.

Until these are answered, implementation can proceed on the schema, registry,
verification, redaction, UI, and mock-based tests. The live CI run needs only
question 1 and the keys; questions 2 and 3 affect deployment policy, not the
orchestrator design.

## 16. What the builder must not assume

- That AA pages always have an index or that missing means zero.
- That a search snippet is evidence.
- That two models calling the same provider are independent.
- That `0.897` and `89.7` are interchangeable without a registry rule.
- That GitHub masks every derived value; redaction is still required.
- That the router can be trusted to keep logs clean; suppress and delete them.

## 17. Agent framework decision (nano-harness)

The `nano-harness` family was reviewed as a possible base. It is not adopted:

- `nano-agent` is a Go coding assistant with shell, filesystem, sandbox, MCP,
  daemon and SQLite memory. It can browse and call models, but it does not
  provide quote verification, SSRF protection, unit normalization, or
  two-provider consensus — the parts that make this job trustworthy.
- `nano-symphony` adds Bun, SQLite and issue-driven orchestration; `nano-cloud`
  adds Docker and a distributed runtime. Both violate the light, serverless
  constraint.
- The “100-line agent loop” article is useful as a reference, not a dependency.

The research job stays a small Node pipeline using the existing `cheerio`
dependency and native `fetch`, with the Free-LLM Router as the only model
gateway.
