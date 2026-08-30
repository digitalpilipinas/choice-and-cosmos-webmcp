import type { CosmicProfile } from './cosmic.ts'
import type { ModularBeliefs } from './profile.ts'
import type { BriefDigest, PacketDigest } from './brand.ts'
import type { PacketIntake } from '../research/coordinator.ts'
import type { ReadingArtifact, ReadingDesk } from './trust.ts'
export type { ReadingArtifact, ReadingDesk }

export type HorizonId = 'daily' | 'weekly' | 'yearly'

export type HorizonName = 'Signal' | 'Compass' | 'Constellation'

export interface HorizonDefinition {
  id: HorizonId
  label: HorizonName
  tagline: string
  windowDescription: string
}

export type PhaseId =
  | 'context'
  | 'cosmos'
  | 'contrast'
  | 'choice'
  | 'continuity'

export interface ContextProfile {
  displayName: string
  focusIntention: string
  tone: 'grounded' | 'curious' | 'bold'
}

export interface DerivedProfile extends ContextProfile {
  cosmic: CosmicProfile
}

export interface PersonProfile extends ContextProfile {
  beliefs: ModularBeliefs
}

export type ReportSectionId =
  | 'energyOverview'
  | 'numerology'
  | 'humanDesign'
  | 'westernAstrology'
  | 'chineseElemental'
  | 'lifeAreas'
  | 'decisionSupport'
  | 'tarotOracle'
  | 'focusActionPlan'
  | 'symbolicCodes'
  | 'higherSelfLetter'

export type ResonanceMark = 'resonates' | 'not-for-me' | 'unsure'
export type ResonanceMap = Partial<Record<ReportSectionId, ResonanceMark>>

export interface ReportSection {
  id: ReportSectionId
  title: string
  frameworkLabel: string
  reflection: string
  evidenceIds: string[]
}

export interface EvidenceItem {
  id: string
  label: string
  sourceType: 'fixture'
  note: string
}

export type ForecastSource = 'fixture' | 'manual'

export interface CoverageSummary {
  sourcesConsidered: number
  sourcesUsed: number
  timeWindowDescription: string
  stoppingReason: string
  mode: ForecastSource
}

export interface ForecastCockpit {
  horizon: HorizonId
  name: HorizonName
  tagline: string
  windowDescription: string
  focusIntention: string
  generatedAt: string | null
}

export type UncertaintyState =
  | { kind: 'unavailable'; reason: string }
  | {
      kind: 'partial'
      source: ForecastSource
      coverage: CoverageSummary
      limitations: string
    }
  | {
      kind: 'ready'
      source: ForecastSource
      coverage: CoverageSummary
      limitations: string
    }

export type ChoiceStepStatus = 'proposed' | 'accepted' | 'dismissed'

export type ChoiceStepOrigin = 'fixture' | 'custom'

export interface ChoiceStep {
  id: string
  title: string
  rationale: string
  status: ChoiceStepStatus
  userNote: string
  origin: ChoiceStepOrigin
}

export interface ChoicePlanDraft {
  horizon: HorizonId
  createdAt: string
  steps: ChoiceStep[]
  freeWillNote: string
}

export interface ForecastFixture {
  horizon: HorizonId
  generatedAt: string
  sections: ReportSection[]
  evidence: EvidenceItem[]
  coverage: CoverageSummary
  suggestedSteps: ChoiceStep[]
}

export type PersistenceErrorOperation = 'save' | 'decline' | 'erase'

export type PersistenceStatus =
  | { kind: 'checking' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'undecided' }
  | { kind: 'held'; savedAt: string }
  | { kind: 'declined' }
  | { kind: 'saving' }
  | { kind: 'saved'; savedAt: string }
  | { kind: 'error'; operation: PersistenceErrorOperation; message: string }

export interface StoredSessionV1 {
  schemaVersion: 1
  savedAt: string
  phase: PhaseId
  horizon: HorizonId
  profile: ContextProfile
  forecastsByHorizon: Record<HorizonId, ForecastFixture | null>
  plansByHorizon: Record<HorizonId, ChoicePlanDraft | null>
}

