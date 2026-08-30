import { HORIZON_BY_ID } from '../fixtures/horizons.ts'
import { isPersonalized, type ReadingArtifact } from './trust.ts'
import type { ModularBeliefs } from './profile.ts'
import type {
  AppState,
  ChoicePlanDraft,
  CoverageSummary,
  ContextProfile,
  PersonProfile,
  EvidenceItem,
  ForecastCockpit,
  ForecastFixture,
  ForecastSource,
  HorizonId,
  PersistenceStatus,
  ProfileUpdatePatch,
  ReportSection,
  UncertaintyState,
} from './types.ts'

export function currentForecast(state: AppState): ForecastFixture | null {
  return state.forecastsByHorizon[state.horizon]
}

export function currentPlan(state: AppState): ChoicePlanDraft | null {
  return state.plansByHorizon[state.horizon]
}

export function currentReading(state: AppState): ReadingArtifact | null {
  return state.readingsByHorizon[state.horizon]
}

export function currentHorizonView(state: AppState): {
  artifact: ReadingArtifact | null
  fixture: ForecastFixture | null
  personalized: boolean
} {
  const artifact = currentReading(state)
  return {
    artifact,
    fixture: currentForecast(state),
    personalized: isPersonalized(artifact),
  }
}

export { isPersonalized }

export type CoverageLevel = 'light' | 'typical' | 'broad'

export function coverageLevel(coverage: CoverageSummary): CoverageLevel {
  const ratio =
    coverage.sourcesConsidered === 0
      ? 0
      : Math.min(1, Math.max(0, coverage.sourcesUsed / coverage.sourcesConsidered))

  if (ratio < 0.4) {
    return 'light'
  }
  if (ratio < 0.75) {
    return 'typical'
  }
  return 'broad'
}

export const COVERAGE_LEVEL_COPY: Record<CoverageLevel, string> = {
  light:
    'Light coverage: this reading leaned on a small slice of the cataloged fixture pool.',
  typical:
    'Typical coverage: this reading used a middle slice of the cataloged fixture pool.',
  broad:
    'Broad coverage: this reading used most of the cataloged fixture pool for this horizon.',
}

const UNAVAILABLE_REASON =
  'No forecast is in memory for this horizon yet. Nothing has been generated, so there is no coverage to report.'

const LIMITATIONS_BY_SOURCE: Record<ForecastSource, string> = {
  fixture:
    'This reading uses fixture example data, not live research. Coverage counts describe how much of the cataloged pool was used. They are not a confidence score, and they do not predict an outcome. You keep free will and may set the whole reading aside.',
  manual:
    'This reading uses manual links you supplied, not live research. This preview did not fetch or search them. Coverage counts describe how much of the cataloged pool was used. They are not a confidence score, and they do not predict an outcome. You keep free will and may set the whole reading aside.',
}

export function forecastCockpit(
  horizon: HorizonId,
  profile: PersonProfile,
  forecast: ForecastFixture | null,
): ForecastCockpit {
  const definition = HORIZON_BY_ID[horizon]
  return {
    horizon,
    name: definition.label,
    tagline: definition.tagline,
    windowDescription: definition.windowDescription,
    focusIntention: profile.focusIntention,
    generatedAt: forecast === null ? null : forecast.generatedAt,
  }
}

export function uncertaintyFor(
  forecast: ForecastFixture | null,
): UncertaintyState {
  if (forecast === null) {
    return { kind: 'unavailable', reason: UNAVAILABLE_REASON }
  }

  const { coverage } = forecast
  const kind = coverage.sourcesUsed > 0 ? 'ready' : 'partial'
  return {
    kind,
    source: coverage.mode,
    coverage,
    limitations: LIMITATIONS_BY_SOURCE[coverage.mode],
  }
}

export function evidenceForSection(
  forecast: ForecastFixture,
  section: ReportSection,
): EvidenceItem[] {
  return section.evidenceIds.flatMap((id) => {
    const item = forecast.evidence.find((entry) => entry.id === id)
    return item === undefined ? [] : [item]
  })
}

export function sectionsCitingEvidence(
  forecast: ForecastFixture,
  evidenceId: string,
): ReportSection[] {
  return forecast.sections.filter((section) =>
    section.evidenceIds.includes(evidenceId),
  )
}

export type ProfileFieldDiff = {
  field: string
  label: string
  from: string
  to: string
}

const BELIEF_LABELS: { [K in keyof Required<ModularBeliefs>]: string } = {
  western: 'Western astrology',
  numerology: 'Numerology',
  chinese: 'Chinese astrology',
  bazi: 'BaZi',
  humanDesign: 'Human Design',
}

export function profileUpdateDiff(
  current: ContextProfile | PersonProfile,
  proposed: ProfileUpdatePatch,
): ProfileFieldDiff[] {
  const diffs: ProfileFieldDiff[] = []
  if (proposed.displayName !== undefined) {
    diffs.push({
      field: 'displayName',
      label: 'Display name',
      from: current.displayName,
      to: proposed.displayName,
    })
  }
  if (proposed.focusIntention !== undefined) {
    diffs.push({
      field: 'focusIntention',
      label: 'Focus intention',
      from: current.focusIntention.trim() || 'None written',
      to: proposed.focusIntention.trim() || 'None written',
    })
  }
  if (proposed.tone !== undefined) {
    diffs.push({
      field: 'tone',
      label: 'Tone',
      from: current.tone,
      to: proposed.tone,
    })
  }
  if (proposed.beliefs !== undefined) {
    for (const key of Object.keys(BELIEF_LABELS) as (keyof ModularBeliefs)[]) {
      const next = proposed.beliefs[key]
      if (next === undefined) {
        continue
      }
      diffs.push({
        field: `beliefs.${key}`,
        label: BELIEF_LABELS[key],
        from: formatBelief(
          'beliefs' in current ? current.beliefs[key] : undefined,
        ),
        to: formatBelief(next),
      })
    }
  }
  return diffs
}

function formatBelief(value: unknown): string {
  if (value === undefined) {
    return 'Not set'
  }
  return JSON.stringify(value)
}

export function persistSessionOffered(
  confirmation: AppState['confirmation'],
  persistence: PersistenceStatus,
): boolean {
  if (confirmation.status !== 'pending' || confirmation.kind !== 'plan_save') {
    return false
  }
  if (persistence.kind === 'unavailable' || persistence.kind === 'checking') {
    return false
  }
  return !hasPersistenceConsent(persistence)
}

export function hasPersistenceConsent(status: PersistenceStatus): boolean {
  switch (status.kind) {
    case 'saving':
    case 'saved':
      return true
    case 'error':
      return status.operation !== 'decline'
    case 'checking':
    case 'unavailable':
    case 'undecided':
    case 'held':
    case 'declined':
      return false
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}
