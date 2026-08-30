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

  it('forwards POST /api/research to assets', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('unexpected fetch')
    })
    const env = assetsEnv()
    const request = new Request(`http://choice.local${RESEARCH_API_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const response = await worker.fetch(request, env)
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce()
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(request)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('spa')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('forwards GET on the research path to assets', async () => {
    const env = assetsEnv()
    const request = new Request(`http://choice.local${RESEARCH_API_PATH}`, {
      method: 'GET',
    })
    const response = await worker.fetch(request, env)
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce()
    expect(env.ASSETS.fetch).toHaveBeenCalledWith(request)
    expect(response.status).toBe(200)
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

  it('does not echo a fake Worker key through assets', async () => {
    const env = {
      ...assetsEnv(),
      GEMINI_API_KEY: 'sk-test-gemini-not-real-xyz',
    }
    const response = await worker.fetch(
      new Request(`http://choice.local${RESEARCH_API_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }),
      env,
    )
    expect(await response.text()).toBe('spa')
    expect(env.ASSETS.fetch).toHaveBeenCalledOnce()
  })

  it('does not commit a GEMINI_API_KEY value in wrangler.jsonc or worker source', () => {
    const wrangler = readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf8')
    expect(wrangler).not.toMatch(/"GEMINI_API_KEY"\s*:/)
    expect(wrangler).not.toMatch(/d1_databases/)
    const workerSource = readFileSync(
      join(process.cwd(), 'worker', 'index.ts'),
      'utf8',
    )
    expect(workerSource).not.toMatch(/GEMINI_API_KEY/)
    expect(workerSource).not.toMatch(/CF-Connecting-IP/)
    expect(workerSource).not.toMatch(/sk-/)
  })
})
