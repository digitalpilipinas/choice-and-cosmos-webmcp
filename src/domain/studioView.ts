import type { Dispatch } from 'react'
import type { ExactResearchBrief } from '../research/brief.ts'
import { buildExactBrief } from '../research/brief.ts'
import { ALL_LENSES, planLensesForBeliefs } from '../research/lenses.ts'
import {
  intakeProgress,
  type IntakeProgress,
  type IntakeRejectCode,
  type PacketReview,
} from '../research/coordinator.ts'
import { ICS_EVENT_CAPS } from './bounds.ts'
import type { PacketDigest } from './brand.ts'
import { CHINESE_ELEMENTS } from './cosmic.ts'
import { hasBeliefModule, type ElementCounts } from './profile.ts'
import { fixtureHash } from '../fixtures/generateForecast.ts'
import { HORIZON_BY_ID } from '../fixtures/horizons.ts'
import {
  COVERAGE_LEVEL_COPY,
  coverageLevel,
  currentForecast,
  currentPlan,
  currentReading,
  hasPersistenceConsent,
} from './selectors.ts'
import { LIVE_RESEARCH_NOTICE } from './synthesis.ts'
import type { ReadingArtifact } from './trust.ts'
import type {
  AppState,
  ChoiceStep,
  ForecastCockpit,
  ForecastFixture,
  HorizonId,
  PersistenceStatus,
  PersonProfile,
  PhaseId,
  ReportSectionId,
  ResonanceMark,
} from './types.ts'
import type { AppAction } from './loop.ts'

export type ClaimKind = 'grounded' | 'reflective'
export type FrameworkKind = 'interpretive' | 'reflective'

export const CLAIM_KIND_LABEL: Record<ClaimKind, string> = {
  grounded: 'Grounded source notes',
  reflective: 'Reflective interpretation',
}

const INTERPRETIVE_IDS: readonly ReportSectionId[] = [
  'numerology',
  'humanDesign',
  'westernAstrology',
  'chineseElemental',
  'tarotOracle',
  'symbolicCodes',
]

export function frameworkKind(id: ReportSectionId): FrameworkKind {
  return INTERPRETIVE_IDS.includes(id) ? 'interpretive' : 'reflective'
}

export function frameworkKindLabel(kind: FrameworkKind): string {
  return kind === 'interpretive'
    ? 'Interpretive guide, not an objective prediction'
    : 'Reflective framework, not a command'
}

export interface ChartSlot {
  id: string
  label: string
  value: number
}

export interface ChartModel {
  id: string
  title: string
  caption: string
  valueHeader: string
  slots: ChartSlot[]
}

export interface StudioEvidenceCard {
  id: string
  label: string
  groundedNote: string
  url: string | null
  urlLabel: string
  providerLabel: string
  methodLabel: string
  retrievedAt: string | null
  citingTitles: string[]
}

export interface SkippedLensCopy {
  lens: ReportSectionId
  reason: string
}

export interface StudioSection {
  id: ReportSectionId
  title: string
  frameworkLabel: string
  frameworkKind: FrameworkKind
  frameworkKindLabel: string
  reflection: string
  groundedHeading: string
  reflectiveHeading: string
  evidence: StudioEvidenceCard[]
  resonanceMark: ResonanceMark | null
}

export interface StudioCoverage {
  heading: string
  modeCopy: string
  levelCopy: string | null
  sourcesConsidered: number
  sourcesUsed: number
  timeWindowDescription: string
  stoppingReason: string
  notConfidenceNote: string
  exhaustive: false
}

export type StudioUncertainty =
  | { kind: 'unavailable'; reason: string }
  | {
      kind: 'partial'
      sourceLabel: string
      coverage: StudioCoverage
      limitations: string
    }
  | {
      kind: 'ready'
      sourceLabel: string
      coverage: StudioCoverage
      limitations: string
    }

export type StudioReading =
  | {
      status: 'empty'
      emptyTitle: string
      emptyBody: string
    }
  | StudioReadingReady

type StudioReadingReady = {
  status: 'ready'
  lede: string
  legacyBadge: 'legacy' | null
  digestLine: string | null
  coverage: StudioCoverage
  sections: StudioSection[]
  evidence: StudioEvidenceCard[]
  skippedLenses: SkippedLensCopy[]
  charts: ChartModel[]
}

