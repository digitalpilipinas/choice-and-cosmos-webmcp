// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RESEARCH_API_PATH } from '../../src/research/contract.ts'
import worker from '../../worker/index.ts'

const validBody = {
  horizon: 'daily',
  query: 'finish the draft',
  mode: 'auto',
  manualUrls: [],
}

function assetsEnv() {
  return {
    ASSETS: {
      fetch: vi.fn(async () => new Response('spa', { status: 200 })),
    },
  }
}

describe('worker research route', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts to the handler fixture path without touching assets or global fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('unexpected fetch')
    })
    const env = assetsEnv()
    const response = await worker.fetch(
      new Request(`http://choice.local${RESEARCH_API_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }),
      env,
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      outcome: string
      coverage: { mode: string }
    }
    expect(body.outcome).toBe('ready')
    expect(body.coverage.mode).toBe('fixture')
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 405 for GET on the research path without CORS or assets', async () => {
    const env = assetsEnv()
    const response = await worker.fetch(
      new Request(`http://choice.local${RESEARCH_API_PATH}`, { method: 'GET' }),
      env,
    )
    expect(response.status).toBe(405)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  })

  it('forwards other paths to assets', async () => {
    const env = assetsEnv()
    const request = new Request('http://choice.local/some-spa-path')
    const response = await worker.fetch(request, env)
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce()
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(request)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('spa')
  })

  it('returns invalid_input for invalid JSON', async () => {
    const env = assetsEnv()
    const response = await worker.fetch(
      new Request(`http://choice.local${RESEARCH_API_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
      env,
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      outcome: 'error',
      code: 'invalid_input',
    })
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  })

  it('does not commit a GEMINI_API_KEY value in wrangler.jsonc', () => {
    const wrangler = readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf8')
    expect(wrangler).not.toMatch(/"GEMINI_API_KEY"\s*:/)
    expect(wrangler).toMatch(/wrangler secret put GEMINI_API_KEY/)
  })
})
