import { describe, expect, it } from 'vitest'
import type { Summary } from './api'
import { biasLabel, dayTicks, formatHour, formatLondon, formatMW, horizonLabel, kpis, toChartRows } from './chartData'

const point = (forecast: number | null) => ({
  start_time: '2026-01-02T00:00:00Z',
  actual: 100,
  forecast,
  publish_time: '2026-01-01T07:30:00Z',
  horizon_hours: 16.5,
  error: null,
})

describe('toChartRows', () => {
  it('adds a symmetric band only when forecast and p90 exist', () => {
    const [a, b, c] = [toChartRows([point(500)], 50)[0], toChartRows([point(null)], 50)[0], toChartRows([point(500)], null)[0]]
    expect(a.band).toEqual([450, 550])
    expect(b.band).toBeNull()
    expect(c.band).toBeNull()
  })

  it('never lets the band go below zero generation', () => {
    expect(toChartRows([point(30)], 50)[0].band).toEqual([0, 80])
  })

  it('carries the publish time through as epoch ms, null when absent', () => {
    expect(toChartRows([point(5)], null)[0].published).toBe(Date.UTC(2026, 0, 1, 7, 30))
    expect(toChartRows([{ ...point(null), publish_time: null }], null)[0].published).toBeNull()
  })

  it('parses time to epoch ms and keeps missing forecast as null (not 0)', () => {
    const [r] = toChartRows([point(null)], 50)
    expect(r.t).toBe(Date.UTC(2026, 0, 2))
    expect(r.forecast).toBeNull()
  })
})

describe('formatting', () => {
  it('formats MW with sign, separators and a dash for null', () => {
    expect(formatMW(1772.4, true)).toBe('+1,772')
    expect(formatMW(-50.2, true)).toBe('-50')
    expect(formatMW(2057.6)).toBe('2,058')
    expect(formatMW(null)).toBe('–')
  })

  it('shows London wall-clock time (BST shifts UTC by +1h)', () => {
    expect(formatLondon(Date.UTC(2026, 6, 1, 23, 0))).toContain('00:00')
    expect(formatLondon(Date.UTC(2026, 0, 1, 23, 0))).toContain('23:00')
  })

  it('labels bias direction and horizon buckets', () => {
    expect(biasLabel(10)).toBe('forecast runs high')
    expect(biasLabel(-10)).toBe('forecast runs low')
    expect(horizonLabel(18)).toBe('18–24h')
  })
})

describe('kpis', () => {
  const base: Summary = { n: 720, n_missing: 0, mae: 2057.6, rmse: 2531.7, bias: 1772.5, mape: 22.03, p50: 1, p90: 4189, p95: 5323 }

  it('renders the headline numbers', () => {
    const byTitle = Object.fromEntries(kpis(base).map((k) => [k.title, k]))
    expect(byTitle.Bias.value).toBe('+1,773 MW')
    expect(byTitle.MAPE.value).toBe('22.0%')
    expect(byTitle.MAPE.hint).toBe('720 hours scored')
  })

  it('degrades to dashes on an empty window', () => {
    const empty = { ...base, n: 0, mae: null, rmse: null, bias: null, mape: null, p90: null, p95: null, n_missing: 3 }
    const vals = kpis(empty).map((k) => k.value)
    expect(vals).toContain('– MW')
    expect(kpis(empty).find((k) => k.title === 'MAPE')?.hint).toBe('3 hours had no forecast')
  })
})

describe('dayTicks', () => {
  const day = 86_400_000

  it('puts one tick on each London midnight for a week in winter', () => {
    const ticks = dayTicks(Date.UTC(2026, 0, 2), Date.UTC(2026, 0, 8, 23))!
    expect(ticks).toHaveLength(7)
    expect(ticks[0]).toBe(Date.UTC(2026, 0, 2))
    expect(ticks[1] - ticks[0]).toBe(day)
  })

  it('lands on 23:00Z in summer, because London midnight is 23:00 UTC the day before', () => {
    expect(dayTicks(Date.UTC(2026, 6, 1), Date.UTC(2026, 6, 8))![0]).toBe(Date.UTC(2026, 6, 1, 23))
  })

  it('thins a month to at most 8 ticks and skips short ranges', () => {
    expect(dayTicks(Date.UTC(2026, 0, 2), Date.UTC(2026, 1, 1, 23))!.length).toBeLessThanOrEqual(8)
    expect(dayTicks(Date.UTC(2026, 0, 2), Date.UTC(2026, 0, 3, 23))).toBeUndefined()
  })
})

describe('formatHour', () => {
  it('zero-pads', () => expect(formatHour(9)).toBe('09:00'))
})
