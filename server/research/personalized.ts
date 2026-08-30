import { HORIZON_CAPS, NON_EXHAUSTIVE, timeoutSeconds } from '../../src/research/caps.ts'
import type {
  PersonalizedRequest,
  PersonalizedResearchBundle,
  ResearchBrief,
  ResearchCoverage,
  ResearchMode,
  ResearchResult,
  ResearchSource,
  ResearchStatus,
  SkippedLens,
} from '../../src/research/contract.ts'
import { ALWAYS_LENSES, planLenses } from '../../src/research/lenses.ts'
import { liveGate } from './gate.ts'
import {
  buildGeminiInputFromBrief,
  callGeminiSearch,
  InvalidProviderOutputError,
} from './gemini.ts'
import {
  applyHorizonLimits,
  coverageFor,
  coverageModeFor,
  toSource,
} from './normalize.ts'
import { hashVisitorIdentity, utcDay } from './quota.ts'
import { runResearch, type ResearchDeps } from './run.ts'

export async function runPersonalized(
  request: PersonalizedRequest,
  deps: ResearchDeps,
): Promise<PersonalizedResearchBundle> {
  const brief = request.brief
  if (request.mode === 'fixture' || request.mode === 'manual') {
    const legacy = await runResearch(
      {
        horizon: brief.horizon,
        query: brief.focus,
        mode: request.mode,
        manualUrls: request.manualUrls,
      },
      deps,
    )
    return bundleFromLegacy(brief, legacy, request.mode)
  }

  const now = deps.now ?? (() => new Date())
  const retrievedAt = now().toISOString()
  const timeoutMs = deps.timeoutMs ?? HORIZON_CAPS[brief.horizon].timeoutMs
  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = combineSignals(
    [deps.signal, timeout].filter((signal): signal is AbortSignal => signal !== undefined),
  )
  if (deps.signal?.aborted) {
    return closedBundle(brief, 'cancelled', 'Research was cancelled.', request.mode)
  }

  const gate = liveGate({
    env: deps.env,
    quota: deps.quota,
    trustedVisitorIp: deps.trustedVisitorIp,
  })
  if (gate.kind === 'disabled') {
    return closedBundle(brief, 'disabled', gate.reason, request.mode)
  }
  if (gate.kind !== 'ok') {
    return closedBundle(brief, 'unavailable', gate.reason, request.mode)
  }

  try {
    const visitorHash = await hashVisitorIdentity(gate.visitorIp, gate.secret)
    const reserved = await gate.quota.reserve(utcDay(now()), visitorHash, combined)
    if (reserved.kind === 'aborted') {
      return deps.signal?.aborted
        ? closedBundle(brief, 'cancelled', 'Research was cancelled.', request.mode)
        : closedBundle(
            brief,
            'timed_out',
            `Research timed out after the ${brief.horizon} budget of ${timeoutSeconds(brief.horizon)} seconds. ${NON_EXHAUSTIVE}`,
            request.mode,
          )
    }
    if (reserved.kind === 'quota_exceeded') {
      return closedBundle(
        brief,
        'quota_exceeded',
        `Gemini quota exceeded for the ${reserved.scope} UTC-day bucket. No provider call was made.`,
        request.mode,
      )
    }
    if (reserved.kind !== 'reserved') {
      return closedBundle(brief, 'unavailable', reserved.reason, request.mode)
    }
    if (combined.aborted) {
      const released = await gate.quota.release(utcDay(now()), visitorHash)
      if (released.kind !== 'released') {
        return closedBundle(brief, 'unavailable', released.reason, request.mode)
      }
      return deps.signal?.aborted
        ? closedBundle(brief, 'cancelled', 'Research was cancelled.', request.mode)
        : closedBundle(
            brief,
            'timed_out',
            `Research timed out after the ${brief.horizon} budget of ${timeoutSeconds(brief.horizon)} seconds. ${NON_EXHAUSTIVE}`,
            request.mode,
          )
    }

    const fetchImpl = deps.fetchImpl ?? globalThis.fetch
    const called = await callGeminiSearch({
      query: brief.focus,
      horizon: brief.horizon,
      apiKey: gate.apiKey,
      fetchImpl,
      signal: combined,
      prompt: buildGeminiInputFromBrief(brief),
    })
    const provenance = {
      provider: 'gemini' as const,
      method: 'google_search' as const,
      retrievedAt,
      query: brief.focus,
    }
    const candidates = called.citations.flatMap((citation) => {
      const source = toSource(citation, provenance)
      return source === null ? [] : [source]
    })
    const limited = applyHorizonLimits(candidates, brief.horizon)
    const coverage = coverageFor({
      horizon: brief.horizon,
      mode: 'gemini',
      sourcesConsidered: called.citations.length,
      sources: limited.sources,
      queriesUsed: Math.min(1, HORIZON_CAPS[brief.horizon].maxQueries),
      novelDomainsUsed: limited.novelDomainsUsed,
      stoppingReason: limited.stoppingReason,
    })

    if (deps.signal?.aborted) {
      return closedBundle(brief, 'cancelled', 'Research was cancelled.', request.mode, {
        sources: limited.sources,
        coverage,
        untrustedText: called.modelText,
      })
    }
    if (timeout.aborted) {
      return closedBundle(
        brief,
        'timed_out',
        `Research timed out after the ${brief.horizon} budget of ${timeoutSeconds(brief.horizon)} seconds. ${NON_EXHAUSTIVE}`,
        request.mode,
        {
          sources: limited.sources,
          coverage,
          untrustedText: called.modelText,
        },
      )
    }

    return bundleFromSources(brief, limited.sources, coverage, called.modelText)
  } catch (error) {
    if (isAbortError(error)) {
      if (deps.signal?.aborted) {
        return closedBundle(brief, 'cancelled', 'Research was cancelled.', request.mode)
      }
      return closedBundle(
        brief,
        'timed_out',
        `Research timed out after the ${brief.horizon} budget of ${timeoutSeconds(brief.horizon)} seconds. ${NON_EXHAUSTIVE}`,
        request.mode,
      )
    }
    if (error instanceof InvalidProviderOutputError) {
      return closedBundle(
        brief,
        'invalid_provider_output',
        'Gemini Search returned output that could not be used. No fixture fallback was used.',
        request.mode,
      )
    }
    return closedBundle(
      brief,
      'provider_error',
      `Gemini Search was unavailable. No fixture fallback was used. ${NON_EXHAUSTIVE}`,
      request.mode,
    )
  }
}

