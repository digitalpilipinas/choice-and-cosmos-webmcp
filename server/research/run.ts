import { EVIDENCE_BY_HORIZON } from '../../src/fixtures/evidence.ts'
import { HORIZON_CAPS, NON_EXHAUSTIVE, timeoutSeconds } from '../../src/research/caps.ts'
import type {
  EvidenceProvenance,
  ResearchCoverage,
  ResearchProvider,
  ResearchRequestInput,
  ResearchResult,
  ResearchSource,
} from '../../src/research/contract.ts'
import { callGeminiSearch } from './gemini.ts'
import {
  applyHorizonLimits,
  coverageFor,
  toSource,
  type CitationCandidate,
} from './normalize.ts'

export interface ResearchEnv {
  GEMINI_API_KEY?: string
}

export interface ResearchDeps {
  env: ResearchEnv
  fetchImpl?: typeof fetch
  now?: () => Date
  timeoutMs?: number
  signal?: AbortSignal
}

const FIXTURE_FALLBACK_REASON =
  'No Gemini credentials are configured. Using local fixture evidence that was not fetched from the internet.'

const MANUAL_SNIPPET =
  'User-supplied link. The page was not fetched and its content was not sent anywhere.'

export async function runResearch(
  input: ResearchRequestInput,
  deps: ResearchDeps,
): Promise<ResearchResult> {
  const now = deps.now ?? (() => new Date())
  const retrievedAt = now().toISOString()
  const timeoutMs = deps.timeoutMs ?? HORIZON_CAPS[input.horizon].timeoutMs
  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = combineSignals(
    [deps.signal, timeout].filter((signal): signal is AbortSignal => signal !== undefined),
  )

  if (deps.signal?.aborted) {
    return interrupted('cancelled', input, 'Research was cancelled.')
  }

  const provider = resolveProvider(input, deps.env)
  try {
    if (provider === 'manual') {
      return runManual(input, retrievedAt)
    }
    if (provider === 'fixture') {
      const reason =
        input.mode === 'fixture'
          ? 'Using local fixture evidence that was not fetched from the internet.'
          : FIXTURE_FALLBACK_REASON
      return runFixture(input, retrievedAt, reason)
    }
    return await runGemini(input, deps, retrievedAt, combined, timeout, deps.signal)
  } catch (error) {
    if (isAbortError(error)) {
      if (deps.signal?.aborted) {
        return interrupted('cancelled', input, 'Research was cancelled.')
      }
      return interrupted(
        'timed_out',
        input,
        `Research timed out after the ${input.horizon} budget of ${timeoutSeconds(input.horizon)} seconds. ${NON_EXHAUSTIVE}`,
      )
    }
    return runFixture(
      input,
      retrievedAt,
      `Gemini Search was unavailable. Using local fixture evidence that was not fetched from the internet. ${NON_EXHAUSTIVE}`,
    )
  }
}

function resolveProvider(
  input: ResearchRequestInput,
  env: ResearchEnv,
): ResearchProvider {
  if (input.mode === 'manual') {
    return 'manual'
  }
  if (input.mode === 'fixture') {
    return 'fixture'
  }
  return hasApiKey(env) ? 'gemini' : 'fixture'
}

function hasApiKey(env: ResearchEnv): boolean {
  return typeof env.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim().length > 0
}

function runFixture(
  input: ResearchRequestInput,
  retrievedAt: string,
  reason: string,
): ResearchResult {
  const provenance: EvidenceProvenance = {
    provider: 'fixture',
    method: 'local_fixture',
    retrievedAt,
    query: input.query,
  }
  const candidates = EVIDENCE_BY_HORIZON[input.horizon].flatMap((item) => {
    const source = toSource(
      { title: item.label, url: null, snippet: item.note },
      provenance,
    )
    return source === null ? [] : [source]
  })
  const limited = applyHorizonLimits(candidates, input.horizon)
  const stoppingReason = `${reason} ${limited.stoppingReason}`
  const coverage = coverageFor({
    horizon: input.horizon,
    mode: 'fixture',
    sourcesConsidered: limited.sourcesConsidered,
    sources: limited.sources,
    queriesUsed: 0,
    novelDomainsUsed: 0,
    stoppingReason,
  })
  if (limited.sources.length === 0) {
    return {
      outcome: 'unavailable',
      reason: stoppingReason,
      sources: [],
      coverage,
      modelText: '',
    }
  }
  return {
    outcome: 'ready',
    sources: limited.sources,
    coverage,
    modelText: '',
  }
}

