const DASH = '—';

export function formatPrice(value: number | null | undefined, { freeLabel = true } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  if (freeLabel && value === 0) return 'Free';
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`;
  return `$${value.toFixed(2)}`;
}

export function formatPriceRange(
  input: number | null | undefined,
  output: number | null | undefined,
): string {
  if (
    input === null ||
    input === undefined ||
    output === null ||
    output === undefined ||
    !Number.isFinite(input) ||
    !Number.isFinite(output)
  ) {
    return DASH;
  }
  if (input === 0 && output === 0) return 'Free';
  return `${formatPrice(input)} / ${formatPrice(output)}`;
}

export function formatScore(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return value.toFixed(digits).replace(/\.0$/, '');
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return `${value.toFixed(digits).replace(/\.0$/, '')}%`;
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
  }
  return String(value);
}

export function formatMonthly(value: number | null | undefined, isGo: boolean): string {
  if (!isGo) return DASH;
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not documented';
  return `$${formatInteger(value)}/mo`;
}

export function formatRequests(
  value: number | null | undefined,
  unlimited: boolean,
): string {
  if (unlimited) return '∞';
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return formatInteger(value);
}

export function formatRetention(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Not documented';
  if (value === 0) return 'Zero retention';
  return `${value} day${value === 1 ? '' : 's'}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

export function relativeTime(value: string, now = Date.now()): string {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return value;
  const diff = now - time;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export function formatAccess(access: { go: boolean; free: boolean }): string {
  if (access.go && access.free) return 'Go + Free';
  if (access.go) return 'Go';
  if (access.free) return 'Free';
  return DASH;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
