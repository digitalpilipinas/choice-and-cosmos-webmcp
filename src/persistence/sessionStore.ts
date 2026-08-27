import type { AppAction } from '../domain/loop.ts'
import type {
  AppState,
  ChoicePlanDraft,
  ChoiceStep,
  ChoiceStepOrigin,
  ChoiceStepStatus,
  CoverageSummary,
  DerivedProfile,
  EvidenceItem,
  ForecastFixture,
  ForecastSource,
  HorizonId,
  PhaseId,
  ReportSection,
  ReportSectionId,
  StoredSessionV1,
} from '../domain/types.ts'
import { deleteItem, getItem, isIndexedDbAvailable, setItem } from './db.ts'

const CONSENT_KEY = 'consent'
const SESSION_KEY = 'session'

const UNAVAILABLE_UNSUPPORTED =
  'This browser does not support local storage for this preview, so nothing is saved. Everything still works for this tab.'

const UNAVAILABLE_OPEN_FAILED =
  'Local storage could not be opened, so nothing is saved. Everything still works for this tab.'

const PHASES: readonly PhaseId[] = [
  'context',
  'cosmos',
  'contrast',
  'choice',
  'continuity',
]
const HORIZONS: readonly HorizonId[] = ['daily', 'weekly', 'yearly']
const TONES: readonly DerivedProfile['tone'][] = ['grounded', 'curious', 'bold']
const SECTION_IDS: readonly ReportSectionId[] = [
  'energyOverview',
  'numerology',
  'humanDesign',
  'westernAstrology',
  'chineseElemental',
  'lifeAreas',
  'decisionSupport',
  'tarotOracle',
  'focusActionPlan',
  'symbolicCodes',
  'higherSelfLetter',
]
const STEP_STATUSES: readonly ChoiceStepStatus[] = [
  'proposed',
  'accepted',
  'dismissed',
]
const STEP_ORIGINS: readonly ChoiceStepOrigin[] = ['fixture', 'custom']
const FORECAST_SOURCES: readonly ForecastSource[] = ['fixture', 'manual']

export type BootstrapResult =
  | { kind: 'unavailable'; reason: string }
  | { kind: 'undecided' }
  | { kind: 'declined' }
  | { kind: 'hydrated'; session: StoredSessionV1 }
  | { kind: 'granted-empty' }

export type StorageMutationResult = { ok: true } | { error: string }

export type SessionFields = Pick<
  AppState,
  'phase' | 'horizon' | 'profile' | 'forecastsByHorizon' | 'plansByHorizon'
>

export function sessionFieldsOf(state: AppState): SessionFields {
  return {
    phase: state.phase,
    horizon: state.horizon,
    profile: state.profile,
    forecastsByHorizon: state.forecastsByHorizon,
    plansByHorizon: state.plansByHorizon,
  }
}

let writeEpoch = 0
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work)
  queue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function invalidatePendingWrites(): void {
  writeEpoch += 1
}

async function writeSession(
  state: SessionFields,
): Promise<{ savedAt: string } | { error: string }> {
  const savedAt = new Date().toISOString()
  const session: StoredSessionV1 = {
    schemaVersion: 1,
    savedAt,
    phase: state.phase,
    horizon: state.horizon,
    profile: state.profile,
    forecastsByHorizon: state.forecastsByHorizon,
    plansByHorizon: state.plansByHorizon,
  }

  try {
    await setItem(SESSION_KEY, session)
    return { savedAt }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not save locally.',
    }
  }
}

function parseStoredConsent(raw: unknown): 'granted' | 'declined' | null {
  if (raw === 'granted') {
    return 'granted'
  }
  if (raw === 'declined') {
    return 'declined'
  }
  return null
}

async function requireGrantedConsent(): Promise<{ error: string } | null> {
  try {
    const consent = parseStoredConsent(await getItem<unknown>(CONSENT_KEY))
    if (consent === 'granted') {
      return null
    }
    return { error: 'Saving is off.' }
  } catch {
    return { error: 'Saving is off.' }
  }
}

export async function bootstrapPersistence(): Promise<BootstrapResult> {
  if (!isIndexedDbAvailable()) {
    return { kind: 'unavailable', reason: UNAVAILABLE_UNSUPPORTED }
  }

  try {
    const consent = parseStoredConsent(await getItem<unknown>(CONSENT_KEY))
    if (consent === null) {
      return { kind: 'undecided' }
    }
    if (consent === 'declined') {
      return { kind: 'declined' }
    }

    const session = await getItem<unknown>(SESSION_KEY)
    if (session === undefined) {
      return { kind: 'granted-empty' }
    }
    const parsed = parseStoredSessionV1(session)
    if (parsed === null) {
      return { kind: 'granted-empty' }
    }
    return { kind: 'hydrated', session: parsed }
  } catch {
    return { kind: 'unavailable', reason: UNAVAILABLE_OPEN_FAILED }
  }
}

