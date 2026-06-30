export const DEFAULT_EDGE_COLOR = '#111827'

export const EDGE_COLOR_SWATCHES = [
  { name: 'Black', value: DEFAULT_EDGE_COLOR },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Purple', value: '#9333ea' },
] as const

export function normalizeEdgeColor(value?: string | null): string {
  const normalized = value?.trim().toLowerCase() ?? ''
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : DEFAULT_EDGE_COLOR
}

export function edgeColorToNumber(value?: string | null): number {
  return Number.parseInt(normalizeEdgeColor(value).slice(1), 16)
}