export type StudioIntake =
  | { status: 'idle'; horizon: HorizonId; blocked: boolean; progress: IntakeProgress }
  | {
      status: 'assembling'
      horizon: HorizonId
      blocked: boolean
      progress: IntakeProgress
    }
  | {
      status: 'ready'
      horizon: HorizonId
      blocked: boolean
      progress: IntakeProgress
      review: PacketReview
    }
  | {
      status: 'rejected'
      horizon: HorizonId
      blocked: boolean
      progress: IntakeProgress
      code: IntakeRejectCode
      reason: string
    }
  | {
      status: 'adopted'
      horizon: HorizonId
      blocked: boolean
      progress: IntakeProgress
      digest: PacketDigest
    }

export interface StudioResonance {
  options: readonly { mark: ResonanceMark; label: string }[]
}

export interface StudioChoice {
  freeWillNote: string
  steps: ChoiceStep[]
  notePlaceholder: string
}

export interface ContinuityReceiptStep {
  id: string
  title: string
  userNote: string
}

export interface PrintSheetModel {
  title: string
  digestLine: string
  adoptedAt: string
  horizonLabel: string
  windowDescription: string
  focusIntention: string
  coverage: StudioCoverage
  limitations: string
  freeWillNote: string
  sections: StudioSection[]
  evidence: StudioEvidenceCard[]
  skippedLenses: SkippedLensCopy[]
  acceptedSteps: ContinuityReceiptStep[]
}

export type ContinuityPrint =
  | { kind: 'unavailable'; reason: string }
  | { kind: 'available'; buttonLabel: string; sheet: PrintSheetModel }

export interface ContinuityCalendarAvailable {
  kind: 'available'
  artifact: ReadingArtifact
  acceptedSteps: ChoiceStep[]
  maxEvents: number
  capNote: string
}

export type ContinuityCalendar =
  | { kind: 'unavailable'; reason: string }
  | ContinuityCalendarAvailable

export interface StudioContinuity {
  displayName: string
  horizonLabel: string
  windowDescription: string
  focusIntention: string
  tone: string
  stampLabel: string
  stampValue: string
  adoptedDigest: string | null
  intro: string
  persistenceNote: string
  accepted: ContinuityReceiptStep[]
  dismissed: ContinuityReceiptStep[]
  proposed: ContinuityReceiptStep[]
  print: ContinuityPrint
  calendar: ContinuityCalendar
}

export interface StudioShellModel {
  phase: PhaseId
  continueLabel: string | null
  backEnabled: boolean
  continueEnabled: boolean
  showEvidenceRail: boolean
  emptyAdvanceHint: string | null
}

export interface StudioNotices {
  research: string
}

export interface StudioView {
  shell: StudioShellModel
  profile: PersonProfile
  horizon: HorizonId
  cockpit: ForecastCockpit
  uncertainty: StudioUncertainty
  coverage: StudioCoverage | null
  reading: StudioReading
  brief: ExactResearchBrief | null
  intake: StudioIntake
  resonance: StudioResonance
  choice: StudioChoice
  continuity: StudioContinuity
  notices: StudioNotices
  persistence: PersistenceStatus
}

export interface StudioPhaseProps {
  studio: StudioView
  dispatch: Dispatch<AppAction>
}

export const RESONANCE_OPTIONS: readonly { mark: ResonanceMark; label: string }[] = [
  { mark: 'resonates', label: 'Resonates' },
  { mark: 'not-for-me', label: 'Not for me' },
  { mark: 'unsure', label: 'Unsure' },
]

export const STUDIO_MOTION_MS = { fast: 120, mid: 180, slow: 280 } as const

const CONTINUE_LABEL: Record<Exclude<PhaseId, 'continuity'>, string> = {
  context: 'Open the cosmos',
  cosmos: 'See the contrast',
  contrast: 'Choose your steps',
  choice: 'Review this session',
}

const EMPTY_READING_BODY =
  'No reading is in memory yet. Go back and open a fixture from Context, or import and adopt a packet.'

