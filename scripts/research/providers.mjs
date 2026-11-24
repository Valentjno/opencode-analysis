import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const REGISTRY_PATH = path.join(ROOT, 'data', 'research-providers.json')

export const ROUTER_DEFAULTS = {
  version: 1,
  log_requests: false,
  fallback_to_auto: false,
  catalog: { url: 'https://free-llm.com/catalog.json', refresh_hours: 8760 },
}

export async function loadProviderRegistry() {
  const parsed = JSON.parse(await readFile(REGISTRY_PATH, 'utf8'))
  const providers = Array.isArray(parsed?.providers) ? parsed.providers : []
  return providers.filter((provider) => typeof provider?.id === 'string' && Array.isArray(provider?.env))
}

export function isProviderConfigured(provider, env = process.env) {
  if (provider?.enabled === false) return false
  const names = Array.isArray(provider?.env) ? provider.env : []
  if (names.length === 0) return false
  return names.every((name) => Boolean(String(env[name] ?? '').trim()))
}

export function configuredProviders(registry, env = process.env) {
  return registry.filter((provider) => isProviderConfigured(provider, env))
}

export function buildRouterConfig(registry, env = process.env) {
  const providers = {}
  for (const provider of registry) {
    providers[provider.id] = {
      enabled: isProviderConfigured(provider, env),
      guest: false,
    }
  }
  return { ...ROUTER_DEFAULTS, providers }
}

export function providerSummary(registry, env = process.env) {
  const configured = configuredProviders(registry, env)
  const disabled = registry.filter((provider) => provider.enabled === false)
  return {
    configured: configured.map((provider) => ({ id: provider.id, label: provider.label })),
    count: configured.length,
    disabled: disabled.map((provider) => ({ id: provider.id, label: provider.label, note: provider.note ?? null })),
    enoughForVerification: configured.length >= 2,
  }
}

function parseArgs(argv) {
  const args = { check: false, write: null, json: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--check') args.check = true
    else if (arg === '--json') args.json = true
    else if (arg === '--write') {
      args.write = argv[index + 1] ?? null
      index += 1
    }
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const registry = await loadProviderRegistry()
  const summary = providerSummary(registry)

  if (args.write) {
    const config = buildRouterConfig(registry)
    await writeFile(args.write, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    console.log(`Wrote router config to ${args.write}`)
    console.log(`Enabled providers: ${summary.configured.map((provider) => provider.label).join(', ') || 'none'}`)
    return
  }

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  const labels = summary.configured.map((provider) => provider.label)
  console.log(`Configured providers (${summary.count}): ${labels.join(', ') || 'none'}`)
  if (summary.disabled.length > 0) {
    console.log(`Disabled providers: ${summary.disabled.map((provider) => provider.label).join(', ')}`)
  }
  if (summary.count === 0) {
    console.error('No provider keys are configured. Add at least one supported key to the research environment.')
    process.exitCode = 1
    return
  }
  if (!summary.enoughForVerification) {
    console.log('One provider is configured. The job will run but cannot publish verified values; two independent providers are required.')
  }
  if (args.check) return
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error?.message ?? String(error))
    process.exitCode = 1
  })
}