export async function grantConsentAndSave(
  state: SessionFields,
): Promise<{ savedAt: string } | { error: string }> {
  const epoch = writeEpoch
  return enqueue(async () => {
    if (epoch !== writeEpoch) {
      return { error: 'Saving is off.' }
    }
    try {
      await setItem(CONSENT_KEY, 'granted')
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Could not save locally.',
      }
    }
    if (epoch !== writeEpoch) {
      return { error: 'Saving is off.' }
    }
    return writeSession(state)
  })
}

export function actionFromBootstrap(
  result: BootstrapResult,
  sessionEdited: boolean,
): AppAction {
  switch (result.kind) {
    case 'unavailable':
      return { type: 'PERSISTENCE_UNAVAILABLE', reason: result.reason }
    case 'undecided':
      return { type: 'PERSISTENCE_UNDECIDED' }
    case 'declined':
      return { type: 'PERSISTENCE_DECLINED_ON_LOAD' }
    case 'granted-empty':
      return { type: 'PERSISTENCE_GRANTED_EMPTY' }
    case 'hydrated':
      if (sessionEdited) {
        return {
          type: 'PERSISTENCE_HELD',
          savedAt: result.session.savedAt,
        }
      }
      return { type: 'HYDRATE', session: result.session }
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
}

export function parseStoredSessionV1(raw: unknown): StoredSessionV1 | null {
  if (!isRecord(raw) || raw.schemaVersion !== 1) {
    return null
  }
  if (typeof raw.savedAt !== 'string' || raw.savedAt.trim().length === 0) {
    return null
  }
  if (!isPhaseId(raw.phase) || !isHorizonId(raw.horizon)) {
    return null
  }
  const profile = parseProfile(raw.profile)
  const forecastsByHorizon = parseHorizonMap(raw.forecastsByHorizon, parseForecast)
  const plansByHorizon = parseHorizonMap(raw.plansByHorizon, parsePlan)
  if (
    profile === null ||
    forecastsByHorizon === null ||
    plansByHorizon === null
  ) {
    return null
  }
  return {
    schemaVersion: 1,
    savedAt: raw.savedAt,
    phase: raw.phase,
    horizon: raw.horizon,
    profile,
    forecastsByHorizon,
    plansByHorizon,
  }
}

function parseProfile(raw: unknown): DerivedProfile | null {
  if (!isRecord(raw)) {
    return null
  }
  if (
    typeof raw.displayName !== 'string' ||
    typeof raw.focusIntention !== 'string' ||
    !isTone(raw.tone)
  ) {
    return null
  }
  return {
    displayName: raw.displayName,
    focusIntention: raw.focusIntention,
    tone: raw.tone,
  }
}

function parseHorizonMap<T>(
  raw: unknown,
  parseValue: (value: unknown) => T | null,
): Record<HorizonId, T | null> | null {
  if (!isRecord(raw)) {
    return null
  }
  const daily = parseNullable(raw.daily, parseValue)
  const weekly = parseNullable(raw.weekly, parseValue)
  const yearly = parseNullable(raw.yearly, parseValue)
  if (daily === undefined || weekly === undefined || yearly === undefined) {
    return null
  }
  return { daily, weekly, yearly }
}

function parseNullable<T>(
  raw: unknown,
  parseValue: (value: unknown) => T | null,
): T | null | undefined {
  if (raw === null) {
    return null
  }
  const parsed = parseValue(raw)
  return parsed === null ? undefined : parsed
}

function parseForecast(raw: unknown): ForecastFixture | null {
  if (!isRecord(raw)) {
    return null
  }
  if (!isHorizonId(raw.horizon) || !isNonEmptyString(raw.generatedAt)) {
    return null
  }
  const sections = parseList(raw.sections, parseSection)
  const evidence = parseList(raw.evidence, parseEvidence)
  const coverage = parseCoverage(raw.coverage)
  const suggestedSteps = parseList(raw.suggestedSteps, parseStep)
  if (
    sections === null ||
    evidence === null ||
    coverage === null ||
    suggestedSteps === null
  ) {
    return null
  }
  return {
    horizon: raw.horizon,
    generatedAt: raw.generatedAt,
    sections,
    evidence,
    coverage,
    suggestedSteps,
  }
}

function parsePlan(raw: unknown): ChoicePlanDraft | null {
  if (!isRecord(raw)) {
    return null
  }
  if (
    !isHorizonId(raw.horizon) ||
    !isNonEmptyString(raw.createdAt) ||
    !isNonEmptyString(raw.freeWillNote)
  ) {
    return null
  }
  const steps = parseList(raw.steps, parseStep)
  if (steps === null) {
    return null
  }
  return {
    horizon: raw.horizon,
    createdAt: raw.createdAt,
    steps,
    freeWillNote: raw.freeWillNote,
  }
}

function parseCoverage(raw: unknown): CoverageSummary | null {
  if (!isRecord(raw)) {
    return null
  }
  if (
    !isFiniteNumber(raw.sourcesConsidered) ||
    !isFiniteNumber(raw.sourcesUsed) ||
    !isNonEmptyString(raw.timeWindowDescription) ||
    !isNonEmptyString(raw.stoppingReason) ||
    !isForecastSource(raw.mode)
  ) {
    return null
  }
  return {
    sourcesConsidered: raw.sourcesConsidered,
    sourcesUsed: raw.sourcesUsed,
    timeWindowDescription: raw.timeWindowDescription,
    stoppingReason: raw.stoppingReason,
    mode: raw.mode,
  }
}

function parseSection(raw: unknown): ReportSection | null {
  if (!isRecord(raw)) {
    return null
  }
  if (
    !isSectionId(raw.id) ||
    !isNonEmptyString(raw.title) ||
    !isNonEmptyString(raw.frameworkLabel) ||
    typeof raw.reflection !== 'string'
  ) {
    return null
  }
  const evidenceIds = parseStringList(raw.evidenceIds)
  if (evidenceIds === null) {
    return null
  }
  return {
    id: raw.id,
    title: raw.title,
    frameworkLabel: raw.frameworkLabel,
    reflection: raw.reflection,
    evidenceIds,
  }
}

function parseEvidence(raw: unknown): EvidenceItem | null {
  if (!isRecord(raw)) {
    return null
  }
  if (
    !isNonEmptyString(raw.id) ||
    !isNonEmptyString(raw.label) ||
    raw.sourceType !== 'fixture' ||
    typeof raw.note !== 'string'
  ) {
    return null
  }
  return {
    id: raw.id,
    label: raw.label,
    sourceType: 'fixture',
    note: raw.note,
  }
}

function parseStep(raw: unknown): ChoiceStep | null {
  if (!isRecord(raw)) {
    return null
  }
  if (
    !isNonEmptyString(raw.id) ||
    typeof raw.title !== 'string' ||
    typeof raw.rationale !== 'string' ||
    !isStepStatus(raw.status) ||
    typeof raw.userNote !== 'string' ||
    !isStepOrigin(raw.origin)
  ) {
    return null
  }
  return {
    id: raw.id,
    title: raw.title,
    rationale: raw.rationale,
    status: raw.status,
    userNote: raw.userNote,
    origin: raw.origin,
  }
}

function parseList<T>(
  raw: unknown,
  parseItem: (value: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(raw)) {
    return null
  }
  const items: T[] = []
  for (const entry of raw) {
    const parsed = parseItem(entry)
    if (parsed === null) {
      return null
    }
    items.push(parsed)
  }
  return items
}

function parseStringList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) {
    return null
  }
  const items: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      return null
    }
    items.push(entry)
  }
  return items
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isPhaseId(value: unknown): value is PhaseId {
  return typeof value === 'string' && (PHASES as readonly string[]).includes(value)
}

