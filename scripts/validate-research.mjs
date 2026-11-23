#!/usr/bin/env node
/**
 * Validate the published external benchmark research feed.
 * Usage: node scripts/validate-research.mjs [research.json]
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { benchmarkById, deniedHosts, sourceForVendor } from './research/registry.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA = path.join(ROOT, 'specs', '001-model-radar-dashboard', 'contracts', 'research.schema.json')
const ajv = new Ajv2020({ allErrors: true, strict: false })
let validate = null

function validator() {
  if (!validate) validate = ajv.compile(JSON.parse(readFileSync(SCHEMA, 'utf8')))
  return validate
}

function snapshotIndex() {
  try {
    const snapshot = JSON.parse(readFileSync(path.join(ROOT, 'public', 'data', 'latest.json'), 'utf8'))
    return new Map(snapshot.models.map((model) => [model.id, model.canonicalId]))
  } catch {
    return null
  }
}

export function validateResearch(feed) {
  const errors = []
  const check = validator()
  if (!check(feed)) {
    for (const error of check.errors ?? []) {
      errors.push(`research: ${error.instancePath || '/'} ${error.message}`)
    }
  }
  if (!feed || typeof feed !== 'object' || !Array.isArray(feed.models)) return errors

  const indexed = snapshotIndex()
  const ids = indexed ? new Set(indexed.keys()) : null
  const denied = new Set(deniedHosts())

  for (const model of feed.models) {
    if (ids && !ids.has(model.id)) {
      errors.push(`research: unknown model id "${model.id}" is not in latest.json.`)
    }
    const seen = new Set()
    const canonicalId = indexed?.get(model.id) ?? null
    const source = sourceForVendor(canonicalId)

    for (const entry of model.benchmarks ?? []) {
      const label = `${model.id}/${entry.benchmarkId}`
      if (seen.has(entry.benchmarkId)) {
        errors.push(`research: duplicate benchmarkId "${entry.benchmarkId}" for ${model.id}.`)
      }
      seen.add(entry.benchmarkId)

      if (!benchmarkById(entry.benchmarkId)) {
        errors.push(`research: ${label} uses an unknown benchmarkId.`)
      }
      if (typeof entry.value !== 'number' || !Number.isFinite(entry.value)) {
        errors.push(`research: ${label} has a non-finite value.`)
      }
      if (typeof entry.sourceUrl !== 'string' || !entry.sourceUrl.startsWith('https://')) {
        errors.push(`research: ${label} sourceUrl must use https.`)
      } else {
        try {
          const url = new URL(entry.sourceUrl)
          if (denied.has(url.hostname.toLowerCase())) {
            errors.push(`research: ${label} uses a denied source host ${url.hostname}.`)
          }
          if (source) {
            const allowedHost = source.hosts.some((host) => url.hostname.toLowerCase().endsWith(host))
            const allowedOrg =
              (url.hostname === 'github.com' || url.hostname === 'huggingface.co' || url.hostname === 'www.github.com') &&
              source.orgs.some((org) => entry.sourceUrl.includes(`/${org}/`))
            if (!allowedHost && !allowedOrg) {
              errors.push(`research: ${label} source is not an official host or org for ${source.vendor}.`)
            }
          }
        } catch {
          errors.push(`research: ${label} sourceUrl is not a valid URL.`)
        }
      }
    }
  }
  return errors
}

async function main() {
  const file = process.argv[2] ?? path.join(ROOT, 'public', 'data', 'research.json')
  let feed
  try {
    feed = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    console.error(`Cannot read ${file}: ${error.message}`)
    process.exitCode = 1
    return
  }
  const errors = validateResearch(feed)
  if (errors.length) {
    console.error(`✗ ${errors.length} research validation error${errors.length === 1 ? '' : 's'}:`)
    for (const error of errors) console.error(`  - ${error}`)
    process.exitCode = 1
    return
  }
  console.log(`✓ ${file} is valid.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