const ADOPTED_RESEARCH_NOTICE =
  'This is an adopted reading packet you reviewed. It is not an exhaustive search of the internet.'

const FIXTURE_URL_LABEL = 'None. Fixture examples do not invent live links.'

const UNAVAILABLE_REASON =
  'No reading is in memory for this horizon yet. Nothing has been generated or adopted, so there is no coverage to report.'

const NOT_CONFIDENCE_NOTE =
  'These counts are a coverage receipt so the preview cannot pretend it read the whole web. They are not a confidence score.'

const ADOPTED_LIMITATIONS =
  'This reading is an adopted packet you reviewed. Coverage counts describe this packet only. They are not a confidence score, and they do not predict an outcome. This is not an exhaustive search. You keep free will and may set the whole reading aside.'

const LIMITATIONS_BY_FIXTURE_MODE = {
  fixture:
    'This reading uses fixture example data, not live research. Coverage counts describe how much of the cataloged pool was used. They are not a confidence score, and they do not predict an outcome. You keep free will and may set the whole reading aside.',
  manual:
    'This reading uses manual links you supplied, not live research. This preview did not fetch or search them. Coverage counts describe how much of the cataloged pool was used. They are not a confidence score, and they do not predict an outcome. You keep free will and may set the whole reading aside.',
} as const

const CHOICE_FREE_WILL =
  'This is a reflective guide, not a command. You retain free will. Nothing here is required or automatic.'

const WINDOW_SLOTS: Record<
  HorizonId,
  readonly { id: string; label: string }[]
> = {
  daily: [
    { id: 'morning', label: 'Today morning' },
    { id: 'afternoon', label: 'Today afternoon' },
    { id: 'evening', label: 'Tonight' },
    { id: 'next-morning', label: 'Tomorrow morning' },
  ],
  weekly: [
    { id: 'd1', label: 'Day 1' },
    { id: 'd2', label: 'Day 2' },
    { id: 'd3', label: 'Day 3' },
    { id: 'd4', label: 'Day 4' },
    { id: 'd5', label: 'Day 5' },
    { id: 'd6', label: 'Day 6' },
    { id: 'd7', label: 'Day 7' },
  ],
  yearly: [
    { id: 'winter', label: 'Winter' },
    { id: 'spring', label: 'Spring' },
    { id: 'summer', label: 'Summer' },
    { id: 'autumn', label: 'Autumn' },
  ],
}

type ReadingCorpus =
  | { kind: 'adopted'; artifact: ReadingArtifact }
  | { kind: 'fixture'; fixture: ForecastFixture; label: 'legacy' }
  | { kind: 'none' }

function readingCorpus(state: AppState): ReadingCorpus {
  const artifact = currentReading(state)
  if (artifact !== null) {
    return { kind: 'adopted', artifact }
  }
  const fixture = currentForecast(state)
  if (fixture !== null) {
    return { kind: 'fixture', fixture, label: 'legacy' }
  }
  return { kind: 'none' }
}

export function hasReadableCorpus(state: AppState): boolean {
  return currentReading(state) !== null || currentForecast(state) !== null
}

export type SetResonanceAction = {
  type: 'SET_RESONANCE'
  sectionId: ReportSectionId
  mark: ResonanceMark
}

export function applySetResonance(
  state: AppState,
  action: SetResonanceAction,
): AppState {
  const view = studioView(state)
  if (view.reading.status !== 'ready') {
    return state
  }
  if (!view.reading.sections.some((section) => section.id === action.sectionId)) {
    return state
  }
  const current = state.resonanceByHorizon[state.horizon] ?? {}
  if (current[action.sectionId] === action.mark) {
    return state
  }
  return {
    ...state,
    resonanceByHorizon: {
      ...state.resonanceByHorizon,
      [state.horizon]: { ...current, [action.sectionId]: action.mark },
    },
  }
}

