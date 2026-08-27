import type { ResearchDeps } from './run.ts'
import { runResearch } from './run.ts'
import { parseResearchInput } from './input.ts'
import type { ResearchError, ResearchResult } from '../../src/research/contract.ts'

export const MAX_RESEARCH_BODY_BYTES = 128 * 1024

type BoundedBody =
  | { ok: true; text: string }
  | { ok: false; reason: string }

export async function handleResearchRequest(
  request: Request,
  deps: Partial<ResearchDeps> = {},
): Promise<Response> {
  if (request.method !== 'POST') {
    return json(invalid('POST JSON to this handler. Other methods are not supported.'), 405)
  }

  let bounded: BoundedBody
  try {
    bounded = await readBoundedBody(request)
  } catch {
    return json(invalid('Body must be JSON.'), 400)
  }
  if (!bounded.ok) {
    return json(invalid(bounded.reason), 400)
  }

  let body: unknown
  try {
    body = JSON.parse(bounded.text) as unknown
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

async function readBoundedBody(request: Request): Promise<BoundedBody> {
  const source = request.body
  if (source === null) {
    return { ok: true, text: '' }
  }

  const reader = source.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  let exceeded = false

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      received += value.byteLength
      if (received > MAX_RESEARCH_BODY_BYTES) {
        exceeded = true
        continue
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  if (exceeded) {
    return { ok: false, reason: 'Body exceeds the maximum allowed size.' }
  }

  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { ok: true, text: new TextDecoder().decode(bytes) }
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
