import { readFile } from 'node:fs/promises';

export const USER_AGENT =
  'OpenCodeAnalysis/1.0 (+https://github.com/Valentjno/opencode-analysis; independent Go/free model dashboard)';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchText(url, { retries = 3, timeoutMs = 90_000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 404) return { ok: false, status: 404, text: '' };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { ok: true, status: response.status, text: await response.text() };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(800 * attempt);
    }
  }
  throw new Error(`Failed ${url}: ${lastError?.message ?? 'unknown error'}`);
}

export async function fetchJson(url) {
  const { text } = await fetchText(url);
  return JSON.parse(text);
}

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export const norm = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const round = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const toNumberOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[$,]/g, '').trim();
  if (!cleaned || cleaned === '∞' || cleaned === 'unlimited') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseAllowance(value) {
  const text = String(value ?? '').trim();
  if (text.includes('∞')) return { value: null, unlimited: true };
  return { value: toNumberOrNull(text), unlimited: false };
}

export async function mapWithConcurrency(items, limit, task) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
      await sleep(250);
    }
  });
  await Promise.all(workers);
  return results;
}

export function sortBy(values) {
  return values.slice().sort();
}
