const normalize = (text) => String(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

function numberForms(value) {
  const forms = new Set()
  if (typeof value !== 'number' || !Number.isFinite(value)) return forms
  const fixed = Number.isInteger(value) ? String(value) : String(value)
  forms.add(fixed)
  forms.add(fixed.replace('.', ','))
  forms.add(String(Math.round(value * 100) / 100))
  forms.add(String(value / 100))
  return forms
}

function quoteContainsFacts(candidate, model, benchmark) {
  const text = normalize(candidate.quote)
  const names = [model.name, model.id, model.canonicalId?.split('/').pop()]
    .filter(Boolean)
    .map(normalize)
  const hasModel = names.some((name) => text.includes(name))
  const labels = [benchmark.label, ...benchmark.aliases].map(normalize)
  const hasBenchmark = labels.some((label) => text.includes(label))
  const forms = [...numberForms(candidate.value)].map(normalize)
  const hasValue = forms.some((form) => text.includes(form))
  return hasModel && hasBenchmark && hasValue
}

function agrees(candidate, other, benchmark) {
  if (typeof other?.value !== 'number' || !Number.isFinite(other.value)) return false
  const tolerance = benchmark.unit === '%' ? 0.05 : Math.max(0.0001, Math.abs(candidate.value) * 0.001)
  return Math.abs(candidate.value - other.value) <= tolerance
}

export function verifyCandidate({ candidate, other, model, benchmark, pageText, pageHash, now = new Date().toISOString() }) {
  if (!candidate || !other || !candidate.provider || candidate.provider === other.provider) {
    return { status: 'single-source' }
  }
  if (!quoteContainsFacts(candidate, model, benchmark)) return { status: 'quote-mismatch' }
  if (!normalize(pageText).includes(normalize(candidate.quote))) return { status: 'quote-mismatch' }
  if (!agrees(candidate, other, benchmark)) return { status: 'conflict' }

  return {
    status: 'verified',
    entry: {
      modelId: model.id,
      benchmarkId: benchmark.id,
      label: benchmark.label,
      value: candidate.value,
      unit: benchmark.unit,
      sourceUrl: candidate.sourceUrl,
      sourceTitle: model.name,
      quote: candidate.quote,
      retrievedAt: now,
      sourceHash: pageHash ?? 'sha256:unknown',
      method: 'two-provider+quote',
      confidence: 'high',
      modelsUsed: [candidate.provider, other.provider],
      status: 'verified',
      stale: false,
      supersededByAA: false,
    },
  }
}
