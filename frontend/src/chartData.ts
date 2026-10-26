import type { SeriesPoint, Summary } from './api'

interface ChartRow {
  t: number // epoch ms (UTC)
  actual: number | null
  forecast: number | null
  band: [number, number] | null // forecast +/- p90 absolute error, floored at 0 (wind can't be negative)
  published: number | null // epoch ms the forecast was issued
}

export function toChartRows(points: SeriesPoint[], p90: number | null): ChartRow[] {
  return points.map((p) => ({
    t: Date.parse(p.start_time),
    actual: p.actual,
    forecast: p.forecast,
    published: p.publish_time === null ? null : Date.parse(p.publish_time),
    band: p.forecast !== null && p90 !== null ? [Math.max(0, p.forecast - p90), p.forecast + p90] : null,
  }))
}

const londonTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export const formatLondon = (t: number) => londonTime.format(t)

export function formatMW(v: number | null, signed = false): string {
  if (v === null) return '–'
  const s = Math.round(v).toLocaleString('en-GB')
  return signed && v > 0 ? `+${s}` : s
}

export function biasLabel(bias: number | null): string {
  if (bias === null) return ''
  return bias > 0 ? 'forecast runs high' : bias < 0 ? 'forecast runs low' : 'unbiased'
}

export const horizonLabel = (start: number) => `${start}–${start + 6}h`

interface Kpi {
  title: string
  value: string
  hint: string
}

export function kpis(s: Summary): Kpi[] {
  return [
    { title: 'Bias', value: `${formatMW(s.bias, true)} MW`, hint: biasLabel(s.bias) },
    { title: 'MAE', value: `${formatMW(s.mae)} MW`, hint: 'mean absolute error' },
    { title: 'RMSE', value: `${formatMW(s.rmse)} MW`, hint: 'penalises large misses' },
    { title: 'P90 error', value: `${formatMW(s.p90)} MW`, hint: '9 in 10 hours miss by less' },
    { title: 'P95 error', value: `${formatMW(s.p95)} MW`, hint: '19 in 20 hours miss by less' },
    {
      title: 'MAPE',
      value: s.mape === null ? '–' : `${s.mape.toFixed(1)}%`,
      hint: s.n_missing ? `${s.n_missing} hours had no forecast` : `${s.n} hours scored`,
    },
  ]
}

export const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`

const londonClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  hourCycle: 'h23',
})
const londonDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short' })
export const formatDay = (t: number) => londonDay.format(t)

const part = (t: number, type: Intl.DateTimeFormatPartTypes) =>
  Number(londonClock.formatToParts(t).find((p) => p.type === type)?.value)

// London is UTC+0 or UTC+1, so UTC midnight is 00:00 or 01:00 London; subtract that hour to land on London midnight.
const londonMidnight = (y: number, m: number, d: number) => {
  const utc = Date.UTC(y, m - 1, d)
  return utc - part(utc, 'hour') * 3_600_000
}

const DAY_MS = 86_400_000

/** One tick per London midnight, thinned to at most `maxTicks`. undefined for short spans (hourly ticks read better). */
export function dayTicks(t0: number, t1: number, maxTicks = 8): number[] | undefined {
  if (t1 - t0 < 3 * DAY_MS) return undefined
  const [y, m, d] = [part(t0, 'year'), part(t0, 'month'), part(t0, 'day')]
  const ticks: number[] = []
  for (let i = 0; ; i++) {
    const t = londonMidnight(y, m, d + i) // Date.UTC rolls day overflow into the next month
    if (t > t1) break
    if (t >= t0) ticks.push(t)
  }
  const step = Math.ceil(ticks.length / maxTicks)
  return ticks.filter((_, i) => i % step === 0)
}