export interface StoredSessionV2 {
  schemaVersion: 2
  savedAt: string
  phase: PhaseId
  horizon: HorizonId
  profile: DerivedProfile
  forecastsByHorizon: Record<HorizonId, ForecastFixture | null>
  plansByHorizon: Record<HorizonId, ChoicePlanDraft | null>
}

export interface StoredSessionV3 {
  schemaVersion: 3
  savedAt: string
  phase: PhaseId
  horizon: HorizonId
  profile: PersonProfile
  forecastsByHorizon: Record<HorizonId, ForecastFixture | null>
  readingsByHorizon: Record<HorizonId, ReadingArtifact | null>
  resonanceByHorizon: Record<HorizonId, ResonanceMap | null>
  plansByHorizon: Record<HorizonId, ChoicePlanDraft | null>
}

export type AgentAvailability =
  | { kind: 'checking' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'ready' }

export type ConfirmationKind =
  | 'personal_data_access'
  | 'research_brief'
  | 'profile_update'
  | 'external_share'
  | 'plan_save'
  | 'adopt_reading'

export type ProfileField = keyof ContextProfile

export const PROFILE_ACCESS_FIELDS = [
  'displayName',
  'focusIntention',
  'tone',
  'beliefs.western',
  'beliefs.numerology',
  'beliefs.chinese',
  'beliefs.bazi',
  'beliefs.humanDesign',
] as const

export type ProfileAccessField = (typeof PROFILE_ACCESS_FIELDS)[number]

export const DEFAULT_PROFILE_ACCESS_FIELDS: readonly ProfileAccessField[] = [
  'displayName',
  'focusIntention',
  'tone',
]

export type ProfileUpdatePatch = Partial<ContextProfile> & {
  beliefs?: ModularBeliefs
}

export type ShareInclude = 'profile' | 'forecast' | 'plan'

export type ConfirmationPayload =
  | { kind: 'personal_data_access'; fields?: ProfileAccessField[] }
  | {
      kind: 'research_brief'
      horizon: HorizonId
      briefDigest: BriefDigest
      fields: ProfileAccessField[]
      snapshot: {
        focus: string
        tone: ContextProfile['tone']
        requestedLenses: ReportSectionId[]
        skippedLenses: ReportSectionId[]
      }
    }
  | { kind: 'profile_update'; proposed: ProfileUpdatePatch }
  | {
      kind: 'external_share'
      include: ShareInclude[]
    }
  | { kind: 'plan_save'; horizon: HorizonId }
  | {
      kind: 'adopt_reading'
      packetDigest: PacketDigest
      horizon: HorizonId
    }

export type ConfirmationState =
  | { status: 'idle' }
  | {
      status: 'pending'
      id: string
      kind: ConfirmationKind
      summary: string
      payload: ConfirmationPayload
    }
  | {
      status: 'approved'
      id: string
      kind: ConfirmationKind
      payload: ConfirmationPayload
      sessionPersist?: 'unchanged' | 'granted'
    }
  | { status: 'denied'; id: string; kind: ConfirmationKind }

export type ExternalShareState =
  | { kind: 'none' }
  | {
      kind: 'approved_not_sent'
      include: ShareInclude[]
      reason: string
    }
  | { kind: 'denied' }

export interface AppState {
  phase: PhaseId
  horizon: HorizonId
  profile: PersonProfile
  forecastsByHorizon: Record<HorizonId, ForecastFixture | null>
  readingsByHorizon: Record<HorizonId, ReadingArtifact | null>
  resonanceByHorizon: Record<HorizonId, ResonanceMap | null>
  plansByHorizon: Record<HorizonId, ChoicePlanDraft | null>
  persistence: PersistenceStatus
  agentAvailability: AgentAvailability
  confirmation: ConfirmationState
  desk: ReadingDesk
  intake: PacketIntake
  externalShare: ExternalShareState
}
