# Architecture

This document explains how opencode analysis is built and why. Read it alongside
the [spec](../specs/001-model-radar-dashboard/spec.md).

## Overview

The site is a static Vite + React + TypeScript app. All data is committed as
JSON. Cloudflare Pages builds and serves it. There is no server, database, or
runtime API.

## Data pipeline

1. `scripts/refresh.mjs` fetches the OpenCode Go and full catalogs, the Go
   allowances page, and the Artificial Analysis sitemap plus model pages.
2. It builds the model list, matches AA slugs with `data/aliases.json`, and
   validates against the JSON Schemas.
3. It writes `public/data/latest.json` and `public/data/changes.json` atomically.
4. `.github/workflows/refresh.yml` runs every 12 hours and commits changes.
5. Cloudflare Pages rebuilds on push.

Artificial Analysis is optional: a failed AA page keeps the last published score
and is marked cached. If either OpenCode catalog fails, the run exits without
writing.

## Research pipeline

A separate CI job fills benchmark gaps for models. It uses the Free-LLM Router
as the only model gateway.

1. `selectGaps` picks models with a canonical vendor identity and missing core
   benchmarks.
2. `search` tries raw model cards first, then official vendor pages.
3. `fetchPage` normalizes HTML and tables with SSRF and size guards.
4. `extract` asks exact router targets for a structured value with a verbatim
   quote.
5. `verifyCandidate` requires two different providers, agreement within tolerance,
   the quote in the page, and the value in the correct table column.
6. Verified values are written to `public/data/research.json` and shown as a
   separate "External benchmarks" layer.

Provider keys are auto-detected from a registry in `data/research-providers.json`.
Adding a provider is one registry entry plus the secret.

## UI architecture

- `App.tsx` holds snapshot, changes, research, theme, and hash routing.
- Views: Overview, Models, Analysis, Changes, About.
- Shared components: FilterBar, ModelTable, ValueChart, PlanValue, InfoPopover,
  ModelDetail, ExternalBenchmarks.
- Charts use Recharts. Vendor colors come from `src/lib/vendors.ts`.
- Filters and model selection in Analysis are stored in the URL.

## Privacy model

Go models use structured `training` and `zdr` flags. Free models use a curated,
dated map. Missing terms are labeled "Unknown" and never treated as private.
The site does not read user accounts or store analytics.

## Why static

- Zero runtime cost and zero secrets in the browser.
- Data is auditable: every value is in a committed JSON file.
- Cloudflare Pages provides free hosting, HTTPS, and CDN.
- No database means no migration or backup burden.
