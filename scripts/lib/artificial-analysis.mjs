import { fetchText, norm, round } from './common.mjs';

export const AA_URLS = {
  sitemap: 'https://artificialanalysis.ai/sitemap.xml',
  base: 'https://artificialanalysis.ai/models/',
};

export const EVAL_LABELS = {
  gpqa: 'GPQA Diamond',
  hle: "Humanity's Last Exam",
  hleDiamond: 'HLE Diamond',
  aime25: 'AIME 2025',
  math500: 'Math 500',
  mmluPro: 'MMLU-Pro',
  livecodebench: 'LiveCodeBench',
  scicode: 'SciCode',
  terminalBench21: 'Terminal-Bench 2.1',
  terminalBench40: 'Terminal-Bench 4.0',
  terminalBenchScience: 'Terminal-Bench Science',
  frontierCode: 'FrontierCode',
  frontierCode20: 'FrontierCode 2.0',
  critpt: 'CritPt',
  critptAgenticHard: 'CritPt Agentic Hard',
  tau2: 'Tau2',
  tauBanking: 'Tau Banking',
  ifbench: 'IFBench',
  mmmuPro: 'MMMU-Pro',
  healthbench: 'HealthBench',
  healthbenchProfessional: 'HealthBench Professional',
  automationBenchPartialScore: 'AutomationBench',
  enterpriseOpsGym: 'Enterprise Ops Gym',
  itBenchSre: 'ITBench SRE',
  gdpval: 'GDPval',
  gdpPdfAllPass: 'GDP PDF',
  omniscience: 'Omniscience',
  lcr: 'Long Context Reasoning',
  analystAgent: 'Analyst Agent',
  apexAgents: 'Apex Agents',
  vialsScore: 'VIALS',
  mkaClimbWsr: 'MKA',
};

export const CAPABILITY_LABELS = {
  financeAndAccounting: 'Finance & Accounting',
  strategyAndOps: 'Strategy & Ops',
  legal: 'Legal',
  healthcareAndMedical: 'Healthcare & Medical',
  engineering: 'Engineering',
  economics: 'Economics',
};

export function nextFrames(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)<\/script>/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      chunks.push(JSON.parse(`"${match[1]}"`));
    } catch {
      /* skip malformed frame */
    }
  }
  return chunks.join('');
}

export function sliceBalancedArray(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

export function extractAAModel(html, slug) {
  const blob = nextFrames(html);
  const arrays = [];
  const marker = '"initialModels":';
  let cursor = 0;

  while (true) {
    const found = blob.indexOf(marker, cursor);
    if (found === -1) break;
    let start = found + marker.length;
    while (start < blob.length && blob[start] !== '[') start += 1;
    const raw = sliceBalancedArray(blob, start);
    if (raw) {
      try {
        arrays.push(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
    cursor = found + marker.length;
  }

  const flat = arrays.flat();
  const seen = new Set();
  const matches = [];
  for (const model of flat) {
    if (!model || typeof model !== 'object') continue;
    const modelSlug = model.slug ?? model.release?.slug;
    if (modelSlug !== slug) continue;
    const key = model.id ?? `${modelSlug}:${model.suffix ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(model);
  }

  if (matches.length === 0) return null;

  const score = (model) => {
    let total = 0;
    if (model.intelligenceIndex !== null && model.intelligenceIndex !== undefined) total += 1000;
    total += Number(model.intelligenceIndex ?? 0);
    if (model.chartDefaultSelected) total += 2;
    if (!model.deprecated) total += 1;
    return total;
  };

  const model = matches.sort((a, b) => score(b) - score(a))[0];

  const capabilities = {};
  for (const [key, label] of Object.entries(CAPABILITY_LABELS)) {
    const value = model.capabilities?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) capabilities[label] = round(value, 2);
  }

  const rawScores = model.scores && typeof model.scores === 'object' ? model.scores : {};
  const evals = {};
  for (const [key, label] of Object.entries(EVAL_LABELS)) {
    const value = rawScores[key] ?? model[key];
    if (typeof value === 'number' && Number.isFinite(value)) evals[label] = round(value, 4);
  }

  const costObject = model.intelligenceIndexCostPerTask;
  const costPerTask =
    typeof costObject === 'number'
      ? costObject
      : typeof costObject?.cost?.total === 'number'
        ? costObject.cost.total
        : typeof costObject?.total === 'number'
          ? costObject.total
          : null;

  return {
    slug,
    url: `${AA_URLS.base}${slug}`,
    variant: model.name ?? slug,
    suffix: model.suffix ?? null,
    effort: model.effort?.label ?? null,
    releaseDate: model.releaseDate ?? null,
    deprecated: model.deprecated === true,
    deprecatedTo: model.release?.deprecatedTo ?? null,
    intelligenceIndex:
      typeof model.intelligenceIndex === 'number' ? round(model.intelligenceIndex, 2) : null,
    capabilities,
    evals,
    omniscience: typeof model.omniscience === 'number' ? round(model.omniscience, 2) : null,
    contextWindow: model.contextWindowTokens ?? null,
    outputSpeed: typeof model.outputSpeed === 'number' ? round(model.outputSpeed, 1) : null,
    timeToFirstToken:
      typeof model.timeToFirstToken === 'number' ? round(model.timeToFirstToken, 2) : null,
    costPerTask: costPerTask === null ? null : round(costPerTask, 4),
    aaPrice:
      model.price1mInputTokens !== null && model.price1mInputTokens !== undefined
        ? {
            input: model.price1mInputTokens,
            output: model.price1mOutputTokens,
          }
        : null,
    isOpenWeights: model.isOpenWeights === true,
  };
}

export function parseAASitemap(xml) {
  const slugs = new Set();
  const re = /<loc>([^<]+)<\/loc>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const slug = match[1].match(/artificialanalysis\.ai\/models\/([^/?#]+)/)?.[1];
    if (slug) slugs.add(slug);
  }
  return slugs;
}

export async function fetchAASitemap() {
  const response = await fetchText(AA_URLS.sitemap, { retries: 2, timeoutMs: 45_000 }).catch(
    () => ({ ok: false, status: 0, text: '' }),
  );
  return {
    ok: response.ok,
    slugs: response.ok ? parseAASitemap(response.text) : new Set(),
  };
}

export function resolveAaSlug(model, aliases, sitemapSlugs) {
  if (Object.prototype.hasOwnProperty.call(aliases, model.id)) {
    return aliases[model.id];
  }

  const candidates = new Set();
  if (model.canonical_id) candidates.add(norm(model.canonical_id.split('/').pop()));
  candidates.add(norm(model.id));
  candidates.add(norm(model.name));
  candidates.add(
    norm(
      String(model.name ?? '')
        .replace(/\s*\(.*?\)/g, '')
        .replace(/\b(free|contributor|preview|new)\b/gi, ''),
    ),
  );

  for (const candidate of candidates) {
    if (candidate && sitemapSlugs.has(candidate)) return candidate;
  }
  return null;
}
