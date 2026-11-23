import { load } from 'cheerio';
import {
  fetchJson,
  fetchText,
  parseAllowance,
  round,
  toNumberOrNull,
} from './common.mjs';

export const OPENCODE_URLS = {
  goModels: 'https://opencode.ai/inference/go/v1/models',
  allModels: 'https://opencode.ai/inference/v1/models',
  goPage: 'https://opencode.ai/console/go',
};

export const PLANS = {
  go: { name: 'Go', price: 10 },
  goPlus: { name: 'Go Plus', price: 40 },
};

export function isChatModel(model) {
  if (!model) return false;
  if (model.type && model.type !== 'chat') return false;
  if (model.recommended_api === 'systemone' || model.recommended_api === 'system-one') return false;
  if (/embedding|image-generation|nano-banana|imagine|image-2/i.test(model.id)) return false;
  if (/(^|-)decision(-|$)/.test(model.id) || model.id.startsWith('jev-')) return false;
  return true;
}

export function isFreeModel(model) {
  return (
    model?.cost?.text?.input?.price === 0 && model?.cost?.text?.output?.price === 0
  );
}

export function pricingOf(model) {
  const input = model?.cost?.text?.input?.price ?? null;
  const output = model?.cost?.text?.output?.price ?? null;
  const cacheRead = model?.cost?.text?.input?.cache?.read ?? null;
  return {
    input,
    output,
    cacheRead,
    blended:
      input !== null && output !== null ? round((input * 3 + output) / 4, 4) : null,
  };
}

export function parseGoPage(html) {
  const $ = load(html);
  const rows = new Map();

  $('tr[data-model]').each((_, element) => {
    const id = $(element).attr('data-model');
    if (!id) return;

    const requests = { go: null, goPlus: null, goUnlimited: false, goPlusUnlimited: false };
    $(element)
      .find('td[data-allowance-type="requests"] [data-layer="allowance"][data-plan]')
      .each((__, node) => {
        const plan = $(node).attr('data-plan');
        const raw =
          $(node).find('[data-layer="current-value"]').first().text().trim() ||
          $(node).text().trim();
        const parsed = parseAllowance(raw);
        if (plan === 'go') {
          requests.go = parsed.value;
          requests.goUnlimited = parsed.unlimited;
        } else if (plan === 'go-plus') {
          requests.goPlus = parsed.value;
          requests.goPlusUnlimited = parsed.unlimited;
        }
      });

    const monthly = { go: null, goPlus: null };
    $(element)
      .find('td[data-allowance-type="usage"] [data-layer="allowance"][data-plan]')
      .each((__, node) => {
        const plan = $(node).attr('data-plan');
        const raw =
          $(node).find('[data-layer="current-value"]').first().text().trim() ||
          $(node).text().trim();
        const parsed = parseAllowance(raw);
        if (plan === 'go') monthly.go = parsed.value;
        else if (plan === 'go-plus') monthly.goPlus = parsed.value;
      });

    rows.set(id, { requests, monthly });
  });

  return rows;
}

export function vendorName(canonicalId, fallback = '') {
  const vendor = String(canonicalId ?? '').split('/')[0].toLowerCase();
  const map = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    meta: 'Meta',
    deepseek: 'DeepSeek',
    zhipuai: 'Z.ai',
    moonshotai: 'Moonshot AI',
    minimax: 'MiniMax',
    alibaba: 'Alibaba',
    xai: 'xAI',
    tencent: 'Tencent',
    mistral: 'Mistral',
    nvidia: 'NVIDIA',
    reflection: 'Reflection',
    xiaomi: 'Xiaomi',
    typesafe: 'TypeSafe AI',
    meituan: 'Meituan',
    stepfun: 'StepFun',
    inclusionai: 'InclusionAI',
    'thinking-machines': 'Thinking Machines',
    recursive: 'Recursive',
    opencode: 'OpenCode',
    baai: 'BAAI',
    cohere: 'Cohere',
    voyageai: 'Voyage AI',
  };
  if (map[vendor]) return map[vendor];
  if (vendor) return vendor.charAt(0).toUpperCase() + vendor.slice(1);
  return fallback || 'Other';
}

export function privacyFor(model, freePrivacy) {
  const go = model.go;
  if (go && (go.training === true || go.training === false)) {
    return {
      training: go.training,
      zdr: go.zdr === true,
      retentionDays: go.zdr ? 0 : null,
      limitedRegions: go.limited_regions === true,
      source: 'OpenCode Go model API',
      note:
        go.training === true
          ? 'OpenCode lists this model as training on requests during its current period.'
          : go.zdr === true
            ? 'OpenCode lists this model as zero-retention and not training on requests.'
            : 'OpenCode lists this model as not training on requests, but not zero-retention.',
    };
  }

  const known = freePrivacy?.[model.id];
  if (known) {
    return {
      training: known.training ?? null,
      zdr: known.zdr ?? null,
      retentionDays: known.retentionDays ?? null,
      limitedRegions: false,
      source: 'OpenCode privacy documentation',
      note: known.note,
    };
  }

  return {
    training: null,
    zdr: null,
    retentionDays: null,
    limitedRegions: false,
    source: 'Not documented',
    note: 'Privacy terms for this free model are not documented yet. Check the OpenCode docs before sending sensitive data.',
  };
}

export async function fetchOpenCodeSources() {
  const [goCatalog, allCatalog] = await Promise.all([
    fetchJson(OPENCODE_URLS.goModels),
    fetchJson(OPENCODE_URLS.allModels),
  ]);

  const goPage = await fetchText(OPENCODE_URLS.goPage, {
    retries: 2,
    timeoutMs: 45_000,
  }).catch(() => ({ ok: false, status: 0, text: '' }));

  const goModels = (goCatalog.data ?? []).filter(isChatModel);
  const allModels = (allCatalog.data ?? []).filter(isChatModel);
  const goPageRows = goPage.ok ? parseGoPage(goPage.text) : new Map();

  return {
    goModels,
    allModels,
    goPageRows,
    sources: {
      opencodeGo: {
        url: OPENCODE_URLS.goModels,
        ok: true,
        count: goModels.length,
      },
      opencodeAll: {
        url: OPENCODE_URLS.allModels,
        ok: true,
        count: allModels.length,
      },
      goPage: {
        url: OPENCODE_URLS.goPage,
        ok: goPage.ok,
        rows: goPageRows.size,
      },
    },
  };
}

export { toNumberOrNull };
