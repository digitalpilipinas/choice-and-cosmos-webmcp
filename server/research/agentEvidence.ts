import type {
  EvidenceProvenance,
  PersonalizedResearchBundle,
  ResearchBrief,
  ResearchSource,
} from '../../src/research/contract.ts'
import { ALWAYS_LENSES, planLenses } from '../../src/research/lenses.ts'
import { coverageFor, applyHorizonLimits, parseHttpUrl, toSource } from './normalize.ts'

export interface AgentEvidenceNormalization {
  bundle: PersonalizedResearchBundle
  adopted: false
}

export function agentProvenance(query: string): Extract<
  EvidenceProvenance,
  { provider: 'agent' }
> {
  return { provider: 'agent', method: 'untrusted_submission', query }
}

export function normalizeUntrustedAgentEvidence(
  raw: unknown,
  brief: ResearchBrief,
): AgentEvidenceNormalization {
  const sources = extractAgentSources(raw, brief)
  const limited = applyHorizonLimits(sources, brief.horizon)
  const planned = planLenses(brief.requestedLenses, brief.cosmic)
  const skipped = [...planned.skipped]
  for (const lens of planned.active) {
    if (!(ALWAYS_LENSES as readonly string[]).includes(lens) && limited.sources.length === 0) {
      skipped.push({
        lens,
        reason:
          'Agent-submitted evidence did not keep a cited http(s) source for this lens after filtering.',
      })
    }
  }
  const coverage = coverageFor({
    horizon: brief.horizon,
    mode: 'agent',
    sourcesConsidered: sources.length,
    sources: limited.sources,
    queriesUsed: 0,
    novelDomainsUsed: limited.novelDomainsUsed,
    stoppingReason: `${limited.stoppingReason} Agent evidence is untrusted and is not adopted in this package.`,
  })
  const status =
    limited.sources.length === 0 ? ('invalid_provider_output' as const) : ('partial' as const)
  return {
    adopted: false,
    bundle: {
      schemaVersion: 2,
      status,
      reason:
        status === 'invalid_provider_output'
          ? 'Agent-submitted evidence had no usable http(s) citations after filtering. It was not adopted.'
          : 'Agent-submitted evidence was normalized as untrusted data and was not adopted.',
      brief,
      sources: limited.sources,
      claims: [],
      skippedLenses: skipped,
      coverage,
      untrustedText: '',
      adopted: false,
    },
  }
}

function extractAgentSources(
  raw: unknown,
  brief: ResearchBrief,
): ResearchSource[] {
  if (raw === null || typeof raw !== 'object') {
    return []
  }
  const record = raw as Record<string, unknown>
  const list = Array.isArray(record.sources)
    ? record.sources
    : Array.isArray(record.citations)
      ? record.citations
      : []
  const provenance = agentProvenance(brief.focus)
  return list.flatMap((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return []
    }
    const item = entry as Record<string, unknown>
    const url = typeof item.url === 'string' ? item.url : null
    if (url === null || parseHttpUrl(url) === null) {
      return []
    }
    const title = typeof item.title === 'string' ? item.title : ''
    const snippet = typeof item.snippet === 'string' ? item.snippet : ''
    const source = toSource({ title, url, snippet }, provenance)
    return source === null || source.url === null ? [] : [source]
  })
}