function isHorizonId(value: unknown): value is HorizonId {
  return typeof value === 'string' && (HORIZONS as readonly string[]).includes(value)
}

function isTone(value: unknown): value is DerivedProfile['tone'] {
  return typeof value === 'string' && (TONES as readonly string[]).includes(value)
}

function isSectionId(value: unknown): value is ReportSectionId {
  return (
    typeof value === 'string' &&
    (SECTION_IDS as readonly string[]).includes(value)
  )
}

function isStepStatus(value: unknown): value is ChoiceStepStatus {
  return (
    typeof value === 'string' &&
    (STEP_STATUSES as readonly string[]).includes(value)
  )
}

function isStepOrigin(value: unknown): value is ChoiceStepOrigin {
  return (
    typeof value === 'string' &&
    (STEP_ORIGINS as readonly string[]).includes(value)
  )
}

function isForecastSource(value: unknown): value is ForecastSource {
  return (
    typeof value === 'string' &&
    (FORECAST_SOURCES as readonly string[]).includes(value)
  )
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export async function declineConsent(): Promise<StorageMutationResult> {
  invalidatePendingWrites()
  if (!isIndexedDbAvailable()) {
    return { error: 'Could not update local saving.' }
  }
  return enqueue(async () => {
    try {
      await setItem(CONSENT_KEY, 'declined')
      return { ok: true as const }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : 'Could not update local saving.',
      }
    }
  })
}

export async function saveSession(
  state: SessionFields,
): Promise<{ savedAt: string } | { error: string }> {
  const epoch = writeEpoch
  return enqueue(async () => {
    if (epoch !== writeEpoch) {
      return { error: 'Saving is off.' }
    }
    const blocked = await requireGrantedConsent()
    if (blocked !== null) {
      return blocked
    }
    if (epoch !== writeEpoch) {
      return { error: 'Saving is off.' }
    }
    return writeSession(state)
  })
}

export async function clearSavedData(): Promise<StorageMutationResult> {
  invalidatePendingWrites()
  if (!isIndexedDbAvailable()) {
    return { error: 'Could not erase the local copy.' }
  }
  return enqueue(async () => {
    try {
      await deleteItem(SESSION_KEY)
      await deleteItem(CONSENT_KEY)
      return { ok: true as const }
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : 'Could not erase the local copy.',
      }
    }
  })
}
