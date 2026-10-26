import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSeries } from './api'

const q = { start: '2026-01-02', end: '2026-01-03', cutoffHour: 9 }

function stubFetch(res: Partial<Response> & { json?: () => Promise<unknown> }) {
  const spy = vi.fn().mockResolvedValue(res)
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => vi.unstubAllGlobals())

describe('api get()', () => {
  it('sends the query as snake_case params', async () => {
    const spy = stubFetch({ ok: true, json: async () => [] })
    await fetchSeries(q)
    expect(spy.mock.calls[0][0]).toBe('/api/series?start=2026-01-02&end=2026-01-03&cutoff_hour=9')
  })

  it('surfaces the API detail message on failure', async () => {
    stubFetch({ ok: false, status: 422, json: async () => ({ detail: 'start must be <= end' }) })
    await expect(fetchSeries(q)).rejects.toThrow('start must be <= end')
  })

  it('falls back to the status code when the body is not JSON or detail is not a string', async () => {
    stubFetch({ ok: false, status: 502, json: async () => Promise.reject(new Error('not json')) })
    await expect(fetchSeries(q)).rejects.toThrow('Request failed (502)')
    stubFetch({ ok: false, status: 422, json: async () => ({ detail: [{ msg: 'bad' }] }) })
    await expect(fetchSeries(q)).rejects.toThrow('Request failed (422)')
  })
})
