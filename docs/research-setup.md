# Setting up the CI research job

The job fills missing external benchmark values for Go/free models that have no
Artificial Analysis Intelligence Index. It publishes a value only when two
independent free providers extract the same number from an official vendor page
and the exact quote, unit and table column all check out.

Keys never appear in the repository, a log, or an artifact. They live in GitHub
Actions secrets in the protected `research` environment and are passed to the
router only as environment variables.

## 1. Free provider keys

| Provider | Create a key at | Role |
|----------|-----------------|------|
| Groq | https://console.groq.com/keys | First extraction provider |
| Kilo | https://kilocode.ai | Second, independent extraction provider |
| OpenRouter | https://openrouter.ai/keys | Optional failover |
| Requesty | https://requesty.ai | Optional failover |
| Cloudflare Workers AI | https://dash.cloudflare.com | Optional failover; needs an Account ID too |

All have free, no-card tiers. Google AI Studio is deliberately disabled: it
rejects the key from both the runner and the local network with
`Invalid Auth key`. The orchestrator never hardcodes provider model IDs; it
discovers exact `provider/model` IDs from the router's `/v1/models?all=1`.

## 2. Put the keys in a local file, not in chat or git

```bash
mkdir -p /tmp/opencode
nano /tmp/opencode/free-llm-keys.env
chmod 600 /tmp/opencode/free-llm-keys.env
```

Contents:

```dotenv
GROQ_API_KEY=
KILO_API_KEY=
OPENROUTER_API_KEY=
REQUESTY_API_KEY=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
```

Create the GitHub environment and required secrets from that file:

```bash
gh api -X PUT repos/Valentjno/opencode-analysis/environments/research
for name in GROQ_API_KEY KILO_API_KEY FREE_LLM_API_KEY FREE_LLM_MASTER_KEY; do
  value=$(grep "^${name}=" /tmp/opencode/free-llm-keys.env | cut -d= -f2-)
  printf '%s' "$value" | gh secret set "$name" --env research
done
```

Add any optional providers the same way. The commands read each value from the
file without printing it. `FREE_LLM_API_KEY` is the router's own bearer key and
`FREE_LLM_MASTER_KEY` encrypts the ephemeral router config; generate both once
with `openssl rand -hex 32` if they are not in the file yet.

After setting the secrets, delete the local file if you want. GitHub keeps the
only copy.

## 3. Router configuration

The workflow writes this config into `$FREE_LLM_HOME/config.json` before
starting the router:

```json
{
  "version": 1,
  "log_requests": false,
  "fallback_to_auto": false,
  "catalog": { "url": "https://free-llm.com/catalog.json", "refresh_hours": 8760 },
  "providers": { "google-ai-studio": { "enabled": false, "guest": false } }
}
```

`fallback_to_auto: false` is required. Without it the router may accept an
exact `provider/model` request but silently serve it from another provider. That
would defeat the two-provider rule and could make the same provider look like
two independent confirmations.

## 4. Run it

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

The CI run has not yet been repeated after these fixes. The schedule stays
commented out until a green run writes a verified `research.json`.

## 7. Rotation and revocation

Use dedicated keys for this job. If a key is suspected leaked, revoke it at the
provider, rotate the matching GitHub secret, and re-run the workflow. The router
pins each key to its provider host on first use and refuses to send it
elsewhere.

Verification is deliberately strict: if a model will not provide an exact quote
naming the model, benchmark and number in the model column, no value is
published.
