import { describe, expect, it, vi } from 'vitest'
import { postResearch } from '../../src/research/client.ts'
import type { ResearchRequestInput } from '../../src/research/contract.ts'

const input: ResearchRequestInput = {
  horizon: 'daily',
  query: 'finish the draft',
  mode: 'auto',
  manualUrls: [],
}

describe('research client', () => {
  it('returns unavailable without fetching', async () => {
    const fetchImpl = vi.fn()
    const result = await postResearch(input, {
      fetchImpl: fetchImpl as typeof fetch,
    })
    expect(result.outcome).toBe('unavailable')
    if (result.outcome !== 'unavailable') {
      return
    }
    expect(result.reason).toMatch(/hosted research is not available/i)
    expect(result.reason).toMatch(/no live search occurred/i)
    expect(result.sources).toEqual([])
    expect(result.coverage.exhaustive).toBe(false)
    expect(result.coverage.mode).toBe('fixture')
    expect(JSON.stringify(result)).not.toMatch(/https:\/\//)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('still returns unavailable when the caller already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = vi.fn()
    const result = await postResearch(input, {
      fetchImpl: fetchImpl as typeof fetch,
      signal: controller.signal,
    })
    expect(result.outcome).toBe('unavailable')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