function runManual(
  input: ResearchRequestInput,
  retrievedAt: string,
): ResearchResult {
  const provenance: EvidenceProvenance = {
    provider: 'manual',
    method: 'user_supplied_link',
    retrievedAt,
    query: input.query,
  }
  const candidates = input.manualUrls.flatMap((raw) => {
    const source = toSource(
      { title: '', url: raw, snippet: MANUAL_SNIPPET },
      provenance,
    )
    return source === null ? [] : [source]
  })
  const limited = applyHorizonLimits(candidates, input.horizon)
  const stoppingReason =
    limited.sources.length === 0
      ? `No valid http(s) manual links remained after validation, deduplication, and caps. ${NON_EXHAUSTIVE}`
      : limited.stoppingReason
  const coverage = coverageFor({
    horizon: input.horizon,
    mode: 'manual',
    sourcesConsidered: input.manualUrls.length,
    sources: limited.sources,
    queriesUsed: 0,
    novelDomainsUsed: limited.novelDomainsUsed,
    stoppingReason,
  })
  if (limited.sources.length === 0) {
    return {
      outcome: 'unavailable',
      reason: stoppingReason,
      sources: [],
      coverage,
      modelText: '',
    }
  }
  return {
    outcome: 'ready',
    sources: limited.sources,
    coverage,
    modelText: '',
  }
}

async function runGemini(
  input: ResearchRequestInput,
  deps: ResearchDeps,
  retrievedAt: string,
  signal: AbortSignal,
  timeoutSignal: AbortSignal,
  requestSignal: AbortSignal | undefined,
): Promise<ResearchResult> {
  const apiKey = deps.env.GEMINI_API_KEY?.trim() ?? ''
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch
  const called = await callGeminiSearch({
    query: input.query,
    horizon: input.horizon,
    apiKey,
    fetchImpl,
    signal,
  })
  const provenance: EvidenceProvenance = {
    provider: 'gemini',
    method: 'google_search',
    retrievedAt,
    query: input.query,
  }
  const candidates = called.citations.flatMap((citation: CitationCandidate) => {
    const source = toSource(citation, provenance)
    return source === null ? [] : [source]
  })
  const limited = applyHorizonLimits(candidates, input.horizon)
  const queriesUsed = Math.min(1, HORIZON_CAPS[input.horizon].maxQueries)
  const coverage = coverageFor({
    horizon: input.horizon,
    mode: 'gemini',
    sourcesConsidered: called.citations.length,
    sources: limited.sources,
    queriesUsed,
    novelDomainsUsed: limited.novelDomainsUsed,
    stoppingReason: limited.stoppingReason,
  })
  const modelText = called.modelText

  if (requestSignal?.aborted) {
    return interrupted('cancelled', input, 'Research was cancelled.', {
      sources: limited.sources,
      coverage,
      modelText,
    })
  }
  if (timeoutSignal.aborted) {
    return interrupted(
      'timed_out',
      input,
      `Research timed out after the ${input.horizon} budget of ${timeoutSeconds(input.horizon)} seconds. ${NON_EXHAUSTIVE}`,
      { sources: limited.sources, coverage, modelText },
    )
  }

  if (limited.sources.length === 0 && modelText.length === 0) {
    const reason = `Gemini Search returned no usable http(s) citations. ${NON_EXHAUSTIVE}`
    return {
      outcome: 'unavailable',
      reason,
      sources: [],
      coverage: { ...coverage, stoppingReason: reason },
      modelText: '',
    }
  }
  if (limited.sources.length === 0) {
    return {
      outcome: 'partial',
      sources: [],
      coverage: {
        ...coverage,
        stoppingReason: `Gemini Search returned text but no usable http(s) citations after filtering. ${NON_EXHAUSTIVE}`,
      },
      modelText,
    }
  }
  return {
    outcome: 'ready',
    sources: limited.sources,
    coverage,
    modelText,
  }
}

function interrupted(
  outcome: 'cancelled' | 'timed_out',
  input: ResearchRequestInput,
  reason: string,
  extras?: {
    sources: ResearchSource[]
    coverage: ResearchCoverage
    modelText: string
  },
): ResearchResult {
  const sources = extras?.sources ?? []
  const coverage =
    extras?.coverage ??
    coverageFor({
      horizon: input.horizon,
      mode: 'fixture',
      sourcesConsidered: 0,
      sources,
      queriesUsed: 0,
      novelDomainsUsed: 0,
      stoppingReason: reason,
    })
  return {
    outcome,
    reason,
    sources,
    coverage,
    modelText: extras?.modelText ?? '',
  }
}

function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) {
    const only = signals[0]
    if (only !== undefined) {
      return only
    }
  }
  const anyFn = (
    AbortSignal as { any?: (input: AbortSignal[]) => AbortSignal }
  ).any
  if (typeof anyFn === 'function') {
    return anyFn(signals)
  }
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      once: true,
    })
  }
  return controller.signal
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return true
  }
  return false
}
