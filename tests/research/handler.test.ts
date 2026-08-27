// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { handleResearchRequest, MAX_RESEARCH_BODY_BYTES } from '../../server/research/handler.ts'
import { GEMINI_INTERACTIONS_URL } from '../../server/research/gemini.ts'

const TEST_KEY = 'sk-test-gemini-not-real-xyz'

function post(body: unknown, signal?: AbortSignal): Request {
  return new Request('http://choice.local/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
}

describe('research handler', () => {
  it('rejects non-POST methods without adding CORS or auth headers', async () => {
    const response = await handleResearchRequest(
      new Request('http://choice.local/research', { method: 'GET' }),
      { env: {} },
    )
    expect(response.status).toBe(405)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    expect(response.headers.get('www-authenticate')).toBeNull()
    const body = (await response.json()) as { outcome: string; code: string }
    expect(body).toMatchObject({ outcome: 'error', code: 'invalid_input' })
  })

  it('returns invalid_input for malformed JSON and bad schema', async () => {
    const malformed = await handleResearchRequest(
      new Request('http://choice.local/research', {
        method: 'POST',
        body: '{',
        headers: { 'Content-Type': 'application/json' },
      }),
      { env: {} },
    )
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toMatchObject({
      outcome: 'error',
      code: 'invalid_input',
    })

    const schema = await handleResearchRequest(
      post({ horizon: 'daily' }),
      { env: {} },
    )
    expect(schema.status).toBe(400)
    expect(await schema.json()).toMatchObject({
      outcome: 'error',
      code: 'invalid_input',
    })
  })

  it('returns invalid_input for an over-limit body without echoing the payload', async () => {
    const oversized = `${'{"pad":"'}${'x'.repeat(MAX_RESEARCH_BODY_BYTES)}}`
    expect(new TextEncoder().encode(oversized).byteLength).toBeGreaterThan(
      MAX_RESEARCH_BODY_BYTES,
    )
    const response = await handleResearchRequest(
      new Request('http://choice.local/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: oversized,
      }),
      { env: {} },
    )
    expect(response.status).toBe(400)
    const body = (await response.json()) as {
      outcome: string
      code: string
      reason: string
    }
    expect(body).toEqual({
      outcome: 'error',
      code: 'invalid_input',
      reason: 'Body exceeds the maximum allowed size.',
    })
    expect(JSON.stringify(body)).not.toContain('xxxx')
  })

  it('returns fixture evidence without credentials', async () => {
    const fetchImpl = vi.fn()
    const response = await handleResearchRequest(
      post({ horizon: 'weekly', query: 'protect one block of attention' }),
      { env: {}, fetchImpl },
    )
    expect(response.status).toBe(200)
    expect(fetchImpl).not.toHaveBeenCalled()
    const body = (await response.json()) as {
      outcome: string
      coverage: { mode: string; exhaustive: boolean }
    }
    expect(body.outcome).toBe('ready')
    expect(body.coverage.mode).toBe('fixture')
    expect(body.coverage.exhaustive).toBe(false)
  })

  it('returns handler_error when the clock fails after validation', async () => {
    const response = await handleResearchRequest(
      post({ horizon: 'yearly', query: 'name the season' }),
      {
        env: {},
        now: () => {
          throw new Error('clock exploded')
        },
      },
    )
    expect(response.status).toBe(500)
    const body = (await response.json()) as {
      outcome: string
      code: string
      reason: string
    }
    expect(body).toEqual({
      outcome: 'error',
      code: 'handler_error',
      reason: 'The research handler failed before a research outcome could be produced.',
    })
    expect(body.reason).not.toContain('clock exploded')
  })

  it('does not send Authorization or leak the test key', async () => {
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe(GEMINI_INTERACTIONS_URL)
      const headers = new Headers(init?.headers)
      expect(headers.has('authorization')).toBe(false)
      expect(headers.get('x-goog-api-key')).toBe(TEST_KEY)
      return new Response(
        JSON.stringify({
          outputs: [{ type: 'text', text: 'ok', annotations: [] }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
    const response = await handleResearchRequest(
      post({ horizon: 'daily', query: 'stay with the draft' }),
      { env: { GEMINI_API_KEY: TEST_KEY }, fetchImpl: fetchImpl as typeof fetch },
    )
    const body = await response.text()
    expect(body).not.toContain(TEST_KEY)
    expect(body).not.toContain('x-goog-api-key')
  })

  it('returns cancelled when the request signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = vi.fn()
    const response = await handleResearchRequest(
      post({ horizon: 'daily', query: 'stay with the draft' }, controller.signal),
      { env: { GEMINI_API_KEY: TEST_KEY }, fetchImpl, signal: controller.signal },
    )
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ outcome: 'cancelled' })
  })
})