export function studioView(state: AppState): StudioView {
  const corpus = readingCorpus(state)
  const reading = readingFromCorpus(state, corpus)
  const coverage = reading.status === 'ready' ? reading.coverage : null
  const uncertainty = uncertaintyFrom(corpus, coverage)
  const continueEnabled = canContinue(state)
  return {
    shell: {
      phase: state.phase,
      continueLabel:
        state.phase === 'continuity' ? null : CONTINUE_LABEL[state.phase],
      backEnabled: state.phase !== 'context',
      continueEnabled,
      showEvidenceRail:
        (state.phase === 'cosmos' || state.phase === 'contrast') &&
        reading.status === 'ready',
      emptyAdvanceHint:
        state.phase === 'context' && !continueEnabled
          ? contextAdvanceHint(state)
          : null,
    },
    profile: state.profile,
    horizon: state.horizon,
    cockpit: cockpitFrom(state, corpus),
    uncertainty,
    coverage,
    reading,
    brief: buildExactBrief({
      horizon: state.horizon,
      focus: state.profile.focusIntention,
      tone: state.profile.tone,
      beliefs: state.profile.beliefs,
    }),
    intake: intakeView(state),
    resonance: { options: RESONANCE_OPTIONS },
    choice: choiceView(state),
    continuity: continuityView(state, corpus),
    notices: {
      research:
        corpus.kind === 'adopted' ? ADOPTED_RESEARCH_NOTICE : LIVE_RESEARCH_NOTICE,
    },
    persistence: state.persistence,
  }
}

function canContinue(state: AppState): boolean {
  switch (state.phase) {
    case 'context':
      return (
        state.profile.focusIntention.trim().length > 0 &&
        hasBeliefModule(state.profile.beliefs) &&
        isHorizonId(state.horizon)
      )
    case 'cosmos':
    case 'contrast':
      return hasReadableCorpus(state)
    case 'choice':
      return true
    case 'continuity':
      return false
    default: {
      const _exhaustive: never = state.phase
      return _exhaustive
    }
  }
}

function isHorizonId(value: string): value is HorizonId {
  return value === 'daily' || value === 'weekly' || value === 'yearly'
}

function contextAdvanceHint(state: AppState): string {
  const hasFocus = state.profile.focusIntention.trim().length > 0
  const hasModule = hasBeliefModule(state.profile.beliefs)
  if (!hasFocus && !hasModule) {
    return 'Write a focus intention and select a lens with at least one self-supplied value to continue. The horizon is already chosen.'
  }
  if (!hasFocus) {
    return 'Write a focus intention to continue. The horizon is already chosen.'
  }
  if (!hasModule) {
    return 'Select a lens and enter at least one self-supplied value to continue. The horizon is already chosen.'
  }
  return 'Choose a horizon to continue.'
}

function readingFromCorpus(state: AppState, corpus: ReadingCorpus): StudioReading {
  if (corpus.kind === 'none') {
    return {
      status: 'empty',
      emptyTitle: 'No reading yet',
      emptyBody: EMPTY_READING_BODY,
    }
  }
  if (corpus.kind === 'adopted') {
    return readyFromArtifact(state, corpus.artifact)
  }
  return readyFromFixture(state, corpus.fixture)
}

function readyFromArtifact(
  state: AppState,
  artifact: ReadingArtifact,
): StudioReadingReady {
  const coverage = coverageFromArtifact(artifact)
  const evidence = evidenceFromArtifact(artifact)
  const byId = new Map(evidence.map((card) => [card.id, card]))
  const stored = state.resonanceByHorizon[state.horizon]
  const definition = HORIZON_BY_ID[artifact.horizon]
  const focus = state.profile.focusIntention.trim()
  return {
    status: 'ready',
    lede: `An adopted reading for ${definition.label} (${definition.windowDescription}), held against "${focus}". Visible sections are the ones in this packet. Skipped lenses are listed. This is not an exhaustive search.`,
    legacyBadge: null,
    digestLine: `Packet digest ${artifact.packetDigest}`,
    coverage,
    sections: artifact.sections.map((section) => {
      const kind = frameworkKind(section.id)
      return {
        id: section.id,
        title: section.title,
        frameworkLabel: section.frameworkLabel,
        frameworkKind: kind,
        frameworkKindLabel: frameworkKindLabel(kind),
        reflection: section.reflection,
        groundedHeading: CLAIM_KIND_LABEL.grounded,
        reflectiveHeading: CLAIM_KIND_LABEL.reflective,
        evidence: section.evidenceIds.flatMap((id) => {
          const card = byId.get(id)
          return card === undefined ? [] : [card]
        }),
        resonanceMark: stored?.[section.id] ?? null,
      }
    }),
    evidence,
    skippedLenses: artifact.skippedLenses.map((item) => ({
      lens: item.lens,
      reason: item.reason,
    })),
    charts: chartsFromArtifact(artifact, state.profile.beliefs.bazi?.elementCounts),
  }
}

