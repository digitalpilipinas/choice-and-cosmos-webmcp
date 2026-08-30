import type { CosmicProfile } from '../domain/cosmic.ts'
import type { HorizonId, ReportSectionId } from '../domain/types.ts'

export type ResearchMode = 'auto' | 'fixture' | 'manual'

export type ResearchProvider = 'gemini' | 'fixture' | 'manual' | 'agent'

export type ResearchMethod =
  | 'google_search'
  | 'local_fixture'
  | 'user_supplied_link'
  | 'untrusted_submission'

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

export type EvidenceProvenance =
  | {
      provider: 'gemini'
      method: 'google_search'
      retrievedAt: string
      query: string
    }
  | {
      provider: 'fixture'
      method: 'local_fixture'
      retrievedAt: string
      query: string
    }
  | {
      provider: 'manual'
      method: 'user_supplied_link'
      retrievedAt: string
      query: string
    }
  | {
      provider: 'agent'
      method: 'untrusted_submission'
      query: string
      retrievedAt?: never
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

/** Same-origin mount. Worker and client share this string. */
export const RESEARCH_API_PATH = '/api/research'

export const RESEARCH_BRIEF_SCHEMA_VERSION = 2
export const RESEARCH_BUNDLE_SCHEMA_VERSION = 2

export const RESEARCH_STATUSES = [
  'ready',
  'partial',
  'unavailable',
  'disabled',
  'cancelled',
  'timed_out',
  'quota_exceeded',
  'provider_error',
  'invalid_provider_output',
  'invalid_input',
] as const

export type ResearchStatus = (typeof RESEARCH_STATUSES)[number]

export interface ResearchBrief {
  schemaVersion: 2
  horizon: HorizonId
  focus: string
  tone: 'grounded' | 'curious' | 'bold'
  cosmic: CosmicProfile
  requestedLenses: ReportSectionId[]
}

export interface GroundedClaim {
  id: string
  lens: ReportSectionId
  text: string
  sourceIds: [string, ...string[]]
}

export interface SkippedLens {
  lens: ReportSectionId
  reason: string
}

export interface PersonalizedRequest {
  schemaVersion: 2
  mode: ResearchMode
  brief: ResearchBrief
  manualUrls: string[]
}

interface BundleFields {
  schemaVersion: 2
  brief: ResearchBrief | null
  sources: ResearchSource[]
  claims: GroundedClaim[]
  skippedLenses: SkippedLens[]
  coverage: ResearchCoverage
  untrustedText: string
  adopted: false
}

export type PersonalizedResearchBundle =
  | (BundleFields & { status: 'ready' })
  | (BundleFields & { status: 'partial'; reason: string })
  | (BundleFields & {
      status: Exclude<ResearchStatus, 'ready' | 'partial'>
      reason: string
    })
