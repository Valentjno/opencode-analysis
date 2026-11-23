<!--
Sync Impact Report
- Version change: none → 1.0.0 (initial ratification)
- Modified principles: n/a (initial adoption)
- Added sections: Core Principles (I–V), Additional Constraints, Development Workflow, Governance
- Removed sections: none
- Follow-up TODOs: none
-->

# OpenCode Analysis Constitution

## Core Principles

### I. Free & Serverless (NON-NEGOTIABLE)

The public deployment MUST cost zero dollars to operate and MUST NOT require a
paid backend, database, or stored credential. The site is a static bundle served
by Cloudflare Pages; data is refreshed by a scheduled GitHub Actions workflow on
public runners. A push to `main` is the only deployment action. Any feature that
would require a paid service, a private server, or a secret in the build MUST be
replaced by a static or manual equivalent, or dropped.

**Rationale:** the dashboard is a community view for OpenCode users, not a
product with an operating budget. Free hosting also keeps the project forkable
and auditable by anyone.

### II. Source Fidelity & Attribution

Every displayed metric MUST be traceable to a recorded fetch from a documented
OpenCode or Artificial Analysis source, with its URL and refresh timestamp kept
in the published dataset. The app MUST NOT invent, interpolate, or estimate an
Intelligence Index, price, allowance, or privacy flag. Missing values MUST render
as an explicit "Not rated" or "—" state, never be silently omitted. The catalog
MUST contain only OpenCode Go models and OpenCode free models; paid-only Console
models are out of scope. Artificial Analysis data MUST carry a visible credit and
link, and OpenCode data MUST link back to the relevant console page.

**Rationale:** a comparison tool is only useful if a reader can check every
number. Attribution is both an ethical obligation and the license under which
the upstream data is published.

### III. Honest Privacy & Cost Analysis

Privacy classification MUST come from OpenCode's structured flags when present,
and from a curated, dated map of the OpenCode privacy documentation for free
models. Unknown privacy terms MUST be represented as `null` ("not documented"),
never assumed safe. Go allowances MUST be shown exactly as published per model
(monthly usage and estimated requests per 5 hours); the app MUST NOT invent a
pooled balance. Recommendations MUST be derived from published data using a
documented rule set, and any tie or unknown MUST be explained in the interface.

**Rationale:** users may route confidential work through these models. A wrong
"private" badge is worse than an honest "unknown".

### IV. Boring, Maintainable Stack

The app MUST be built with Vite, React, TypeScript, and Tailwind CSS, and MUST
produce a static bundle with no server-side runtime. The published data contract
MUST be a versioned JSON document (`schemaVersion`) shared by the refresher and
the UI through TypeScript types. Schema changes that remove or rename fields MUST
bump the version. Dependencies MUST stay small and purposeful; no additional
state-management, component, or charting framework beyond Recharts, Lucide, and
Tailwind is permitted without a recorded justification.

**Rationale:** the project should remain approachable to an OpenCode contributor
who has an afternoon, not a week.

### V. Verifiable Automation

`npm run build`, `npm run lint`, and `npm run refresh` MUST pass before merge.
The refresher MUST be idempotent and MUST tolerate partial upstream failure: a
failed Artificial Analysis page keeps the last known value and marks it stale,
and never aborts the whole run. The scheduled workflow MUST commit data only
when it changed. Every continuous-integration run MUST type-check, lint, build,
and validate the generated JSON against the documented schema. Deployment MUST
remain independent of refresh outcome.

**Rationale:** unattended automation that fails loudly and often is worse than
no automation. A stale-but-labeled value is honest; a missing dashboard is not.

## Additional Constraints

**Security and privacy.** The site MUST NOT include analytics, advertising,
trackers, cookies, or third-party scripts. It MUST NOT collect or transmit user
input. No API keys, tokens, or account credentials may appear in the repository
or the built bundle. External links MUST use `rel="noopener noreferrer"`.

**Performance.** The initial route MUST render from static JSON with no blocking
network request beyond the data file. The production JavaScript bundle SHOULD
stay under 300 KB gzipped. Charts MUST remain usable on a mid-range phone.

**Accessibility.** The interface MUST be keyboard navigable, MUST meet WCAG 2.1
AA contrast for text, and MUST NOT rely on color alone to convey privacy or
rating status. Charts MUST provide a table or textual equivalent of their data.

**Licensing.** Source code is released under the MIT License. OpenCode and
Artificial Analysis data remain subject to their own terms; the README MUST
state the attribution and the independence of this project.

## Development Workflow

Work follows Spec-Driven Development using GitHub Spec Kit: constitution →
specify → plan → tasks → implement → converge. Each feature gets a numbered
specification under `specs/`. A change is complete only when its tasks are
checked off, the quality gates pass, and the generated data validates. Commits
use Conventional Commit messages. `main` is always deployable; the scheduled
data refresh commits directly to `main` with the bot identity and does not
require review, while code changes do.

## Governance

This constitution supersedes ad-hoc practice. Amendments require a pull request
that states the change, the rationale, and the version bump, and they take effect
when merged. Versioning follows semantic rules: MAJOR for removed or redefined
principles, MINOR for a new principle or materially expanded guidance, PATCH for
clarifying edits. Every review MUST check compliance with Principles I–V; any
deliberate exception MUST be documented in the pull request. Runtime development
guidance lives in `AGENTS.md` and the feature plans under `specs/`.

**Version**: 1.0.0 | **Ratified**: 2026-11-23 | **Last Amended**: 2026-11-23
