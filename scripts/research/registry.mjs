import { readFileSync } from 'node:fs'

const CORE_URL = new URL('../../data/benchmarks-core.json', import.meta.url)
const SOURCES_URL = new URL('../../data/research-sources.json', import.meta.url)

const readJson = (url) => JSON.parse(readFileSync(url, 'utf8'))

export function coreBenchmarks() {
  return readJson(CORE_URL)
}

export function benchmarkById(id) {
  return coreBenchmarks().find((entry) => entry.id === id) ?? null
}

export function sourceForVendor(canonicalId) {
  if (typeof canonicalId !== 'string' || !canonicalId.includes('/')) return null
  const vendors = readJson(SOURCES_URL).vendors
  const match = Object.entries(vendors).find(([prefix]) => canonicalId === prefix || canonicalId.startsWith(`${prefix}/`))
  if (!match) return null
  return match[1]
}

export function normalizeValue(benchmarkId, raw, unitHint) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  const benchmark = benchmarkById(benchmarkId)
  if (!benchmark) return null

  if (benchmark.scale === 'fraction') {
    if (unitHint === 'raw') return null
    const percent = raw <= 1 ? raw * 100 : raw
    if (percent < 0 || percent > 100) return null
    return Math.round(percent * 100) / 100
  }

  if (benchmark.max !== null && raw > benchmark.max) return null
  return Math.round(raw * 10000) / 10000
}

export function deniedHosts() {
  return readJson(SOURCES_URL).deniedHosts
}
