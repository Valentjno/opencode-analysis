import type { ChangeFeed, Model, Snapshot } from './types';

export const STALE_AFTER_MS = 13 * 60 * 60 * 1000;
const BASE = import.meta.env.BASE_URL ?? '/';

class DataError extends Error {}

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(`${BASE}data/${file}`, { cache: 'no-cache' });
  if (!response.ok) {
    throw new DataError(`Could not load ${file} (HTTP ${response.status}).`);
  }
  return (await response.json()) as T;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const snapshot = await fetchJson<Snapshot>('latest.json');
  if (snapshot?.schemaVersion !== 1) {
    throw new DataError(
      `Unsupported dataset version ${String(snapshot?.schemaVersion)}. The site and data are out of sync.`,
    );
  }
  if (!Array.isArray(snapshot.models)) {
    throw new DataError('The dataset has no models array.');
  }
  return snapshot;
}

export async function loadChanges(): Promise<ChangeFeed | null> {
  try {
    const feed = await fetchJson<ChangeFeed>('changes.json');
    if (feed?.schemaVersion !== 1) return null;
    return feed;
  } catch {
    return null;
  }
}

export function isStale(generatedAt: string, now = Date.now()): boolean {
  const generated = new Date(generatedAt).getTime();
  if (Number.isNaN(generated)) return true;
  return now - generated > STALE_AFTER_MS;
}

export function ageLabel(generatedAt: string, now = Date.now()): string {
  const generated = new Date(generatedAt).getTime();
  if (Number.isNaN(generated)) return 'unknown age';
  const hours = Math.max(0, Math.floor((now - generated) / 3_600_000));
  if (hours < 1) return 'less than an hour old';
  return `${hours} hour${hours === 1 ? '' : 's'} old`;
}

export function indexById(models: Model[]): Map<string, Model> {
  return new Map(models.map((model) => [model.id, model]));
}

export function modelById(models: Model[], id: string | null): Model | null {
  if (!id) return null;
  return models.find((model) => model.id === id) ?? null;
}
