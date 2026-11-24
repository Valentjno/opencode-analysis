# Setting up the CI research job

The job fills missing external benchmark values for Go/free models. It publishes
a value only when two independent providers extract the same number from an
official vendor page and the exact quote, unit and table column all check out.

Keys never appear in the repository, a log, or an artifact. They live in GitHub
Actions secrets in the protected `research` environment and are passed to the
router only as environment variables.

## 1. Add any provider keys you have

You do not need a fixed set. The job auto-detects which supported providers are
configured and enables only those:

| Provider | Secret name | Notes |
|----------|-------------|-------|
| Groq | `GROQ_API_KEY` | Good default first provider |
| Kilo | `KILO_API_KEY` | Independent second provider |
| OpenRouter | `OPENROUTER_API_KEY` | Optional |
| Requesty | `REQUESTY_API_KEY` | Optional |
| Cloudflare Workers AI | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | Optional; both are required |
| FreeInference | `FREEINFERENCE_API_KEY` | Optional |
| Google AI Studio | `GEMINI_API_KEY` | Disabled in the registry; the key is rejected with `Invalid Auth key` |

The registry lives in `data/research-providers.json`. Adding a new provider is
one entry there plus the secret; no other code changes are needed.

The router itself also needs two keys that are not provider keys:

- `FREE_LLM_API_KEY` — the bearer key clients use to call the router
- `FREE_LLM_MASTER_KEY` — encrypts the ephemeral router config

Generate both once with `openssl rand -hex 32`.

## 2. Put the keys in a local file, not in chat or git

```bash
mkdir -p /tmp/opencode
nano /tmp/opencode/free-llm-keys.env
chmod 600 /tmp/opencode/free-llm-keys.env
```

Contents (add only the providers you have):

```dotenv
GROQ_API_KEY=
KILO_API_KEY=
OPENROUTER_API_KEY=
REQUESTY_API_KEY=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
FREEINFERENCE_API_KEY=
FREE_LLM_API_KEY=
FREE_LLM_MASTER_KEY=
```

Create the GitHub environment and push the secrets:

```bash
gh api -X PUT repos/Valentjno/opencode-analysis/environments/research
for name in GROQ_API_KEY KILO_API_KEY OPENROUTER_API_KEY REQUESTY_API_KEY \
            CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID FREEINFERENCE_API_KEY \
            FREE_LLM_API_KEY FREE_LLM_MASTER_KEY; do
  value=$(grep "^${name}=" /tmp/opencode/free-llm-keys.env | cut -d= -f2-)
  [ -n "$value" ] && printf '%s' "$value" | gh secret set "$name" --env research
done
```

The commands read each value from the file without printing it. After setting
the secrets, delete the local file if you want. GitHub keeps the only copy.

## 3. What happens with one or many providers

- **Two or more** configured providers: values can be verified and published.
- **One** provider: the job still runs, but every value is marked
  `single-source` and nothing is published.
- **Zero** providers: the job stops with a clear message.

The workflow prints only the provider names/count, never the keys. It no longer
requires Groq and Kilo specifically.

## 4. Router configuration

The workflow generates `$FREE_LLM_HOME/config.json` from the registry and the
environment:

```json
{
  "version": 1,
  "log_requests": false,
  "fallback_to_auto": false,
  "catalog": { "url": "https://free-llm.com/catalog.json", "refresh_hours": 8760 },
  "providers": {
    "groq-cloud": { "enabled": true, "guest": false },
    "kilo-gateway": { "enabled": true, "guest": false },
    "openrouter": { "enabled": false, "guest": false }
  }
}
```

`fallback_to_auto: false` is required. Without it the router may accept an
exact `provider/model` request but silently serve it from another provider. That
would defeat the two-provider rule and could make the same provider look like
two independent confirmations.

## 5. Run it

Manual first:

```bash
gh workflow run research.yml -F dry_run=true -F max_models=1
gh workflow run research.yml -F max_models=1
```

Inspect `public/data/research.json` and the workflow log. When a run writes a
verified value cleanly, uncomment the `schedule:` block in
`.github/workflows/research.yml` and let the 12-hour cadence take over.

## 5. What the job does

1. Reads `latest.json`, `research.json`, and the locked manual overrides.
2. Picks up to 15 gaps from eligible models: a canonical vendor identity, and no
   existing verified value for that benchmark. AA-rated models are included for
   core benchmarks AA does not already report.
3. Tries the raw model card first:
   `huggingface.co/{id}/raw/main/README.md`,
   `raw.githubusercontent.com/{id}/main/README.md`,
   `github.com/{id}/raw/main/README.md`, then the rendered model page. DuckDuckGo
   results are appended, restricted to official vendor domains and orgs.
4. Fetches with SSRF, redirect, size and content-type limits. HTML tables become
   pipe-separated rows; HTML tables embedded inside a Markdown model card are
   converted too, because some vendors serve raw READMEs as `text/plain`.
5. Selects a focused excerpt around the benchmark mention and keeps the table
   header row, instead of sending the first 12K characters of a long page.
6. Asks exact router targets in round-robin provider order, so a rate-limited
   first choice cannot hide a second provider behind every model of the first
   one. Groq gets a smaller output budget; Kilo and the other providers get a
   larger one for reasoning tokens.
7. Rebuilds the quote deterministically from the cleaned page text. For a table
   row, the value must sit in the column whose header names this model. A
   `Hy4 flash Base` column is not accepted for `Hy4 flash Free`.
8. Requires two different `x-free-llm-provider` values, agreement within 0.05
   percentage points, and an exact quote present in the page. Anything else is
   rejected as `single-source`, `conflict` or `quote-mismatch`.
9. Writes only `verified` values and commits only `public/data/research.json`.

Prompts contain only public model and benchmark names. Provider keys and the
router key are passed by environment, never as arguments, never logged. Router
request logging is disabled, the log file is deleted, and no artifact is
uploaded.

## 6. Local verification

Start the pinned router with the same config, export the provider keys, then run:

```bash
npm run research -- --max-models 1 --dry-run
```

A dry run prints the accepted/rejected counts and reasons without writing the
feed. The same pipeline was verified locally against the real Kimi K3.1 Pro
model card:

- GPQA Diamond: 94.2 from `GPQA-Diamond | 94.2 | ...`, confirmed by
  `groq-cloud` and `kilo-gateway`.
- MMMU-Pro: 84.1 from `MMMU-Pro | 84.1 | ...`, confirmed by the same two
  providers.

The first successful CI run wrote `public/data/research.json` with a verified
value: Kimi K3.1 Pro — GPQA Diamond 94.2, confirmed by `groq-cloud` and
`kilo-gateway`. The schedule is now enabled at `30 */12 * * *`.

## 7. Rotation and revocation

Use dedicated keys for this job. If a key is suspected leaked, revoke it at the
provider, rotate the matching GitHub secret, and re-run the workflow. The router
pins each key to its provider host on first use and refuses to send it
elsewhere.

Verification is deliberately strict: if a model will not provide an exact quote
naming the model, benchmark and number in the model column, no value is
published.
