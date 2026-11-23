import type { Privacy, PrivacyTier } from './types';

export interface PrivacyLabel {
  tier: PrivacyTier;
  label: string;
  short: string;
  tone: 'success' | 'warning' | 'danger' | 'muted';
  description: string;
}

export const PRIVACY_LABELS: Record<PrivacyTier, Omit<PrivacyLabel, 'tier'>> = {
  private: {
    label: 'Private',
    short: 'Private',
    tone: 'success',
    description: 'No training on requests and zero data retention.',
  },
  'no-training': {
    label: 'No training',
    short: 'No train',
    tone: 'warning',
    description: 'No training on requests, but zero retention is not guaranteed.',
  },
  trains: {
    label: 'Trains on requests',
    short: 'Trains',
    tone: 'danger',
    description: 'The provider may train on requests. Do not send sensitive data.',
  },
  unknown: {
    label: 'Unknown',
    short: 'Unknown',
    tone: 'muted',
    description: 'Terms are not documented. Treat as not private.',
  },
};

/**
 * Four tiers. Unknown is never treated as private. A model is only "private"
 * when both no-training and zero-retention are explicitly true.
 */
export function privacyTier(privacy: Privacy | null | undefined): PrivacyTier {
  if (!privacy) return 'unknown';
  if (privacy.training === true) return 'trains';
  if (privacy.training === false && privacy.zdr === true) return 'private';
  if (privacy.training === false) return 'no-training';
  return 'unknown';
}

export function privacyLabel(privacy: Privacy | null | undefined): PrivacyLabel {
  const tier = privacyTier(privacy);
  return { tier, ...PRIVACY_LABELS[tier] };
}

export function isFullyPrivate(privacy: Privacy | null | undefined): boolean {
  return privacyTier(privacy) === 'private';
}
