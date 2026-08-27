import { describe, expect, it, vi } from 'vitest'
import { postResearch } from '../../src/research/client.ts'
import { RESEARCH_API_PATH } from '../../src/research/contract.ts'
import type { ResearchRequestInput, ResearchResult } from '../../src/research/contract.ts'

const input: ResearchRequestInput = {
  horizon: 'daily',
  query: 'finish the draft',
  mode: 'auto',
  manualUrls: [],
}

const ready: ResearchResult = {
  outcome: 'ready',
  sources: [
    {
      id: 'ev_abcd1234abcd1234',
      title: 'A citation',
      url: 'https://example.com/note',
      snippet: 'A snippet',
      domain: 'example.com',
      provenance: {
        provider: 'gemini',
        method: 'google_search',
        retrievedAt: '2026-08-27T00:00:00.000Z',
        query: 'finish the draft',
      },
    },
  ],
  coverage: {
    sourcesConsidered: 1,
    sourcesUsed: 1,
    queriesUsed: 1,
    novelDomainsUsed: 1,
    timeWindowDescription: 'Today into tomorrow morning',
    stoppingReason: 'One source kept.',
    mode: 'gemini',
    exhaustive: false,
  },
  modelText: 'Untrusted model text',
}

describe('research client', () => {
  it('returns unavailable when the route is missing', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response('not found', { status: 404 }),
    )
    const result = await postResearch(input, {
      fetchImpl: fetchImpl as typeof fetch,
    })
    expect(result.outcome).toBe('unavailable')
    if (result.outcome !== 'unavailable') {
      return
    }
    expect(result.reason).toMatch(/no live search occurred/i)
    expect(result.sources).toEqual([])
    expect(result.coverage.exhaustive).toBe(false)
    expect(result.coverage.mode).toBe('fixture')
    expect(JSON.stringify(result)).not.toMatch(/https:\/\//)
    expect(fetchImpl).toHaveBeenCalledOnce()
    const firstUrl = fetchImpl.mock.calls.at(0)?.at(0)
    expect(String(firstUrl)).toBe(RESEARCH_API_PATH)
    expect(String(firstUrl)).not.toMatch(/googleapis/)
  })

  it('returns cancelled when the request is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = vi.fn()
    const result = await postResearch(input, {
      fetchImpl: fetchImpl as typeof fetch,
      signal: controller.signal,
    })
    expect(result.outcome).toBe('cancelled')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns a parsed research result', async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(ready), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const result = await postResearch(input, {
      fetchImpl: fetchImpl as typeof fetch,
    })
    expect(result).toEqual(ready)
    const parsedUrl = fetchImpl.mock.calls.at(0)?.at(0)
    expect(String(parsedUrl)).toBe(RESEARCH_API_PATH)
    expect(String(parsedUrl)).not.toMatch(
      /generativelanguage\.googleapis\.com/,
    )
  })
})
