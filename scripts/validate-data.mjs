#!/usr/bin/env node
/**
 * Validate the published dataset and change feed against their contracts, plus
 * the semantic rules that JSON Schema cannot express.
 *
 * Usage: node scripts/validate-data.mjs [latest.json] [changes.json]
 * Exit code 0 on success, 1 with a readable list of failures otherwise.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACTS = path.join(ROOT, 'specs', '001-model-radar-dashboard', 'contracts');

const SCHEMA_FILES = {
  dataset: path.join(CONTRACTS, 'dataset.schema.json'),
  changes: path.join(CONTRACTS, 'changes.schema.json'),
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
let validatorsPromise = null;

async function validators() {
  if (!validatorsPromise) {
    validatorsPromise = (async () => {
      const [dataset, changes] = await Promise.all([
        readFile(SCHEMA_FILES.dataset, 'utf8').then(JSON.parse),
        readFile(SCHEMA_FILES.changes, 'utf8').then(JSON.parse),
      ]);
      return {
        dataset: ajv.compile(dataset),
        changes: ajv.compile(changes),
      };
    })();
  }
  return validatorsPromise;
}

function formatAjvErrors(errors, prefix) {
  return (errors ?? []).map(
    (error) => `${prefix}${error.instancePath || '/'} ${error.message}`,
  );
}

const isFiniteNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value);

const isNonNegative = (value) => value === null || (isFiniteNumber(value) && value >= 0);

function checkNumbers(model, errors) {
  const { pricing, context, maxOutput, aa } = model;
  for (const [field, value] of Object.entries({
    'pricing.input': pricing?.input,
    'pricing.output': pricing?.output,
    'pricing.cacheRead': pricing?.cacheRead,
    'pricing.blended': pricing?.blended,
  })) {
    if (!isNonNegative(value)) errors.push(`${model.id}: ${field} must be null or ≥ 0.`);
  }
  for (const [field, value] of Object.entries({ context, maxOutput })) {
    if (!(value === null || (Number.isInteger(value) && value >= 0))) {
      errors.push(`${model.id}: ${field} must be null or a non-negative integer.`);
    }
  }
  if (aa) {
    if (!(aa.contextWindow === null || (Number.isInteger(aa.contextWindow) && aa.contextWindow >= 0))) {
      errors.push(`${model.id}: aa.contextWindow must be null or a non-negative integer.`);
    }
    if (aa.intelligenceIndex !== null && aa.intelligenceIndex !== undefined) {
      if (!isFiniteNumber(aa.intelligenceIndex) || aa.intelligenceIndex < 0 || aa.intelligenceIndex > 100) {
        errors.push(`${model.id}: aa.intelligenceIndex must be between 0 and 100.`);
      }
    }
  }
  if (model.go) {
    for (const [field, value] of Object.entries({
      'go.monthly.go': model.go.monthly?.go,
      'go.monthly.goPlus': model.go.monthly?.goPlus,
      'go.monthly.goTeams': model.go.monthly?.goTeams,
      'go.requests5h.go': model.go.requests5h?.go,
      'go.requests5h.goPlus': model.go.requests5h?.goPlus,
    })) {
      if (!isNonNegative(value)) errors.push(`${model.id}: ${field} must be null or ≥ 0.`);
    }
  }
}

function expectedStats(models) {
  const rated = models.filter(
    (model) => typeof model.aa?.intelligenceIndex === 'number',
  ).length;
  return {
    total: models.length,
    go: models.filter((model) => model.access.go).length,
    free: models.filter((model) => model.access.free).length,
    both: models.filter((model) => model.access.go && model.access.free).length,
    rated,
    unrated: models.length - rated,
    private: models.filter(
      (model) => model.privacy?.training === false && model.privacy?.zdr === true,
    ).length,
    trains: models.filter((model) => model.privacy?.training === true).length,
    limitedRegions: models.filter((model) => model.access.limitedRegions).length,
  };
}

export async function validateDataset(dataset, { pathLabel = 'dataset' } = {}) {
  const errors = [];
  const { dataset: validate } = await validators();

  if (!validate(dataset)) {
    errors.push(...formatAjvErrors(validate.errors, `${pathLabel}: `));
  }
  if (!dataset || typeof dataset !== 'object') return errors;

  const models = Array.isArray(dataset.models) ? dataset.models : [];
  const ids = new Set();

  for (const model of models) {
    if (ids.has(model.id)) errors.push(`${pathLabel}: duplicate model id "${model.id}".`);
    ids.add(model.id);

    if (!model.access?.go && !model.access?.free) {
      errors.push(`${pathLabel}: ${model.id} is neither Go nor free.`);
    }
    if (
      !model.access?.go &&
      typeof model.pricing?.input === 'number' &&
      model.pricing.input > 0 &&
      typeof model.pricing?.output === 'number' &&
      model.pricing.output > 0
    ) {
      errors.push(`${pathLabel}: ${model.id} is paid but not in Go.`);
    }
    checkNumbers(model, errors);

    if (model.aaStatus === 'rated' && !isFiniteNumber(model.aa?.intelligenceIndex)) {
      errors.push(`${pathLabel}: ${model.id} is rated but has no Intelligence Index.`);
    }
    if (
      (model.aaStatus === 'unrated' || model.aaStatus === 'missing') &&
      isFiniteNumber(model.aa?.intelligenceIndex)
    ) {
      errors.push(`${pathLabel}: ${model.id} is ${model.aaStatus} but has an Intelligence Index.`);
    }
  }

  if (dataset.sources && (dataset.sources.opencodeGo?.ok !== true || dataset.sources.opencodeAll?.ok !== true)) {
    errors.push(`${pathLabel}: both OpenCode catalogs must be ok in a written snapshot.`);
  }

  const stats = expectedStats(models);
  for (const [key, value] of Object.entries(stats)) {
    if (dataset.stats?.[key] !== value) {
      errors.push(`${pathLabel}: stats.${key} is ${dataset.stats?.[key]}, expected ${value}.`);
    }
  }

  const slots = ['planner', 'builder', 'medium', 'cheapest', 'private'];
  for (const slot of slots) {
    const recommendation = dataset.recommendations?.[slot];
    if (!recommendation) continue;
    if (recommendation.modelId !== null && !ids.has(recommendation.modelId)) {
      errors.push(`${pathLabel}: recommendation "${slot}" points to unknown model "${recommendation.modelId}".`);
    }
    if (recommendation.modelId === null && !recommendation.reason) {
      errors.push(`${pathLabel}: recommendation "${slot}" has no model and no reason.`);
    }
  }

  if (dataset.generatedAt) {
    const generated = Date.parse(dataset.generatedAt);
    if (Number.isNaN(generated)) {
      errors.push(`${pathLabel}: generatedAt is not a valid date.`);
    } else if (generated - Date.now() > 5 * 60 * 1000) {
      errors.push(`${pathLabel}: generatedAt is more than five minutes in the future.`);
    }
  }

  return errors;
}

export async function validateChanges(changes, { pathLabel = 'changes' } = {}) {
  const errors = [];
  const { changes: validate } = await validators();

  if (!validate(changes)) {
    errors.push(...formatAjvErrors(validate.errors, `${pathLabel}: `));
  }
  if (!changes || typeof changes !== 'object') return errors;

  const events = Array.isArray(changes.events) ? changes.events : [];
  for (let index = 1; index < events.length; index += 1) {
    const previous = Date.parse(events[index - 1].at);
    const current = Date.parse(events[index].at);
    if (Number.isFinite(previous) && Number.isFinite(current) && current > previous) {
      errors.push(`${pathLabel}: events are not newest-first at index ${index}.`);
      break;
    }
  }

  return errors;
}

async function main() {
  const [latestPath, changesPath] = process.argv.slice(2);
  const datasetPath = latestPath ?? path.join(ROOT, 'public', 'data', 'latest.json');
  const feedPath = changesPath ?? path.join(ROOT, 'public', 'data', 'changes.json');

  const [dataset, changes] = await Promise.all([
    readFile(datasetPath, 'utf8').then(JSON.parse),
    readFile(feedPath, 'utf8').then(JSON.parse),
  ]);

  const errors = [
    ...(await validateDataset(dataset, { pathLabel: 'latest.json' })),
    ...(await validateChanges(changes, { pathLabel: 'changes.json' })),
  ];

  if (errors.length > 0) {
    console.error(`✗ ${errors.length} validation error${errors.length === 1 ? '' : 's'}:`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `✓ latest.json and changes.json are valid (${dataset.models.length} models, ${dataset.stats.rated} rated).`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
