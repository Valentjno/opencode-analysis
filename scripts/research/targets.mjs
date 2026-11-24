const PROVIDER_PRIORITY = [
  'groq-cloud',
  'kilo-gateway',
  'cloudflare-workers-ai',
  'openrouter',
  'requesty',
]

const PREFERRED_MODELS = [
  /qwen3\.?8-27b/i,
  /gpt-oss-120b/i,
  /kilo-auto/i,
  /reflection\/beam/i,
  /ernie-5\.5-flash/i,
  /gemma-4-31b/i,
  /llama-3\.3-70b/i,
  /mistral-small/i,
  /ling-3\.2-flash/i,
]

const HEAVY_REASONING = /reasoning|nemotron|\br1\b|qwq|thinking|lightning|ultra|super-vl/i

function providerRank(provider) {
  const index = PROVIDER_PRIORITY.indexOf(provider)
  return index === -1 ? PROVIDER_PRIORITY.length : index
}

function modelRank(id) {
  const index = PREFERRED_MODELS.findIndex((pattern) => pattern.test(id))
  if (index !== -1) return index
  return HEAVY_REASONING.test(id) ? 100 : 50
}

export function rankTargets(models) {
  const list = Array.isArray(models) ? models : models?.data
  if (!Array.isArray(list)) return []
  const seen = new Set()
  const targets = list
    .filter((model) => typeof model?.id === 'string' && model.id.includes('/'))
    .filter((model) => {
      const provider = model.owned_by
      if (typeof provider !== 'string' || !provider) return false
      return model.id.startsWith(`${provider}/`)
    })
    .filter((model) => {
      if (seen.has(model.id)) return false
      seen.add(model.id)
      return true
    })
    .map((model) => ({
      id: model.id,
      provider: model.owned_by,
    }))
    .sort((a, b) => {
      const byModel = modelRank(a.id) - modelRank(b.id)
      if (byModel !== 0) return byModel
      const byProvider = providerRank(a.provider) - providerRank(b.provider)
      if (byProvider !== 0) return byProvider
      return a.id.localeCompare(b.id)
    })

  // Round-robin across providers so a rate-limited first choice cannot hide a
  // second provider behind every remaining model of the first one.
  const buckets = new Map()
  for (const target of targets) {
    if (!buckets.has(target.provider)) buckets.set(target.provider, [])
    buckets.get(target.provider).push(target)
  }
  const providers = [...buckets.keys()].sort((a, b) => providerRank(a) - providerRank(b))
  const ranked = []
  while (ranked.length < targets.length) {
    for (const provider of providers) {
      const bucket = buckets.get(provider)
      if (bucket.length) ranked.push(bucket.shift())
    }
  }
  return ranked
}

export function targetsForOtherProvider(targets, provider) {
  return (targets ?? []).filter((target) => target.provider !== provider)
}