function readyFromFixture(
  state: AppState,
  fixture: ForecastFixture,
): StudioReading {
  const planned = planLensesForBeliefs(ALL_LENSES, state.profile.beliefs)
  const allowed = new Set(planned.active)
  const coverage = coverageFromFixture(fixture)
  const evidence = evidenceFromFixture(fixture, allowed)
  const byId = new Map(evidence.map((card) => [card.id, card]))
  const stored = state.resonanceByHorizon[state.horizon]
  const definition = HORIZON_BY_ID[fixture.horizon]
  const focus = state.profile.focusIntention.trim()
  return {
    status: 'ready',
    lede: `An interpretive reading for ${definition.label} (${definition.windowDescription}), held against "${focus}". Every block below is a lens, not a result.`,
    legacyBadge: 'legacy',
    digestLine: null,
    coverage,
    sections: fixture.sections
      .filter((section) => allowed.has(section.id))
      .map((section) => {
        const kind = frameworkKind(section.id)
        return {
          id: section.id,
          title: section.title,
          frameworkLabel: section.frameworkLabel,
          frameworkKind: kind,
          frameworkKindLabel: frameworkKindLabel(kind),
          reflection: section.reflection,
          groundedHeading: CLAIM_KIND_LABEL.grounded,
          reflectiveHeading: CLAIM_KIND_LABEL.reflective,
          evidence: section.evidenceIds.flatMap((id) => {
            const card = byId.get(id)
            return card === undefined ? [] : [card]
          }),
          resonanceMark: stored?.[section.id] ?? null,
        }
      }),
    evidence,
    skippedLenses: planned.skipped.map((item) => ({
      lens: item.lens,
      reason: item.reason,
    })),
    charts: chartsFromFixture(fixture),
  }
}

function coverageFromArtifact(artifact: ReadingArtifact): StudioCoverage {
  return {
    heading: 'Coverage summary',
    modeCopy:
      'Mode: adopted reading packet. This is a reviewed submission, not an exhaustive search of the internet.',
    levelCopy: null,
    sourcesConsidered: artifact.coverage.sourcesConsidered,
    sourcesUsed: artifact.coverage.sourcesUsed,
    timeWindowDescription: artifact.coverage.timeWindowDescription,
    stoppingReason: artifact.coverage.stoppingReason,
    notConfidenceNote: NOT_CONFIDENCE_NOTE,
    exhaustive: false,
  }
}

function coverageFromFixture(fixture: ForecastFixture): StudioCoverage {
  const { coverage } = fixture
  const level = coverageLevel(coverage)
  return {
    heading: 'Coverage summary',
    modeCopy:
      coverage.mode === 'manual'
        ? 'Mode: manual. These are links you supplied. This preview did not fetch or search them.'
        : 'Mode: a legacy, non-personalized fixture reading, not live research. This preview never searched the internet.',
    levelCopy: COVERAGE_LEVEL_COPY[level],
    sourcesConsidered: coverage.sourcesConsidered,
    sourcesUsed: coverage.sourcesUsed,
    timeWindowDescription: coverage.timeWindowDescription,
    stoppingReason: coverage.stoppingReason,
    notConfidenceNote: NOT_CONFIDENCE_NOTE,
    exhaustive: false,
  }
}

function uncertaintyFrom(
  corpus: ReadingCorpus,
  coverage: StudioCoverage | null,
): StudioUncertainty {
  if (corpus.kind === 'none' || coverage === null) {
    return { kind: 'unavailable', reason: UNAVAILABLE_REASON }
  }
  if (corpus.kind === 'adopted') {
    const kind = corpus.artifact.coverage.sourcesUsed > 0 ? 'ready' : 'partial'
    return {
      kind,
      sourceLabel: 'adopted',
      coverage,
      limitations: ADOPTED_LIMITATIONS,
    }
  }
  const kind = corpus.fixture.coverage.sourcesUsed > 0 ? 'ready' : 'partial'
  return {
    kind,
    sourceLabel: corpus.fixture.coverage.mode,
    coverage,
    limitations: LIMITATIONS_BY_FIXTURE_MODE[corpus.fixture.coverage.mode],
  }
}

