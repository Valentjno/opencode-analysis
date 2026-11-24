import type { Model } from './types'

/**
 * A stable vendor palette for every chart. Color identifies the company;
 * the frontier is shown with size and a ring so the two encodings never clash.
 */
export const VENDOR_COLORS: Record<string, string> = {
  Anthropic: '#D97757',
  OpenAI: '#10A37F',
  Google: '#4285F4',
  Meta: '#6C5CE7',
  xAI: '#64748B',
  'Moonshot AI': '#EC4899',
  Alibaba: '#F59E0B',
  DeepSeek: '#8B5CF6',
  'Z.ai': '#06B6D4',
  Xiaomi: '#F97316',
  MiniMax: '#EF4444',
  Tencent: '#0EA5E9',
  StepFun: '#84CC16',
  NVIDIA: '#22C55E',
  Reflection: '#D946EF',
  Recursive: '#A16207',
  Meituan: '#EAB308',
  opencode: '#94A3B8',
}

export const OTHER_VENDOR_COLOR = '#71717A'

export function vendorColor(vendor: string | null | undefined): string {
  if (!vendor) return OTHER_VENDOR_COLOR
  return VENDOR_COLORS[vendor] ?? OTHER_VENDOR_COLOR
}

export function vendorLegend(models: Model[]): { vendor: string; color: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const model of models) {
    const vendor = model.vendor || 'Other'
    counts.set(vendor, (counts.get(vendor) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([vendor, count]) => ({ vendor, color: vendorColor(vendor), count }))
}
