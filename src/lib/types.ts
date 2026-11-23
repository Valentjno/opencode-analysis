/**
 * The published dataset contract. Every field and nullability mirrors
 * `specs/001-model-radar-dashboard/contracts/dataset.schema.json`; the loader
 * refuses a snapshot with a different schema version.
 */

export type AaStatus = 'rated' | 'unrated' | 'missing' | 'stale' | 'error';

export type PrivacyTier = 'private' | 'no-training' | 'trains' | 'unknown';

export interface Plan {
  name: string;
  price: number;
}

export interface Source {
  url: string;
  ok: boolean;
  count?: number;
  rows?: number;
  sitemapSlugs?: number;
  matched?: number;
  rated?: number;
}

export interface SnapshotSources {
  opencodeGo: Source;
  opencodeAll: Source;
  goPage: Source;
  artificialAnalysis: Source;
}

export interface Stats {
  total: number;
  go: number;
  free: number;
  both: number;
  rated: number;
  unrated: number;
  private: number;
  trains: number;
  limitedRegions: number;
}

export interface Access {
  go: boolean;
  free: boolean;
  limitedRegions: boolean;
}

export interface Pricing {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  blended: number | null;
}

export interface GoMonthly {
  go: number | null;
  goPlus: number | null;
  goTeams: number | null;
}

export interface GoRequests {
  go: number | null;
  goPlus: number | null;
  goUnlimited: boolean;
  goPlusUnlimited: boolean;
}

export interface GoAccess {
  monthly: GoMonthly;
  requests5h: GoRequests;
  featured: boolean;
}

export interface Privacy {
  training: boolean | null;
  zdr: boolean | null;
  retentionDays: number | null;
  limitedRegions: boolean;
  source: string;
  note: string;
}

export interface AAProfile {
  slug: string;
  url: string;
  variant: string;
  suffix: string | null;
  effort: string | null;
  releaseDate: string | null;
  deprecated: boolean;
  deprecatedTo: string | null;
  intelligenceIndex: number | null;
  capabilities: Record<string, number>;
  evals: Record<string, number>;
  omniscience: number | null;
  contextWindow: number | null;
  outputSpeed: number | null;
  timeToFirstToken: number | null;
  costPerTask: number | null;
  aaPrice: { input: number | null; output: number | null } | null;
  isOpenWeights: boolean;
}

export interface Model {
  id: string;
  name: string;
  canonicalId: string | null;
  vendor: string;
  description: string;
  family: string | null;
  openWeights: boolean;
  releaseDate: string | null;
  lastUpdated: string | null;
  knowledge: string | null;
  access: Access;
  pricing: Pricing;
  context: number | null;
  maxOutput: number | null;
  modalities: { input?: string[]; output?: string[] } | null;
  capabilities: Record<string, unknown> | null;
  go: GoAccess | null;
  privacy: Privacy;
  aaSlug: string | null;
  aa: AAProfile | null;
  aaStatus: AaStatus;
}

export type RecommendationSlot = 'planner' | 'builder' | 'medium' | 'cheapest' | 'private';

export interface Recommendation {
  slot: RecommendationSlot;
  title: string;
  modelId: string | null;
  rule: string;
  reason: string;
  caveat: string | null;
  intelligenceIndex: number | null;
  blendedPrice: number | null;
  monthlyGo: number | null;
}

export type Recommendations = Record<RecommendationSlot, Recommendation | null>;

export interface Snapshot {
  schemaVersion: number;
  generatedAt: string;
  plans: { go: Plan; goPlus: Plan };
  sources: SnapshotSources;
  stats: Stats;
  recommendations: Recommendations;
  models: Model[];
}

export type ChangeType =
  | 'added'
  | 'removed'
  | 'price'
  | 'access'
  | 'allowance'
  | 'requests'
  | 'privacy'
  | 'score'
  | 'rated'
  | 'unrated';

export interface ChangeEvent {
  at: string;
  type: ChangeType;
  id: string;
  name: string;
  message: string;
  field?: string | null;
  from?: unknown;
  to?: unknown;
}

export interface ChangeFeed {
  schemaVersion: number;
  updatedAt: string;
  baseline: boolean;
  events: ChangeEvent[];
}