function cockpitFrom(state: AppState, corpus: ReadingCorpus): ForecastCockpit {
  const definition = HORIZON_BY_ID[state.horizon]
  let generatedAt: string | null = null
  if (corpus.kind === 'adopted') {
    generatedAt = new Date(corpus.artifact.adoptedAt).toISOString()
  } else if (corpus.kind === 'fixture') {
    generatedAt = corpus.fixture.generatedAt
  }
  return {
    horizon: state.horizon,
    name: definition.label,
    tagline: definition.tagline,
    windowDescription: definition.windowDescription,
    focusIntention: state.profile.focusIntention,
    generatedAt,
  }
}

function chartsFromArtifact(
  artifact: ReadingArtifact,
  elementCounts: ElementCounts | undefined,
): ChartModel[] {
  const definition = HORIZON_BY_ID[artifact.horizon]
  const charts: ChartModel[] = [
    {
      id: 'citations',
      title: `${definition.label} citation map`,
      caption:
        'Integer citation counts per section in this adopted packet. These are not probabilities, not confidence, and not a prediction.',
      valueHeader: 'Citations',
      slots: artifact.sections.map((section) => ({
        id: section.id,
        label: section.title,
        value: section.evidenceIds.length,
      })),
    },
  ]
  if (elementCounts === undefined) {
    return charts
  }
  const slots: ChartSlot[] = []
  for (const element of CHINESE_ELEMENTS) {
    const value = elementCounts[element]
    if (value === undefined) {
      continue
    }
    slots.push({
      id: element,
      label: `${element.slice(0, 1).toUpperCase()}${element.slice(1)}`,
      value,
    })
  }
  if (slots.length === 0) {
    return charts
  }
  charts.push({
    id: 'elements',
    title: 'BaZi element counts',
    caption:
      'Self-supplied BaZi element counts. Integer profile values, not an energy percentage, not probabilities, and not a prediction.',
    valueHeader: 'Count',
    slots,
  })
  return charts
}

function chartsFromFixture(fixture: ForecastFixture): ChartModel[] {
  const definition = HORIZON_BY_ID[fixture.horizon]
  const templates = WINDOW_SLOTS[fixture.horizon]
  const seed = fixtureHash(
    `${fixture.horizon}${fixture.generatedAt}${fixture.coverage.sourcesUsed}`,
  )
  const weights = distribute(fixture.evidence.length, templates.length, seed)
  return [
    {
      id: 'window',
      title: `${definition.label} window map`,
      caption:
        'Catalog weight per part of this horizon window. These are integer counts of fixture examples, not probabilities, and not a prediction.',
      valueHeader: 'Catalog weight',
      slots: templates.map((slot, index) => ({
        id: slot.id,
        label: slot.label,
        value: weights[index] ?? 0,
      })),
    },
  ]
}

function distribute(total: number, buckets: number, seed: number): number[] {
  const weights = Array.from({ length: buckets }, () => 0)
  for (let i = 0; i < total; i += 1) {
    const index = (seed + i * 17) % buckets
    const current = weights[index]
    if (current !== undefined) {
      weights[index] = current + 1
    }
  }
  return weights
}

function evidenceFromArtifact(artifact: ReadingArtifact): StudioEvidenceCard[] {
  return artifact.sources.map((source) => ({
    id: source.id,
    label: source.title,
    groundedNote: source.snippet,
    url: source.url,
    urlLabel: source.url,
    providerLabel: source.provenance.provider,
    methodLabel: source.provenance.method,
    retrievedAt: null,
    citingTitles: artifact.sections
      .filter((section) => section.evidenceIds.includes(source.id))
      .map((section) => section.title),
  }))
}

