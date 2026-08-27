import { timeWindowFor } from './caps.ts'
import {
  RESEARCH_API_PATH,
  RESEARCH_OUTCOMES,
  type ResearchCoverage,
  type ResearchRequestInput,
  type ResearchResult,
  type ResearchSource,
} from './contract.ts'

export interface ResearchClientDeps {
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

const CANCELLED_REASON =
  'Research was cancelled. No live search completed.'

export async function postResearch(
  input: ResearchRequestInput,
  deps?: ResearchClientDeps,
): Promise<ResearchResult> {
  if (deps?.signal?.aborted) {
    return researchClientCancelled(CANCELLED_REASON, input)
  }

  const fetchImpl = deps?.fetchImpl ?? globalThis.fetch
  try {
    const response = await fetchImpl(RESEARCH_API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: deps?.signal,
    })
    if (response.status === 404) {
      return researchRouteUnavailable(
        'The research route was not found. No live search occurred.',
        input,
      )
    }
    const text = await response.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return researchRouteUnavailable(
        'The research route did not return JSON. No live search occurred.',
        input,
      )
    }
    if (!isResearchResult(parsed)) {
      return researchRouteUnavailable(
        'The research route did not return a research result. No live search occurred.',
        input,
      )
    }
    return parsed
  } catch (error) {
    if (isAbortError(error) || deps?.signal?.aborted) {
      return researchClientCancelled(CANCELLED_REASON, input)
    }
    return researchRouteUnavailable(
      'The research request failed before a response arrived. No live search occurred.',
      input,
    )
  }
}

export function researchRouteUnavailable(
  reason: string,
  input?: Pick<ResearchRequestInput, 'horizon'>,
): Extract<ResearchResult, { outcome: 'unavailable' }> {
  return {
    outcome: 'unavailable',
    reason,
    sources: [],
    coverage: emptyCoverage(reason, input?.horizon),
    modelText: '',
  }
}

export function researchClientCancelled(
  reason: string,
  input?: Pick<ResearchRequestInput, 'horizon'>,
): Extract<ResearchResult, { outcome: 'cancelled' }> {
  return {
    outcome: 'cancelled',
    reason,
    sources: [],
    coverage: emptyCoverage(reason, input?.horizon),
    modelText: '',
  }
}

function emptyCoverage(
  reason: string,
  horizon?: ResearchRequestInput['horizon'],
): ResearchCoverage {
  return {
    sourcesConsidered: 0,
    sourcesUsed: 0,
    queriesUsed: 0,
    novelDomainsUsed: 0,
    timeWindowDescription:
      horizon === undefined ? 'No search window was used.' : timeWindowFor(horizon),
    stoppingReason: reason,
    mode: 'fixture',
    exhaustive: false,
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isResearchResult(value: unknown): value is ResearchResult {
  if (!isRecord(value)) {
    return false
  }
  if (!RESEARCH_OUTCOMES.some((outcome) => outcome === value.outcome)) {
    return false
  }
  if (value.outcome === 'error') {
    return (
      (value.code === 'invalid_input' || value.code === 'handler_error') &&
      typeof value.reason === 'string'
    )
  }
  if (!Array.isArray(value.sources) || !value.sources.every(isResearchSource)) {
    return false
  }
  if (!isResearchCoverage(value.coverage) || typeof value.modelText !== 'string') {
    return false
  }
  if (value.outcome === 'ready' || value.outcome === 'partial') {
    return true
  }
  return typeof value.reason === 'string'
}

function isResearchSource(value: unknown): value is ResearchSource {
  if (!isRecord(value)) {
    return false
  }
  if (typeof value.id !== 'string' || typeof value.title !== 'string') {
    return false
  }
  if (value.url !== null && typeof value.url !== 'string') {
    return false
  }
  if (typeof value.snippet !== 'string') {
    return false
  }
  if (value.domain !== null && typeof value.domain !== 'string') {
    return false
  }
  if (!isRecord(value.provenance)) {
    return false
  }
  const { provenance } = value
  return (
    (provenance.provider === 'gemini' ||
      provenance.provider === 'fixture' ||
      provenance.provider === 'manual') &&
    (provenance.method === 'google_search' ||
      provenance.method === 'local_fixture' ||
      provenance.method === 'user_supplied_link') &&
    typeof provenance.retrievedAt === 'string' &&
    typeof provenance.query === 'string'
  )
}

function isResearchCoverage(value: unknown): value is ResearchCoverage {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.sourcesConsidered === 'number' &&
    typeof value.sourcesUsed === 'number' &&
    typeof value.queriesUsed === 'number' &&
    typeof value.novelDomainsUsed === 'number' &&
    typeof value.timeWindowDescription === 'string' &&
    typeof value.stoppingReason === 'string' &&
    (value.mode === 'gemini' ||
      value.mode === 'fixture' ||
      value.mode === 'manual') &&
    value.exhaustive === false
  )
}