function bundleFromLegacy(
  brief: ResearchBrief,
  legacy: ResearchResult,
  mode: 'fixture' | 'manual',
): PersonalizedResearchBundle {
  if (legacy.outcome === 'error') {
    return closedBundle(brief, 'invalid_input', legacy.reason, mode)
  }
  const coverage = { ...legacy.coverage, mode }
  if (legacy.outcome === 'ready' || legacy.outcome === 'partial') {
    return bundleFromSources(
      brief,
      legacy.sources,
      coverage,
      legacy.modelText,
      legacy.outcome === 'partial'
        ? 'Research returned text but no usable http(s) citations after filtering.'
        : undefined,
      true,
    )
  }
  return closedBundle(brief, legacy.outcome, legacy.reason, mode, {
    sources: legacy.sources,
    coverage,
    untrustedText: legacy.modelText,
    nonPersonalized: true,
  })
}

function bundleFromSources(
  brief: ResearchBrief,
  sources: ResearchSource[],
  coverage: ResearchCoverage,
  untrustedText: string,
  partialReason?: string,
  nonPersonalized = false,
): PersonalizedResearchBundle {
  const lenses = evidenceLenses(brief, sources, nonPersonalized)
  const base = {
    schemaVersion: 2 as const,
    brief,
    sources,
    claims: [],
    skippedLenses: lenses.skipped,
    coverage,
    untrustedText,
    adopted: false as const,
  }
  if (sources.length === 0 && untrustedText.length === 0) {
    return {
      ...base,
      status: 'unavailable',
      reason: `No usable http(s) citations remained. ${NON_EXHAUSTIVE}`,
    }
  }
  if (sources.length === 0 || partialReason !== undefined) {
    return {
      ...base,
      status: 'partial',
      reason:
        partialReason ??
        `Research returned text but no usable http(s) citations after filtering. ${NON_EXHAUSTIVE}`,
    }
  }
  return { ...base, status: 'ready' }
}

function evidenceLenses(
  brief: ResearchBrief,
  sources: ResearchSource[],
  nonPersonalized: boolean,
): { skipped: SkippedLens[] } {
  const planned = planLenses(brief.requestedLenses, brief.cosmic)
  const skipped: SkippedLens[] = [...planned.skipped]
  for (const lens of planned.active) {
    const always = (ALWAYS_LENSES as readonly string[]).includes(lens)
    if (nonPersonalized && !always) {
      skipped.push({
        lens,
        reason:
          'Fixture and manual research is explicit and non-personalized. This lens is skipped rather than filled with generic copy.',
      })
      continue
    }
    if (!always && sources.length === 0) {
      skipped.push({
        lens,
        reason:
          'This lens is skipped because no cited http(s) sources remained after filtering.',
      })
    }
  }
  return { skipped }
}

function closedBundle(
  brief: ResearchBrief,
  status: Exclude<ResearchStatus, 'ready' | 'partial'>,
  reason: string,
  mode: ResearchMode,
  extras?: {
    sources: ResearchSource[]
    coverage: ResearchCoverage
    untrustedText: string
    nonPersonalized?: boolean
  },
): PersonalizedResearchBundle {
  const lenses = evidenceLenses(
    brief,
    extras?.sources ?? [],
    extras?.nonPersonalized === true,
  )
  return {
    schemaVersion: 2,
    status,
    reason,
    brief,
    sources: extras?.sources ?? [],
    claims: [],
    skippedLenses: lenses.skipped,
    coverage:
      extras?.coverage ??
      coverageFor({
        horizon: brief.horizon,
        mode: coverageModeFor(mode),
        sourcesConsidered: 0,
        sources: [],
        queriesUsed: 0,
        novelDomainsUsed: 0,
        stoppingReason: reason,
      }),
    untrustedText: extras?.untrustedText ?? '',
    adopted: false,
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
