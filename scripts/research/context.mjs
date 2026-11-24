const norm = (text) => String(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

// Names are compared on word boundaries so a column for "Hy4 flash Base" is not
// mistaken for the chat model "Hy4 flash Free".
const normalizeName = (text) => String(text ?? '')
  .toLowerCase()
  .replace(/\([^)]*\)/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ')

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function labelsFor(benchmark) {
  return unique([benchmark?.label, ...(benchmark?.aliases ?? [])]).map(norm)
}

function namesFor(model) {
  return unique([
    model?.name,
    model?.id,
    model?.canonicalId?.split('/').pop(),
  ]).map(normalizeName)
}

function headerMatchesModel(cell, model) {
  const header = normalizeName(cell)
  if (!header) return false
  return namesFor(model).some((name) => name === header)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function numberForms(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return []
  const forms = new Set([
    String(value),
    String(Math.round(value * 100) / 100),
    String(value).replace('.', ','),
    String(Number(value.toFixed(2))),
    Number(value.toFixed(2)).toString(),
  ])
  if (value <= 100) forms.add(String(Number((value / 100).toFixed(4))))
  return [...forms].filter((form) => form && form !== 'NaN')
}

export function containsNumber(text, value) {
  const haystack = String(text ?? '')
  return numberForms(value).some((form) => {
    const pattern = new RegExp(`(^|[^0-9.])${escapeRegExp(form)}([^0-9]|$)`)
    return pattern.test(haystack)
  })
}

function windowsAround(text, positions, { before = 2_500, after = 1_200 } = {}) {
  return positions.map((position) => ({
    start: Math.max(0, position - before),
    end: Math.min(text.length, position + after),
  }))
}

function mergeWindows(windows, limit) {
  const sorted = windows.sort((a, b) => a.start - b.start)
  const merged = []
  for (const window of sorted) {
    const last = merged[merged.length - 1]
    if (last && window.start <= last.end + 50) last.end = Math.max(last.end, window.end)
    else merged.push({ ...window })
  }
  const parts = []
  let used = 0
  for (const window of merged) {
    const room = limit - used
    if (room <= 200) break
    parts.push(window)
    used += window.end - window.start + 5
  }
  return parts
}

function headerLineStart(text, hit, names) {
  const lineStart = text.lastIndexOf('\n', hit) + 1
  const lineEnd = text.indexOf('\n', hit)
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd)
  if (!line.includes('|')) return null
  let start = lineStart
  for (let depth = 0; depth < 80; depth += 1) {
    if (start <= 0) break
    const previousEnd = start - 1
    const previousStart = text.lastIndexOf('\n', previousEnd - 1) + 1
    const previous = text.slice(previousStart, previousEnd)
    if (previous.includes('|') && names.some((name) => normalizeName(previous).includes(name))) {
      return previousStart
    }
    start = previousStart
  }
  return null
}

export function focusExcerpt(text, model, benchmark, { max = 6_000, before = 2_500, after = 1_500 } = {}) {
  const source = String(text ?? '')
  if (!source) return ''
  const lower = source.toLowerCase()
  const labels = labelsFor(benchmark)
  const names = namesFor(model)

  const hits = []
  for (const label of labels) {
    let from = 0
    while (hits.length < 24) {
      const index = lower.indexOf(label, from)
      if (index === -1) break
      hits.push(index)
      from = index + label.length
    }
  }

  if (hits.length) {
    const windows = hits.map((hit) => {
      const header = headerLineStart(source, hit, names)
      const start = header === null ? Math.max(0, hit - before) : Math.min(Math.max(0, hit - before), header)
      return { start, end: Math.min(source.length, hit + after) }
    })
    // Pull the nearest model-name mention into each window so table headers survive.
    for (const window of windows) {
      const head = lower.slice(Math.max(0, window.start - 2_500), window.start)
      let best = -1
      for (const name of names) {
        const index = head.lastIndexOf(name)
        if (index > best) best = index
      }
      if (best !== -1) window.start = Math.max(0, window.start - (head.length - best) - 120)
    }
    const merged = mergeWindows(windows, max)
    return merged.map((window) => source.slice(window.start, window.end).trim()).join('\n...\n').slice(0, max)
  }

  const nameHits = []
  for (const name of names) {
    let from = 0
    while (nameHits.length < 8) {
      const index = lower.indexOf(name, from)
      if (index === -1) break
      nameHits.push(index)
      from = index + name.length
    }
  }
  if (nameHits.length) {
    const merged = mergeWindows(windowsAround(source, nameHits, { before: 1_200, after: 2_500 }), max)
    return merged.map((window) => source.slice(window.start, window.end).trim()).join('\n...\n').slice(0, max)
  }

  return source.slice(0, max)
}

function lineHasLabel(line, labels) {
  const normalized = ` ${normalizeName(line)} `
  return labels.some((label) => {
    const target = normalizeName(label)
    return Boolean(target) && normalized.includes(` ${target} `)
  })
}

export function mentionsBenchmark(text, benchmark) {
  return lineHasLabel(text, labelsFor(benchmark))
}

export function findQuote(text, model, benchmark, value) {
  const source = String(text ?? '')
  if (!source) return null
  const labels = labelsFor(benchmark)
  const names = namesFor(model)
  const lines = source.split('\n')

  for (const line of lines) {
    if (!line.includes('|') || !lineHasLabel(line, labels) || !containsNumber(line, value)) continue
    if (norm(line).length > 400) {
      const lower = line.toLowerCase()
      const label = labels.map((item) => lower.indexOf(item)).find((index) => index !== -1)
      const numeric = numberForms(value)
        .map((form) => line.indexOf(form))
        .find((index) => index !== -1)
      const start = Math.max(0, Math.min(label ?? numeric ?? 0, numeric ?? 0) - 120)
      const end = Math.min(line.length, Math.max(label ?? 0, numeric ?? 0) + 240)
      return line.slice(start, end).trim()
    }
    return line.trim().slice(0, 800)
  }

  const sentences = source.split(/(?<=[.!?])\s+/)
  for (let size = 1; size <= 3; size += 1) {
    for (let index = 0; index <= sentences.length - size; index += 1) {
      const window = sentences.slice(index, index + size).join(' ').trim()
      const normalized = norm(window)
      if (
        names.some((name) => normalized.includes(name)) &&
        lineHasLabel(window, labels) &&
        containsNumber(window, value)
      ) {
        return window.slice(0, 800)
      }
    }
  }

  const lower = source.toLowerCase()
  for (const label of labels) {
    const index = lower.indexOf(label)
    if (index === -1) continue
    const nearby = source.slice(Math.max(0, index - 300), Math.min(source.length, index + 500))
    if (containsNumber(nearby, value)) return nearby.trim()
  }

  return null
}

function cellsOf(line) {
  return String(line ?? '').split('|').map((cell) => cell.trim())
}

function numbersInCell(cell) {
  return (String(cell ?? '').match(/-?\d+(?:[.,]\d+)?/g) ?? []).map((value) => Number(value.replace(',', '.')))
}

function cellMatchesValue(cell, value) {
  const numbers = numbersInCell(cell)
  if (numbers.length !== 1) return false
  return Math.abs(numbers[0] - value) < 0.0001
}

export function tableColumnMatches(text, model, benchmark, value) {
  const source = String(text ?? '')
  if (!source) return false
  const labels = labelsFor(benchmark)
  const lines = source.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.includes('|') || !lineHasLabel(line, labels)) continue

    const row = cellsOf(line)
    const valueIndexes = row
      .map((cell, cellIndex) => (containsNumber(cell, value) && cellMatchesValue(cell, value) ? cellIndex : -1))
      .filter((cellIndex) => cellIndex !== -1)
    if (!valueIndexes.length) continue

    for (let headerIndex = index - 1; headerIndex >= Math.max(0, index - 60); headerIndex -= 1) {
      const header = lines[headerIndex]
      if (!header.includes('|')) continue
      const headerCells = cellsOf(header)
      const modelIndex = headerCells.findIndex((cell) => headerMatchesModel(cell, model))
      if (modelIndex === -1) continue
      if (valueIndexes.includes(modelIndex)) return true
      break
    }
  }
  return false
}
