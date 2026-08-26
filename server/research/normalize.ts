import {
  HORIZON_CAPS,
  NON_EXHAUSTIVE,
  timeWindowFor,
} from '../../src/research/caps.ts'
import type {
  EvidenceProvenance,
  HorizonCaps,
  ResearchCoverage,
  ResearchProvider,
  ResearchSource,
} from '../../src/research/contract.ts'
import type { HorizonId } from '../../src/domain/types.ts'

export interface CitationCandidate {
  title: string
  url: string | null
  snippet: string
}

export function asUntrustedText(value: unknown): string {
  if (typeof value === 'string') {
    return value.split('\0').join('').trim()
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

export function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    if (url.username !== '' || url.password !== '') {
      return null
    }
    return url
  } catch {
    return null
  }
}

export function domainOf(url: URL): string {
  return url.hostname.replace(/^www\./i, '').toLowerCase()
}

export function canonicalizeHref(url: URL): string {
  const path = url.pathname.replace(/\/+$/, '') || '/'
  return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`
}

export function evidenceIdFor(input: {
  url: string | null
  title: string
  provider: ResearchProvider
}): string {
  const material =
    input.url === null
      ? `local:${input.provider}:${input.title}`
      : input.url
  const digest = fnvHex(material, 16)
  return `ev_${digest}`
}

function fnvHex(input: string, chars: number): string {
  let hash = 2166136261
  for (const char of input) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  const low = (hash >>> 0).toString(16).padStart(8, '0')
  let second = 2166136261
  for (const char of `id:${input}`) {
    second ^= char.charCodeAt(0)
    second = Math.imul(second, 16777619)
  }
  const high = (second >>> 0).toString(16).padStart(8, '0')
  return `${low}${high}`.slice(0, chars)
}

export function toSource(
  candidate: CitationCandidate,
  provenance: EvidenceProvenance,
): ResearchSource | null {
  if (candidate.url === null) {
    const title = asUntrustedText(candidate.title)
    if (title.length === 0) {
      return null
    }
    return {
      id: evidenceIdFor({ url: null, title, provider: provenance.provider }),
      title,
      url: null,
      snippet: asUntrustedText(candidate.snippet),
      domain: null,
      provenance,
    }
  }

  const parsed = parseHttpUrl(candidate.url)
  if (parsed === null) {
    return null
  }
  const url = canonicalizeHref(parsed)
  const title = asUntrustedText(candidate.title) || parsed.hostname
  return {
    id: evidenceIdFor({ url, title, provider: provenance.provider }),
    title,
    url,
    snippet: asUntrustedText(candidate.snippet),
    domain: domainOf(parsed),
    provenance,
  }
}

export function applyHorizonLimits(
  candidates: readonly ResearchSource[],
  horizon: HorizonId,
): {
  sources: ResearchSource[]
  stoppingReason: string
  sourcesConsidered: number
  novelDomainsUsed: number
} {
  const caps: HorizonCaps = HORIZON_CAPS[horizon]
  const kept: ResearchSource[] = []
  const urls = new Set<string>()
  const ids = new Set<string>()
  const domains = new Set<string>()
  let hitSourceCap = false
  let hitDomainCap = false

  for (const source of candidates) {
    if (kept.length >= caps.maxSources) {
      hitSourceCap = true
      break
    }
    if (source.url !== null && urls.has(source.url)) {
      continue
    }
    if (ids.has(source.id)) {
      continue
    }
    if (source.domain !== null && !domains.has(source.domain)) {
      if (domains.size >= caps.maxNovelDomains) {
        hitDomainCap = true
        continue
      }
    }

    kept.push(source)
    ids.add(source.id)
    if (source.url !== null) {
      urls.add(source.url)
    }
    if (source.domain !== null) {
      domains.add(source.domain)
    }
  }

  const considered = candidates.length
  return {
    sources: kept,
    sourcesConsidered: considered,
    novelDomainsUsed: domains.size,
    stoppingReason: stoppingReason({
      horizon,
      caps,
      kept: kept.length,
      considered,
      hitSourceCap,
      hitDomainCap,
    }),
  }
}

export function coverageFor(input: {
  horizon: HorizonId
  mode: ResearchProvider
  sourcesConsidered: number
  sources: readonly ResearchSource[]
  queriesUsed: number
  novelDomainsUsed: number
  stoppingReason: string
}): ResearchCoverage {
  return {
    sourcesConsidered: input.sourcesConsidered,
    sourcesUsed: input.sources.length,
    queriesUsed: input.queriesUsed,
    novelDomainsUsed: input.novelDomainsUsed,
    timeWindowDescription: timeWindowFor(input.horizon),
    stoppingReason: input.stoppingReason,
    mode: input.mode,
    exhaustive: false,
  }
}

function stoppingReason(input: {
  horizon: HorizonId
  caps: HorizonCaps
  kept: number
  considered: number
  hitSourceCap: boolean
  hitDomainCap: boolean
}): string {
  if (input.hitSourceCap) {
    return `Reached the ${input.horizon} cap of ${input.caps.maxSources} sources. ${NON_EXHAUSTIVE}`
  }
  if (input.hitDomainCap) {
    return `Reached the ${input.horizon} cap of ${input.caps.maxNovelDomains} distinct domains. ${NON_EXHAUSTIVE}`
  }
  return `Collected ${input.kept} of ${input.considered} considered sources within the ${input.horizon} bounds. ${NON_EXHAUSTIVE}`
}
