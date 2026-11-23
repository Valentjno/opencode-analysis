import { privacyTier } from './privacy';
import type { Model, PrivacyTier } from './types';

export type AccessFilter = 'all' | 'go' | 'free' | 'both';
export type RatingFilter = 'all' | 'rated' | 'unrated';
export type PrivacyFilter = 'all' | PrivacyTier;
export type SortKey = 'score' | 'price' | 'allowance' | 'context' | 'name' | 'vendor';
export type SortDirection = 'asc' | 'desc';

export interface CatalogFilters {
  query: string;
  access: AccessFilter;
  rating: RatingFilter;
  privacy: PrivacyFilter;
  vendor: string;
  sortKey: SortKey;
  sortDirection: SortDirection;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  query: '',
  access: 'all',
  rating: 'all',
  privacy: 'all',
  vendor: 'all',
  sortKey: 'score',
  sortDirection: 'desc',
};

const matchesAccess = (model: Model, access: AccessFilter): boolean => {
  if (access === 'go') return model.access.go;
  if (access === 'free') return model.access.free;
  if (access === 'both') return model.access.go && model.access.free;
  return true;
};

const matchesRating = (model: Model, rating: RatingFilter): boolean => {
  const rated = typeof model.aa?.intelligenceIndex === 'number';
  if (rating === 'rated') return rated;
  if (rating === 'unrated') return !rated;
  return true;
};

const matchesPrivacy = (model: Model, privacy: PrivacyFilter): boolean =>
  privacy === 'all' || privacyTier(model.privacy) === privacy;

const haystack = (model: Model): string =>
  [model.name, model.id, model.vendor, model.family, model.description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export function filterModels(models: Model[], filters: CatalogFilters): Model[] {
  const query = filters.query.trim().toLowerCase();
  return models.filter((model) => {
    if (!matchesAccess(model, filters.access)) return false;
    if (!matchesRating(model, filters.rating)) return false;
    if (!matchesPrivacy(model, filters.privacy)) return false;
    if (filters.vendor !== 'all' && model.vendor !== filters.vendor) return false;
    if (query && !haystack(model).includes(query)) return false;
    return true;
  });
}

const priceOf = (model: Model): number | null =>
  typeof model.pricing.blended === 'number' ? model.pricing.blended : null;

const allowanceOf = (model: Model): number | null =>
  typeof model.go?.monthly?.go === 'number' ? model.go.monthly.go : null;

const scoreOf = (model: Model): number | null =>
  typeof model.aa?.intelligenceIndex === 'number' ? model.aa.intelligenceIndex : null;

function compareNullable(
  a: number | null,
  b: number | null,
  direction: SortDirection,
): number {
  // Missing values always sort last, in both directions.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === 'asc' ? a - b : b - a;
}

export function sortModels(models: Model[], filters: CatalogFilters): Model[] {
  const { sortKey, sortDirection } = filters;
  return models.slice().sort((a, b) => {
    let result = 0;
    switch (sortKey) {
      case 'score':
        result = compareNullable(scoreOf(a), scoreOf(b), sortDirection);
        break;
      case 'price':
        result = compareNullable(priceOf(a), priceOf(b), sortDirection);
        break;
      case 'allowance':
        result = compareNullable(allowanceOf(a), allowanceOf(b), sortDirection);
        break;
      case 'context':
        result = compareNullable(a.context ?? null, b.context ?? null, sortDirection);
        break;
      case 'vendor':
        result = a.vendor.localeCompare(b.vendor) * (sortDirection === 'asc' ? 1 : -1);
        break;
      case 'name':
      default:
        result = a.name.localeCompare(b.name) * (sortDirection === 'asc' ? 1 : -1);
        break;
    }
    if (result !== 0) return result;
    return a.name.localeCompare(b.name);
  });
}

export function vendorOptions(models: Model[]): string[] {
  return [...new Set(models.map((model) => model.vendor))].sort((a, b) => a.localeCompare(b));
}

export function defaultDirection(key: SortKey): SortDirection {
  if (key === 'price' || key === 'name' || key === 'vendor') return 'asc';
  return 'desc';
}
