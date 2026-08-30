import type {
  PersonalizedResearchBundle,
  ResearchCoverage,
  ResearchError,
  ResearchMode,
  ResearchResult,
} from '../../src/research/contract.ts'
import { parseResearchBody } from './input.ts'
import { runPersonalized } from './personalized.ts'
import type { QuotaStore } from './quota.ts'
import { createD1QuotaStore, type D1Database } from './quotaD1.ts'
import { runResearch, type ResearchDeps, type ResearchEnv } from './run.ts'

export const MAX_RESEARCH_BODY_BYTES = 128 * 1024

const JSON_CONTENT_TYPE = /^application\/json(\s*;.*)?$/i

type BoundedBody =
  | { ok: true; text: string }
  | { ok: false; reason: string }

export interface HandlerDeps extends Partial<ResearchDeps> {
  db?: D1Database
  quota?: QuotaStore
}

export async function handleResearchRequest(
  request: Request,
  deps: HandlerDeps = {},
): Promise<Response> {
  if (request.method !== 'POST') {
    return json(invalid('POST JSON to this handler. Other methods are not supported.'), 405)
  }

  const contentType = request.headers.get('content-type')
  if (contentType === null || !JSON_CONTENT_TYPE.test(contentType)) {
    return json(invalid('Content-Type must be application/json.'), 400)
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

  const parsed = parseResearchBody(body)
  if (!parsed.ok) {
    return json(
      researchHttpError({
        declaredVersion: parsed.declaredVersion,
        code: 'invalid_input',
        reason: parsed.reason,
      }),
      400,
    )
  }

  const researchDeps: ResearchDeps = {
    env: deps.env ?? readEnv(),
    fetchImpl: deps.fetchImpl,
    now: deps.now,
    timeoutMs: deps.timeoutMs,
    signal: deps.signal ?? request.signal,
    quota: deps.quota ?? (deps.db === undefined ? undefined : createD1QuotaStore(deps.db)),
    trustedVisitorIp: deps.trustedVisitorIp,
  }

  try {
    if (parsed.version === 2) {
      const bundle = await runPersonalized(parsed.value, researchDeps)
      return json(bundle, bundle.status === 'invalid_input' ? 400 : 200)
    }
    const result = await runResearch(parsed.value, researchDeps)
    return json(result, result.outcome === 'error' ? 400 : 200)
  } catch {
    const failure = researchHttpError({
      declaredVersion: parsed.version,
      code: 'handler_error',
      reason:
        'The research handler failed before a research outcome could be produced.',
      mode: parsed.version === 2 ? parsed.value.mode : 'auto',
    })
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
        await reader.cancel()
        break
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

export function researchHttpError(input: {
  declaredVersion: 1 | 2
  code: 'invalid_input' | 'handler_error'
  reason: string
  mode?: ResearchMode
}): ResearchError | PersonalizedResearchBundle {
  if (input.declaredVersion !== 2) {
    return {
      outcome: 'error',
      code: input.code,
      reason: input.reason,
    }
  }
  return {
    schemaVersion: 2,
    status: input.code === 'invalid_input' ? 'invalid_input' : 'unavailable',
    reason: input.reason,
    brief: null,
    sources: [],
    claims: [],
    skippedLenses: [],
    coverage: errorCoverage(input.reason, input.mode ?? 'auto'),
    untrustedText: '',
    adopted: false,
  }
}

function errorCoverage(reason: string, mode: ResearchMode): ResearchCoverage {
  return {
    sourcesConsidered: 0,
    sourcesUsed: 0,
    queriesUsed: 0,
    novelDomainsUsed: 0,
    timeWindowDescription: 'No search window was used.',
    stoppingReason: reason,
    mode: mode === 'fixture' || mode === 'manual' ? mode : 'agent',
    exhaustive: false,
  }
}

function json(
  body: ResearchResult | PersonalizedResearchBundle,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function readEnv(): ResearchEnv {
  const runtime = globalThis as {
    process?: {
      env?: {
        GEMINI_API_KEY?: string
        RESEARCH_ENABLED?: string
        QUOTA_HASH_SECRET?: string
      }
    }
  }
  const env = runtime.process?.env
  return {
    GEMINI_API_KEY: typeof env?.GEMINI_API_KEY === 'string' ? env.GEMINI_API_KEY : undefined,
    RESEARCH_ENABLED:
      typeof env?.RESEARCH_ENABLED === 'string' ? env.RESEARCH_ENABLED : undefined,
    QUOTA_HASH_SECRET:
      typeof env?.QUOTA_HASH_SECRET === 'string' ? env.QUOTA_HASH_SECRET : undefined,
  }
}
