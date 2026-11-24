import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectGaps } from './gaps.mjs'
import { applyOverrides, markStale, mergeResearch } from './store.mjs'
import { officialUrlAllowed, search } from './search.mjs'
import { fetchPage } from './fetch-page.mjs'
import { extract } from './extract.mjs'
import { mentionsBenchmark } from './context.mjs'
import { verifyCandidate } from './verify.mjs'
import { listRouterModels } from './router-client.mjs'
import { rankTargets } from './targets.mjs'
import { redact } from './redact.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function toleranceFor(benchmark) {
  return benchmark.unit === '%' ? 0.05 : 0.0001
}

function maxTokensFor(target) {
  return target.provider === 'groq-cloud' ? 3_000 : 6_000
}

export async function runResearch({
  snapshot,
  research,
  overrides,
  fetchImpl = fetch,
  chatImpl = fetch,
  availableModels,
  maxModels = 5,
  maxPerModel = 3,
  maxCallsPerGap = 6,
  now = new Date().toISOString(),
} = {}) {
  const prepared = applyOverrides(markStale(research, now), overrides, snapshot)
  const gaps = selectGaps({ snapshot, research: prepared, overrides, now, maxModels, maxPerModel })
  const accepted = []
  const reasons = {}

  const reject = (reason) => {
    reasons[reason] = (reasons[reason] ?? 0) + 1
  }

  let targets = availableModels ? rankTargets(availableModels) : null
  if (!targets) {
    try {
      targets = rankTargets(await listRouterModels({ fetchImpl: chatImpl }))
    } catch {
      targets = []
    }
  }

  if (!targets.length) {
    for (let index = 0; index < gaps.length; index += 1) reject('no-router-models')
  }

  for (const gap of gaps) {
    if (!targets.length) break
    try {
      const results = await search({ model: gap.model, benchmark: gap.benchmark, fetchImpl })
      let acceptedForGap = false

      for (const result of results.slice(0, 6)) {
        const page = await fetchPage(result.url, {
          fetchImpl,
          allowedUrl: (next) => officialUrlAllowed(next, gap.model.canonicalId),
        })
        if (!page) {
          reject('fetch-failed')
          continue
        }
        if (!mentionsBenchmark(page.text, gap.benchmark)) {
          reject('page-missing-benchmark')
          continue
        }

        const withUrl = { ...page, sourceUrl: result.url }
        const candidates = []
        let calls = 0
        let conflicting = false

        const attempt = async (target) => {
          if (calls >= maxCallsPerGap) return null
          calls += 1
          try {
            const candidate = await extract({
              model: gap.model,
              benchmark: gap.benchmark,
              page: withUrl,
              profile: target.id,
              routerModel: target.id,
              fetchImpl: chatImpl,
              maxTokens: maxTokensFor(target),
            })
            if (!candidate) {
              reject('malformed-extraction')
              return null
            }
            return { ...candidate, sourceUrl: result.url }
          } catch (error) {
            reject('error')
            console.warn(redact(`Research failed for ${gap.model.id}/${gap.benchmark.id} on ${target.id}: ${error.message}`))
            return null
          }
        }

        for (const target of targets) {
          if (candidates.length >= 1 || calls >= maxCallsPerGap) break
          const candidate = await attempt(target)
          if (candidate) candidates.push(candidate)
        }

        if (!candidates.length) continue
        const first = candidates[0]
        if (!first.provider || first.provider === 'unknown') {
          reject('single-source')
          continue
        }

        const tolerance = toleranceFor(gap.benchmark)
        for (const target of targets) {
          if (calls >= maxCallsPerGap || candidates.length >= 2) break
          if (target.provider === first.provider) continue
          const candidate = await attempt(target)
          if (!candidate) continue
          if (!candidate.provider || candidate.provider === first.provider) continue
          if (Math.abs(candidate.value - first.value) <= tolerance) {
            candidates.push(candidate)
            break
          }
          conflicting = true
        }

        if (candidates.length < 2) {
          reject(conflicting ? 'conflict' : 'single-source')
          continue
        }

        const verdict = verifyCandidate({
          candidate: candidates[0],
          other: candidates[1],
          model: gap.model,
          benchmark: gap.benchmark,
          pageText: page.text,
          pageHash: page.hash,
          now,
        })
        if (verdict.status !== 'verified') {
          reject(verdict.status)
          continue
        }
        accepted.push(verdict.entry)
        acceptedForGap = true
        break
      }

      if (!acceptedForGap && accepted.length === 0 && Object.keys(reasons).length === 0) reject('no-source')
    } catch (error) {
      reject('error')
      console.warn(redact(`Research failed for ${gap.model.id}/${gap.benchmark.id}: ${error.message}`))
    }
  }

  const feed = mergeResearch({ previous: prepared, overrides, candidates: accepted, now })
  const rejected = Object.values(reasons).reduce((sum, count) => sum + count, 0)
  feed.run = {
    status: accepted.length ? 'ok' : 'partial',
    modelsConsidered: snapshot?.models?.length ?? 0,
    modelsResearched: gaps.length,
    accepted: accepted.length,
    rejected,
    reasons,
  }
  return feed
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index].startsWith('--')) {
      const key = argv[index].slice(2)
      const next = argv[index + 1]
      if (next && !next.startsWith('--')) {
        args[key] = next
        index += 1
      } else args[key] = true
    }
  }
  return args
}

export async function main() {
  const args = parseArgs(process.argv.slice(2))
  const [snapshot, research, overrides] = await Promise.all([
    readFile(path.join(ROOT, 'public', 'data', 'latest.json'), 'utf8').then(JSON.parse),
    readFile(path.join(ROOT, 'public', 'data', 'research.json'), 'utf8').then(JSON.parse).catch(() => null),
    readFile(path.join(ROOT, 'data', 'research-overrides.json'), 'utf8').then(JSON.parse).catch(() => ({ entries: [] })),
  ])

  const feed = await runResearch({
    snapshot,
    research: research ?? {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      run: { status: 'ok', modelsConsidered: 0, modelsResearched: 0, accepted: 0, rejected: 0, reasons: {} },
      models: [],
    },
    overrides,
    maxModels: Number(args['max-models'] ?? args.maxModels ?? 5),
    maxPerModel: 3,
  })

  console.log(
    `Research: ${feed.run.accepted} accepted, ${feed.run.rejected} rejected, ${feed.run.modelsResearched} pairs. Reasons: ${JSON.stringify(feed.run.reasons)}`,
  )
  if (args['dry-run']) return
  if (feed.run.accepted === 0) {
    console.log('No verified values; keeping the existing research feed unchanged.')
    return
  }

  const output = path.join(ROOT, 'public', 'data', 'research.json')
  await mkdir(path.dirname(output), { recursive: true })
  const temporary = `${output}.tmp`
  await writeFile(temporary, `${JSON.stringify(feed, null, 2)}\n`, 'utf8')
  await rename(temporary, output)
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((error) => {
    console.error(redact(error?.message ?? String(error)))
    process.exitCode = 1
  })
}
