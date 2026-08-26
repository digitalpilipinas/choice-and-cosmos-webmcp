import type { ResearchDeps } from './run.ts'
import { runResearch } from './run.ts'
import { parseResearchInput } from './input.ts'
import type { ResearchError, ResearchResult } from '../../src/research/contract.ts'

export async function handleResearchRequest(
  request: Request,
  deps: Partial<ResearchDeps> = {},
): Promise<Response> {
  if (request.method !== 'POST') {
    return json(invalid('POST JSON to this handler. Other methods are not supported.'), 405)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(invalid('Body must be JSON.'), 400)
  }

  const parsed = parseResearchInput(body)
  if (!parsed.ok) {
    return json(invalid(parsed.reason), 400)
  }

  try {
    const result = await runResearch(parsed.value, {
      env: deps.env ?? { GEMINI_API_KEY: readGeminiKey() },
      fetchImpl: deps.fetchImpl,
      now: deps.now,
      timeoutMs: deps.timeoutMs,
      signal: deps.signal ?? request.signal,
    })
    const status = result.outcome === 'error' ? 400 : 200
    return json(result, status)
  } catch {
    const failure: ResearchError = {
      outcome: 'error',
      code: 'handler_error',
      reason:
        'The research handler failed before a research outcome could be produced.',
    }
    return json(failure, 500)
  }
}

function invalid(reason: string): ResearchError {
  return { outcome: 'error', code: 'invalid_input', reason }
}

function json(body: ResearchResult, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function readGeminiKey(): string | undefined {
  const runtime = globalThis as {
    process?: { env?: { GEMINI_API_KEY?: string } }
  }
  const value = runtime.process?.env?.GEMINI_API_KEY
  return typeof value === 'string' ? value : undefined
}
