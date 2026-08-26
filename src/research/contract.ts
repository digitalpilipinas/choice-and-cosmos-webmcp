import type { HorizonId } from '../domain/types.ts'

export type ResearchMode = 'auto' | 'fixture' | 'manual'

export type ResearchProvider = 'gemini' | 'fixture' | 'manual'

export type ResearchMethod =
  | 'google_search'
  | 'local_fixture'
  | 'user_supplied_link'

export type ResearchOutcomeKind =
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'cancelled'
  | 'timed_out'
  | 'error'

export interface HorizonCaps {
  maxSources: number
  maxQueries: number
  maxNovelDomains: number
  timeoutMs: number
}

export interface EvidenceProvenance {
  provider: ResearchProvider
  method: ResearchMethod
  retrievedAt: string
  query: string
}

export interface ResearchSource {
  id: string
  title: string
  url: string | null
  snippet: string
  domain: string | null
  provenance: EvidenceProvenance
}

export interface ResearchCoverage {
  sourcesConsidered: number
  sourcesUsed: number
  queriesUsed: number
  novelDomainsUsed: number
  timeWindowDescription: string
  stoppingReason: string
  mode: ResearchProvider
  exhaustive: false
}

export interface ResearchRequestInput {
  horizon: HorizonId
  query: string
  mode: ResearchMode
  manualUrls: string[]
}

export interface ResearchReady {
  outcome: 'ready'
  sources: ResearchSource[]
  coverage: ResearchCoverage
  modelText: string
}

export interface ResearchPartial {
  outcome: 'partial'
  sources: ResearchSource[]
  coverage: ResearchCoverage
  modelText: string
}

export interface ResearchUnavailable {
  outcome: 'unavailable'
  reason: string
  sources: ResearchSource[]
  coverage: ResearchCoverage
  modelText: string
}

export interface ResearchCancelled {
  outcome: 'cancelled'
  reason: string
  sources: ResearchSource[]
  coverage: ResearchCoverage
  modelText: string
}

export interface ResearchTimedOut {
  outcome: 'timed_out'
  reason: string
  sources: ResearchSource[]
  coverage: ResearchCoverage
  modelText: string
}

export interface ResearchError {
  outcome: 'error'
  code: 'invalid_input' | 'handler_error'
  reason: string
}

export type ResearchResult =
  | ResearchReady
  | ResearchPartial
  | ResearchUnavailable
  | ResearchCancelled
  | ResearchTimedOut
  | ResearchError

export const RESEARCH_OUTCOMES = [
  'ready',
  'partial',
  'unavailable',
  'cancelled',
  'timed_out',
  'error',
] as const satisfies readonly ResearchOutcomeKind[]
