export interface Meta {
  first_day: string
  last_day: string
  default_cutoff_hour: number
}

export interface SeriesPoint {
  start_time: string
  actual: number | null
  forecast: number | null
  publish_time: string | null
  horizon_hours: number | null
  error: number | null // forecast - actual; positive = over-forecast
}

export interface Summary {
  n: number
  n_missing: number
  mae: number | null
  rmse: number | null
  bias: number | null
  mape: number | null
  p50: number | null
  p90: number | null
  p95: number | null
}

export interface HourBucket {
  hour: number
  n: number
  mae: number
  bias: number
}

export interface HorizonBucket {
  horizon_bucket_start: number
  n: number
  mae: number
  bias: number
}

export interface MetricsResponse {
  summary: Summary
  by_hour: HourBucket[]
  by_horizon: HorizonBucket[]
}

export interface Query {
  start: string
  end: string
  cutoffHour: number
}

// Empty in dev (vite proxies /api); set VITE_API_URL to the Render API URL in production.
const BASE = import.meta.env.VITE_API_URL ?? ''

async function get<T>(path: string, params: Record<string, string | number>, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const res = await fetch(`${BASE}${path}?${qs}`, { signal })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (${res.status})`)
  }
  return res.json()
}

const toParams = (q: Query) => ({ start: q.start, end: q.end, cutoff_hour: q.cutoffHour })

export const fetchMeta = (signal?: AbortSignal) => get<Meta>('/api/meta', {}, signal)
export const fetchSeries = (q: Query, signal?: AbortSignal) => get<SeriesPoint[]>('/api/series', toParams(q), signal)
export const fetchMetrics = (q: Query, signal?: AbortSignal) =>
  get<MetricsResponse>('/api/metrics', toParams(q), signal)
