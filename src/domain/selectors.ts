import { HORIZON_BY_ID } from '../fixtures/horizons.ts'
import type {
  AppState,
  ChoicePlanDraft,
  CoverageSummary,
  DerivedProfile,
  EvidenceItem,
  ForecastCockpit,
  ForecastFixture,
  ForecastSource,
  HorizonId,
  PersistenceStatus,
  ReportSection,
  UncertaintyState,
} from './types.ts'

export function currentForecast(state: AppState): ForecastFixture | null {
  return state.forecastsByHorizon[state.horizon]
}

export function currentPlan(state: AppState): ChoicePlanDraft | null {
  return state.plansByHorizon[state.horizon]
}

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
  profile: DerivedProfile,
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
  field: 'displayName' | 'focusIntention' | 'tone'
  label: string
  from: string
  to: string
}

export function profileUpdateDiff(
  current: DerivedProfile,
  proposed: Partial<DerivedProfile>,
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
  return diffs
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
