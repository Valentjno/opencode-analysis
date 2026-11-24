# Contributing

Thanks for helping improve opencode analysis. The project is a static site plus
two CI jobs. There is no server and no database, so most changes are small.

## Local setup

```bash
npm install
npm run dev          # http://localhost:5173
npm run lint
npm test
npm run build
```

Node 24 or newer is required.

## Data changes

- `npm run refresh` regenerates `public/data/latest.json` and `changes.json`.
  It needs network access and writes nothing if a mandatory OpenCode catalog
  fails.
- `npm run validate` checks the published JSON against the schemas.
- Do not hand-edit `latest.json` or `changes.json`; refresh and commit the
  result.
- Alias changes go in `data/aliases.json`. Privacy terms for free models go in
  `data/free-privacy.json`.

## Code changes

- Keep the OpenCode visual language: dark `#0c0c0c`, light `#fbfbfb`, mono
  labels, bracket indices, blue accent.
- Do not add a server, database, analytics, cookies, or paid-only models.
- Keep changes consistent with the existing structure and tests. Add tests for
  new logic.
- Run `npm run lint`, `npm test`, and `npm run build` before opening a pull
  request.

## Research job

- The research job uses the Free-LLM Router and only provider keys from the
  protected `research` environment.
- Never commit keys. See `docs/research-setup.md`.
- Verified values require an exact quote and two independent providers.

## Pull requests

- One topic per pull request.
- Explain the change and how you tested it.
- Link any related issue.
