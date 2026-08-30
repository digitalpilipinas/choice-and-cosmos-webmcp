// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { handleResearchRequest } from '../../server/research/handler.ts'
import { runPersonalized } from '../../server/research/personalized.ts'
import { runResearch } from '../../server/research/run.ts'
import { liveDeps, liveEnv, samplePersonalized, TEST_IP, TEST_KEY } from './helpers.ts'
import { createMemoryQuotaStore } from '../../server/research/quotaMemory.ts'
import { createD1QuotaStore } from '../../server/research/quotaD1.ts'
import { GLOBAL_DAILY_LIMIT, GLOBAL_QUOTA_HASH, type QuotaRow } from '../../server/research/quota.ts'
import { fakeD1, globalCounter } from './fakeD1.ts'

const FOCUS = {
  horizon: 'daily' as const,
  query: 'stay with the draft',
  mode: 'auto' as const,
  manualUrls: [] as string[],
}

function post(body: unknown, headers?: HeadersInit): Request {
  return new Request('http://choice.local/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('fail-closed live research', () => {
  it('does not use fixture success for missing enablement, identity, secret, D1, or key', async () => {
    const fetchImpl = vi.fn()
    const disabled = await runResearch(FOCUS, { env: {}, fetchImpl })
    expect(disabled.outcome).toBe('unavailable')
    expect(fetchImpl).not.toHaveBeenCalled()

    const noKey = await runPersonalized(
      samplePersonalized(),
      liveDeps({ env: liveEnv({ GEMINI_API_KEY: '' }), fetchImpl }),
    )
    expect(noKey.status).toBe('unavailable')
    if (noKey.status !== 'unavailable') {
      throw new Error('expected unavailable')
    }
    expect(noKey.reason).toMatch(/Gemini key/)

    const noSecret = await runPersonalized(
      samplePersonalized(),
      liveDeps({ env: liveEnv({ QUOTA_HASH_SECRET: '' }), fetchImpl }),
    )
    expect(noSecret.status).toBe('unavailable')

    const noQuota = await runPersonalized(samplePersonalized(), {
      env: liveEnv(),
      trustedVisitorIp: TEST_IP,
      fetchImpl,
    })
    expect(noQuota.status).toBe('unavailable')
    if (noQuota.status !== 'unavailable') {
      throw new Error('expected unavailable')
    }
    expect(noQuota.reason).toMatch(/quota store/)

    const noIp = await runPersonalized(samplePersonalized(), {
      env: liveEnv(),
      quota: createMemoryQuotaStore(),
      fetchImpl,
    })
    expect(noIp.status).toBe('unavailable')
    if (noIp.status !== 'unavailable') {
      throw new Error('expected unavailable')
    }
    expect(noIp.reason).toMatch(/identity/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reserves quota before one provider call and stops at the visitor cap', async () => {
    const quota = createMemoryQuotaStore()
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ outputs: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const deps = liveDeps({ quota, fetchImpl: fetchImpl as typeof fetch })
    await runPersonalized(samplePersonalized(), deps)
    await runPersonalized(samplePersonalized(), deps)
    await runPersonalized(samplePersonalized(), deps)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    const blocked = await runPersonalized(samplePersonalized(), deps)
    expect(blocked.status).toBe('quota_exceeded')
    if (blocked.status !== 'quota_exceeded') {
      throw new Error('expected quota_exceeded')
    }
    expect(blocked.reason).toMatch(/visitor UTC-day bucket/)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(blocked)).not.toContain(TEST_IP)
    expect(JSON.stringify(blocked)).not.toContain(TEST_KEY)
  })

  it('stops at the global UTC-day cap before calling Gemini', async () => {
    const day = '2026-08-28'
    const seed: QuotaRow[] = [
      { day, bucket: 'global', hash: GLOBAL_QUOTA_HASH, counter: GLOBAL_DAILY_LIMIT },
    ]
    const fetchImpl = vi.fn()
    const blocked = await runPersonalized(
      samplePersonalized(),
      liveDeps({
        quota: createMemoryQuotaStore(seed),
        fetchImpl,
        now: () => new Date(`${day}T12:00:00.000Z`),
      }),
    )
    expect(blocked.status).toBe('quota_exceeded')
    if (blocked.status !== 'quota_exceeded') {
      throw new Error('expected quota_exceeded')
    }
    expect(blocked.reason).toMatch(/global UTC-day bucket/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('ignores client-supplied identity fields on the JSON body', async () => {
    const fetchImpl = vi.fn()
    const response = await handleResearchRequest(
      post({
        horizon: 'daily',
        query: 'stay with the draft',
        ip: '198.51.100.9',
      }),
      { env: liveEnv(), fetchImpl, trustedVisitorIp: TEST_IP },
    )
    expect(response.status).toBe(400)
    expect(fetchImpl).not.toHaveBeenCalled()
    const body = (await response.json()) as { reason: string }
    expect(body.reason).toMatch(/ip/)
  })

  it('keeps cancelled fixture and manual coverage on the requested mode', async () => {
    const fetchImpl = vi.fn()
    const fixture = await runResearch(
      { ...FOCUS, mode: 'fixture' },
      { env: {}, fetchImpl, signal: AbortSignal.abort() },
    )
    expect(fixture.outcome).toBe('cancelled')
    if (fixture.outcome !== 'cancelled') {
      throw new Error('expected cancelled')
    }
    expect(fixture.coverage.mode).toBe('fixture')

    const manual = await runResearch(
      { ...FOCUS, mode: 'manual', manualUrls: ['https://example.com/note'] },
      { env: {}, fetchImpl, signal: AbortSignal.abort() },
    )
    expect(manual.outcome).toBe('cancelled')
    if (manual.outcome !== 'cancelled') {
      throw new Error('expected cancelled')
    }
    expect(manual.coverage.mode).toBe('manual')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('does not call Gemini when V1 auto research is aborted after reservation', async () => {
    const day = '2026-08-28'
    const rows = new Map<string, QuotaRow>()
    const fetchImpl = vi.fn(async () => {
      throw new Error('Gemini must not be called')
    })
    const controller = new AbortController()
    const inner = createD1QuotaStore(fakeD1(rows))
    const quota = {
      async reserve(reserveDay: string, visitorHash: string, signal?: AbortSignal) {
        const result = await inner.reserve(reserveDay, visitorHash, signal)
        controller.abort()
        return result
      },
      release: (releaseDay: string, visitorHash: string) =>
        inner.release(releaseDay, visitorHash),
      snapshot: () => inner.snapshot(),
    }
    const result = await runResearch(FOCUS, {
      ...liveDeps({
        quota,
        fetchImpl: fetchImpl as typeof fetch,
        signal: controller.signal,
        now: () => new Date(`${day}T12:00:00.000Z`),
      }),
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.outcome).toBe('cancelled')
    expect(globalCounter(rows, day)).toBe(0)
  })
})
