#!/usr/bin/env node
/**
 * OpenCode Model Radar refresher.
 *
 * Sources:
 *  - https://opencode.ai/inference/go/v1/models   (structured Go catalog, mandatory)
 *  - https://opencode.ai/inference/v1/models      (full catalog, free models, mandatory)
 *  - https://opencode.ai/console/go               (published allowances, optional)
 *  - https://artificialanalysis.ai/               (index + evaluations, optional)
 *
 * Outputs:
 *  - public/data/latest.json
 *  - public/data/changes.json
 *
 * The two OpenCode catalogs are mandatory: if either fails, the run exits
 * without touching the published data. Artificial Analysis and the Go page are
 * optional and degrade to "not rated"/"not documented" with a stale marker.
 *
 * No API keys. Runs in GitHub Actions every 12 hours.
 */

import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  extractAAModel,
  fetchAASitemap,
  resolveAaSlug,
  AA_URLS,
} from './lib/artificial-analysis.mjs';
import { fetchText, mapWithConcurrency, readJson } from './lib/common.mjs';
import {
  buildBaseModel,
  buildChanges,
  computeStats,
  mergeChanges,
  sortModels,
} from './lib/dataset.mjs';
import { fetchOpenCodeSources, PLANS } from './lib/opencode.mjs';
import { recommend } from './lib/recommend.mjs';
import { validateChanges, validateDataset } from './validate-data.mjs';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'public', 'data');
const LATEST_PATH = path.join(DATA_DIR, 'latest.json');
const CHANGES_PATH = path.join(DATA_DIR, 'changes.json');
const ALIASES_PATH = path.join(ROOT, 'data', 'aliases.json');
const FREE_PRIVACY_PATH = path.join(ROOT, 'data', 'free-privacy.json');

const AA_CONCURRENCY = 4;

async function fetchAaProfile(slug, previousAA) {
  try {
    const { ok, text } = await fetchText(`${AA_URLS.base}${slug}`, {
      retries: 2,
      timeoutMs: 60_000,
    });
    if (!ok) {
      return { aa: previousAA, aaStatus: previousAA ? 'stale' : 'missing' };
    }
    const aa = extractAAModel(text, slug);
    if (!aa) {
      return { aa: previousAA, aaStatus: previousAA ? 'stale' : 'unrated' };
    }
    return {
      aa,
      aaStatus: aa.intelligenceIndex !== null ? 'rated' : 'unrated',
    };
  } catch (error) {
    console.warn(`AA fetch failed for ${slug}: ${error.message}`);
    return { aa: previousAA, aaStatus: previousAA ? 'stale' : 'error' };
  }
}

async function writeJsonAtomic(file, value) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const [aliases, freePrivacy, previous, previousChanges] = await Promise.all([
    readJson(ALIASES_PATH, {}),
    readJson(FREE_PRIVACY_PATH, {}),
    readJson(LATEST_PATH, null),
    readJson(CHANGES_PATH, { events: [] }),
  ]);
  const previousById = new Map((previous?.models ?? []).map((model) => [model.id, model]));
  const at = new Date().toISOString();

  console.log('Fetching OpenCode catalogs…');
  const opencode = await fetchOpenCodeSources();
  if (!Array.isArray(opencode.goModels) || !Array.isArray(opencode.allModels)) {
    throw new Error('OpenCode catalogs returned an unusable payload; refusing to write.');
  }

  const goById = new Map(opencode.goModels.map((model) => [model.id, model]));
  const allById = new Map(opencode.allModels.map((model) => [model.id, model]));
  const ids = new Set([...goById.keys(), ...allById.keys()]);

  const sitemap = await fetchAASitemap();
  if (!sitemap.ok) console.warn('Artificial Analysis sitemap unavailable; scores will be stale.');

  const models = [];
  for (const id of ids) {
    const goModel = goById.get(id);
    const allModel = allById.get(id);
    const model = buildBaseModel({
      id,
      goModel,
      allModel,
      goPageRow: opencode.goPageRows.get(id),
      freePrivacy,
    });
    if (!model) continue;

    const source = goModel ?? allModel;
    const aaSlug = resolveAaSlug(source, aliases, sitemap.slugs);
    model.aaSlug = aaSlug;
    if (!aaSlug) {
      model.aa = null;
      model.aaStatus = 'missing';
    } else if (!sitemap.ok) {
      model.aa = previousById.get(id)?.aa ?? null;
      model.aaStatus = model.aa ? 'stale' : 'missing';
    }
    models.push(model);
  }

  const withSlug = models.filter((model) => model.aaSlug && sitemap.ok);
  console.log(`Fetching ${withSlug.length} Artificial Analysis pages…`);
  const profiles = await mapWithConcurrency(withSlug, AA_CONCURRENCY, async (model) => {
    const previousAA = previousById.get(model.id)?.aa ?? null;
    return fetchAaProfile(model.aaSlug, previousAA);
  });

  withSlug.forEach((model, index) => {
    const profile = profiles[index];
    model.aa = profile.aa ?? null;
    model.aaStatus = profile.aaStatus;
  });

  const sorted = sortModels(models);
  const stats = computeStats(sorted);
  const recommendations = recommend(sorted);

  const rated = sorted.filter((model) => model.aaStatus === 'rated').length;
  const matched = sorted.filter((model) => model.aaSlug).length;

  const latest = {
    schemaVersion: 1,
    generatedAt: at,
    plans: {
      go: PLANS.go,
      goPlus: PLANS.goPlus,
    },
    sources: {
      ...opencode.sources,
      artificialAnalysis: {
        url: 'https://artificialanalysis.ai/',
        ok: sitemap.ok,
        sitemapSlugs: sitemap.slugs.size,
        matched,
        rated,
      },
    },
    stats,
    recommendations,
    models: sorted,
  };

  const changeSet = buildChanges(previous, sorted, at);
  const changes = mergeChanges({
    previousChanges,
    baseline: changeSet.baseline,
    events: changeSet.events,
    at,
  });

  const errors = [
    ...(await validateDataset(latest, { pathLabel: 'latest.json' })),
    ...(await validateChanges(changes, { pathLabel: 'changes.json' })),
  ];
  if (errors.length > 0) {
    console.error('Refusing to write an invalid snapshot:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  await Promise.all([
    writeJsonAtomic(LATEST_PATH, latest),
    writeJsonAtomic(CHANGES_PATH, changes),
  ]);

  console.log(
    `Wrote ${sorted.length} models (${stats.go} Go, ${stats.free} free, ${stats.rated} rated, ${stats.private} private).`,
  );
  console.log(`Change feed: ${changes.events.length} events${changes.baseline ? ' (baseline)' : ''}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