function evidenceFromFixture(
  fixture: ForecastFixture,
  allowed: ReadonlySet<ReportSectionId>,
): StudioEvidenceCard[] {
  return fixture.evidence.map((item) => ({
    id: item.id,
    label: item.label,
    groundedNote: item.note,
    url: null,
    urlLabel: FIXTURE_URL_LABEL,
    providerLabel: fixture.coverage.mode,
    methodLabel:
      fixture.coverage.mode === 'manual'
        ? 'user_supplied_link'
        : 'local_fixture',
    retrievedAt: fixture.generatedAt,
    citingTitles: fixture.sections
      .filter(
        (section) =>
          allowed.has(section.id) && section.evidenceIds.includes(item.id),
      )
      .map((section) => section.title),
  }))
}

function intakeView(state: AppState): StudioIntake {
  const blocked = state.confirmation.status === 'pending'
  const progress = intakeProgress(state.intake)
  const horizon = state.horizon
  switch (state.intake.status) {
    case 'idle':
      return { status: 'idle', horizon, blocked, progress }
    case 'assembling':
      return {
        status: 'assembling',
        horizon: state.intake.horizon,
        blocked,
        progress,
      }
    case 'ready':
      return {
        status: 'ready',
        horizon: state.intake.packet.horizon,
        blocked,
        progress,
        review: state.intake.review,
      }
    case 'rejected':
      return {
        status: 'rejected',
        horizon,
        blocked,
        progress,
        code: state.intake.code,
        reason: state.intake.reason,
      }
    case 'adopted':
      return {
        status: 'adopted',
        horizon,
        blocked,
        progress,
        digest: state.intake.digest,
      }
    default: {
      const _exhaustive: never = state.intake
      return _exhaustive
    }
  }
}

function choiceView(state: AppState): StudioChoice {
  const plan = currentPlan(state)
  const eraseFailed =
    state.persistence.kind === 'error' &&
    state.persistence.operation === 'erase'
  return {
    freeWillNote: plan?.freeWillNote ?? CHOICE_FREE_WILL,
    steps: plan?.steps ?? [],
    notePlaceholder:
      hasPersistenceConsent(state.persistence) && !eraseFailed
        ? 'A reminder for you. It is stored with this session on this device.'
        : 'A reminder for you. It stays in this tab unless you choose to save.',
  }
}

const FIXTURE_EXPORT_REASON =
  'This session uses fixture example data, not an adopted packet. Print and calendar download are not available.'

const NO_READING_EXPORT_REASON =
  'No adopted reading is in this session. Print and calendar download are not available.'

const EMPTY_CALENDAR_REASON =
  'You did not accept any suggested step, so there is nothing to put on a calendar.'

function continuityView(state: AppState, corpus: ReadingCorpus): StudioContinuity {
  const plan = currentPlan(state)
  const definition = HORIZON_BY_ID[state.horizon]
  const acceptedSteps =
    plan?.steps.filter((step) => step.status === 'accepted') ?? []
  const accepted = acceptedSteps.map(receiptStep)
  const dismissed =
    plan?.steps
      .filter((step) => step.status === 'dismissed')
      .map(receiptStep) ?? []
  const proposed =
    plan?.steps
      .filter((step) => step.status === 'proposed')
      .map(receiptStep) ?? []
  const { print, calendar } = exportSlices(state, corpus, acceptedSteps, accepted)
  return {
    displayName: state.profile.displayName,
    horizonLabel: definition.label,
    windowDescription: definition.windowDescription,
    focusIntention: state.profile.focusIntention.trim() || 'None written',
    tone: state.profile.tone,
    stampLabel: corpus.kind === 'adopted' ? 'Adopted at' : 'Fixture stamp',
    stampValue:
      corpus.kind === 'adopted'
        ? new Date(corpus.artifact.adoptedAt).toISOString()
        : (plan?.createdAt ?? 'Not generated'),
    adoptedDigest:
      corpus.kind === 'adopted' ? corpus.artifact.packetDigest : null,
    intro: continuityIntro(state.persistence),
    persistenceNote: continuityNote(state.persistence),
    accepted,
    dismissed,
    proposed,
    print,
    calendar,
  }
}

