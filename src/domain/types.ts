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

export interface DerivedProfile {
  displayName: string
  focusIntention: string
  tone: 'grounded' | 'curious' | 'bold'
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
  profile: DerivedProfile
  forecastsByHorizon: Record<HorizonId, ForecastFixture | null>
  plansByHorizon: Record<HorizonId, ChoicePlanDraft | null>
}

export type AgentAvailability =
  | { kind: 'checking' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'ready' }

export type ConfirmationKind =
  | 'personal_data_access'
  | 'profile_update'
  | 'external_share'
  | 'plan_save'

export type ProfileField = keyof DerivedProfile

export type ShareInclude = 'profile' | 'forecast' | 'plan'

export type ConfirmationPayload =
  | { kind: 'personal_data_access' }
  | { kind: 'profile_update'; proposed: Partial<DerivedProfile> }
  | {
      kind: 'external_share'
      destination: 'gemini-research'
      include: ShareInclude[]
    }
  | { kind: 'plan_save'; horizon: HorizonId }

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
      destination: 'gemini-research'
      include: ShareInclude[]
      reason: string
    }
  | { kind: 'denied'; destination: 'gemini-research' }

export interface AppState {
  phase: PhaseId
  horizon: HorizonId
  profile: DerivedProfile
  forecastsByHorizon: Record<HorizonId, ForecastFixture | null>
  plansByHorizon: Record<HorizonId, ChoicePlanDraft | null>
  persistence: PersistenceStatus
  agentAvailability: AgentAvailability
  confirmation: ConfirmationState
  externalShare: ExternalShareState
}