function exportSlices(
  state: AppState,
  corpus: ReadingCorpus,
  acceptedSteps: ChoiceStep[],
  accepted: ContinuityReceiptStep[],
): { print: ContinuityPrint; calendar: ContinuityCalendar } {
  if (corpus.kind !== 'adopted') {
    const reason =
      corpus.kind === 'fixture' ? FIXTURE_EXPORT_REASON : NO_READING_EXPORT_REASON
    return {
      print: { kind: 'unavailable', reason },
      calendar: { kind: 'unavailable', reason },
    }
  }
  const definition = HORIZON_BY_ID[corpus.artifact.horizon]
  const reading = readyFromArtifact(state, corpus.artifact)
  const maxEvents = ICS_EVENT_CAPS[corpus.artifact.horizon]
  const print: ContinuityPrint = {
    kind: 'available',
    buttonLabel: 'Print this reading',
    sheet: {
      title: `Adopted ${definition.label} reading`,
      digestLine: reading.digestLine ?? `Packet digest ${corpus.artifact.packetDigest}`,
      adoptedAt: new Date(corpus.artifact.adoptedAt).toISOString(),
      horizonLabel: definition.label,
      windowDescription: definition.windowDescription,
      focusIntention: state.profile.focusIntention.trim() || 'None written',
      coverage: reading.coverage,
      limitations: ADOPTED_LIMITATIONS,
      freeWillNote: currentPlan(state)?.freeWillNote ?? CHOICE_FREE_WILL,
      sections: reading.sections,
      evidence: reading.evidence,
      skippedLenses: reading.skippedLenses,
      acceptedSteps: accepted,
    },
  }
  const calendar: ContinuityCalendar =
    acceptedSteps.length === 0
      ? { kind: 'unavailable', reason: EMPTY_CALENDAR_REASON }
      : {
          kind: 'available',
          artifact: corpus.artifact,
          acceptedSteps,
          maxEvents,
          capNote: `At most ${String(maxEvents)} calendar events for this ${corpus.artifact.horizon} reading. Print and calendar download stay on this device. There is no calendar API.`,
        }
  return { print, calendar }
}

function receiptStep(step: ChoiceStep): ContinuityReceiptStep {
  return {
    id: step.id,
    title: step.title,
    userNote: step.userNote,
  }
}

function continuityIntro(persistence: PersistenceStatus): string {
  switch (persistence.kind) {
    case 'saved':
      return 'This session is saved on this device. Start a new reflection clears this tab and leaves the stored copy in place. Erase it from the local-saving control at the top of the page.'
    case 'saving':
      return 'This session is being saved on this device. Start a new reflection clears this tab and leaves the stored copy in place. You can stop and erase the saved copy from the control at the top.'
    case 'error':
      if (persistence.operation === 'decline') {
        return 'Nothing is being saved on this device. Reload the page and this session starts over.'
      }
      if (persistence.operation === 'erase') {
        return 'A copy is still on this device. Erase did not finish. Use the control at the top to try erasing again. Start a new reflection clears this tab and leaves the stored copy in place.'
      }
      return 'Saving on this device is on, but the last save did not complete. Use the control at the top to try again. Start a new reflection clears this tab and leaves the stored copy in place.'
    case 'unavailable':
      return `${persistence.reason} A reload starts this session over.`
    case 'checking':
      return 'Checking whether this browser can save locally. Until then, a reload starts from zero.'
    case 'held':
      return 'This tab is not using the stored copy, and nothing is being overwritten. Use the control at the top if you want to replace the saved copy.'
    case 'undecided':
    case 'declined':
      return 'Nothing is being saved on this device. Reload the page and this session starts over.'
    default: {
      const _exhaustive: never = persistence
      return _exhaustive
    }
  }
}

function continuityNote(persistence: PersistenceStatus): string {
  if (hasPersistenceConsent(persistence)) {
    return 'A copy can live in this browser profile until you erase it from the local-saving control at the top. Print and calendar download are person-initiated on this device. There is no account, no cloud, and no calendar API.'
  }
  return 'Nothing on this page is stored. Close the tab or reload and the plan, notes, and report disappear. Print and calendar download are person-initiated on this device. There is no account, no cloud, and no calendar API.'
}
