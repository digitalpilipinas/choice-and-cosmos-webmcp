import { generateForecast } from '../fixtures/generateForecast.ts'
import { PLAN_BOUNDS } from './bounds.ts'
import { mustInstant, type ConfirmationId, type Instant } from './brand.ts'
import { liveBriefDigest } from '../research/brief.ts'
import {
  EMPTY_DESK,
  adoptStagedPacket,
  approveTicket,
  clearStaged,
  confirmationIdForPayload,
  confirmationView,
  consumeTicket,
  denyTicket,
  issueConfirmation,
  sectionsAdmissible,
  stagePacket,
} from './trust.ts'
import { applyIntake, EMPTY_INTAKE, type IntakeCommand } from '../research/coordinator.ts'
import { admitPacket } from '../research/gate.ts'
import type { ReadingPacketV1 } from '../research/packet.ts'
import { emptyCosmic } from './cosmic.ts'
import { emptyBeliefs, parseModularProfile, type ModularBeliefs } from './profile.ts'
import { currentPlan, currentReading } from './selectors.ts'
import {
  applySetResonance,
  hasReadableCorpus,
  type SetResonanceAction,
} from './studioView.ts'
import type {
  AgentAvailability,
  AppState,
  ChoicePlanDraft,
  ChoiceStepStatus,
  ConfirmationPayload,
  ContextProfile,
  DerivedProfile,
  ForecastFixture,
  HorizonId,
  PersistenceStatus,
  PhaseId,
  ReadingArtifact,
  ResonanceMap,
  StoredSessionV3,
} from './types.ts'

export const PHASE_ORDER = [
  'context',
  'cosmos',
  'contrast',
  'choice',
  'continuity',
] as const satisfies readonly PhaseId[]

function emptyForecasts(): Record<HorizonId, ForecastFixture | null> {
  return { daily: null, weekly: null, yearly: null }
}

function emptyPlans(): Record<HorizonId, ChoicePlanDraft | null> {
  return { daily: null, weekly: null, yearly: null }
}

function emptyReadings(): Record<HorizonId, ReadingArtifact | null> {
  return { daily: null, weekly: null, yearly: null }
}

function emptyResonance(): Record<HorizonId, ResonanceMap | null> {
  return { daily: null, weekly: null, yearly: null }
}

const IDLE_CONFIRMATION = { status: 'idle' } as const
const NO_SHARE = { kind: 'none' } as const

function freshSessionContent(): Omit<AppState, 'persistence' | 'agentAvailability'> {
  return {
    phase: 'context',
    horizon: 'daily',
    profile: {
      displayName: 'You',
      focusIntention: '',
      tone: 'grounded',
      beliefs: emptyBeliefs(),
    },
    forecastsByHorizon: emptyForecasts(),
    readingsByHorizon: emptyReadings(),
    resonanceByHorizon: emptyResonance(),
    plansByHorizon: emptyPlans(),
    confirmation: IDLE_CONFIRMATION,
    desk: EMPTY_DESK,
    intake: EMPTY_INTAKE,
    externalShare: NO_SHARE,
  }
}

export const INITIAL_STATE: AppState = {
  ...freshSessionContent(),
  persistence: { kind: 'checking' },
  agentAvailability: { kind: 'checking' },
}

export function fixtureDerivedProfile(profile: ContextProfile): DerivedProfile {
  return {
    displayName: profile.displayName,
    focusIntention: profile.focusIntention,
    tone: profile.tone,
    cosmic: emptyCosmic(),
  }
}

export { confirmationIdForPayload } from './trust.ts'

export const FREE_WILL_NOTE =
  'This is a reflective guide, not a command. You retain free will. Nothing here is required or automatic.'

type SetProfileFieldAction = {
  [K in keyof ContextProfile]: {
    type: 'SET_PROFILE_FIELD'
    field: K
    value: ContextProfile[K]
  }
}[keyof ContextProfile]

type SetBeliefsAction = {
  type: 'SET_BELIEFS'
  beliefs: ModularBeliefs
}

export type AppAction =
  | { type: 'SET_HORIZON'; horizon: HorizonId }
  | SetProfileFieldAction
  | SetBeliefsAction
  | { type: 'GENERATE_FORECAST' }
  | { type: 'ADVANCE' }
  | { type: 'BACK' }
  | { type: 'SET_STEP_STATUS'; stepId: string; status: ChoiceStepStatus }
  | { type: 'SET_STEP_NOTE'; stepId: string; userNote: string }
  | { type: 'RESTART' }
  | { type: 'HYDRATE'; session: StoredSessionV3 }
  | { type: 'STAGE_PACKET'; packet: ReadingPacketV1; now: Instant }
  | { type: 'ADOPT_STAGED_PACKET'; confirmationId: ConfirmationId; now: Instant }
  | { type: 'INTAKE_BEGIN'; horizon: HorizonId }
  | { type: 'INTAKE_APPEND_SOURCES'; sources: unknown[] }
  | { type: 'INTAKE_APPEND_SECTIONS'; sections: unknown[] }
  | { type: 'INTAKE_FINALIZE' }
  | { type: 'INTAKE_IMPORT_JSON'; text: string; now: Instant }
  | { type: 'INTAKE_CANCEL' }
  | { type: 'REQUEST_ADOPT_STAGED'; now: Instant }
  | { type: 'PERSISTENCE_UNAVAILABLE'; reason: string }
  | { type: 'PERSISTENCE_UNDECIDED' }
  | { type: 'PERSISTENCE_DECLINED_ON_LOAD' }
  | { type: 'PERSISTENCE_GRANTED_EMPTY' }
  | { type: 'PERSISTENCE_HELD'; savedAt: string }
  | { type: 'GRANT_PERSISTENCE_CONSENT' }
  | { type: 'DECLINE_PERSISTENCE_CONSENT' }
  | { type: 'PERSISTENCE_SAVE_START' }
  | { type: 'PERSISTENCE_SAVE_SUCCESS'; savedAt: string }
  | { type: 'PERSISTENCE_SAVE_ERROR'; message: string }
  | { type: 'PERSISTENCE_DECLINE_ERROR'; message: string }
  | { type: 'PERSISTENCE_ERASE_ERROR'; message: string }
  | { type: 'CLEAR_SAVED_DATA' }
  | { type: 'ADD_CUSTOM_STEP'; stepId: string; title: string; userNote: string }
  | { type: 'REMOVE_CUSTOM_STEP'; stepId: string }
  | { type: 'SET_AGENT_AVAILABILITY'; availability: AgentAvailability }
  | {
      type: 'REQUEST_CONFIRMATION'
      kind: ConfirmationPayload['kind']
      summary: string
      payload: ConfirmationPayload
      now?: Instant
    }
  | { type: 'APPROVE_CONFIRMATION'; id: string; persistSession?: boolean; now?: Instant }
  | { type: 'DENY_CONFIRMATION'; id: string }
  | { type: 'CONSUME_CONFIRMATION'; id: string }
  | SetResonanceAction

export type ToolAction = Exclude<
  AppAction,
  | { type: 'APPROVE_CONFIRMATION'; id: string; persistSession?: boolean }
  | { type: 'DENY_CONFIRMATION'; id: string }
  | SetResonanceAction
  | { type: 'GENERATE_FORECAST' }
  | { type: 'SET_STEP_STATUS'; stepId: string; status: ChoiceStepStatus }
  | { type: 'SET_STEP_NOTE'; stepId: string; userNote: string }
  | { type: 'ADOPT_STAGED_PACKET'; confirmationId: ConfirmationId; now: Instant }
  | { type: 'REQUEST_ADOPT_STAGED'; now: Instant }
  | { type: 'CLEAR_SAVED_DATA' }
>

export function createCustomStepId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function blocksDelayedHydrate(action: AppAction): boolean {
  switch (action.type) {
    case 'HYDRATE':
    case 'PERSISTENCE_UNAVAILABLE':
    case 'PERSISTENCE_UNDECIDED':
    case 'PERSISTENCE_DECLINED_ON_LOAD':
    case 'PERSISTENCE_GRANTED_EMPTY':
    case 'PERSISTENCE_HELD':
    case 'PERSISTENCE_SAVE_START':
    case 'PERSISTENCE_SAVE_SUCCESS':
    case 'PERSISTENCE_SAVE_ERROR':
    case 'PERSISTENCE_DECLINE_ERROR':
    case 'PERSISTENCE_ERASE_ERROR':
    case 'SET_AGENT_AVAILABILITY':
      return false
    default:
      return true
  }
}

export function nextPhase(current: PhaseId): PhaseId {
  const index = PHASE_ORDER.indexOf(current)
  return PHASE_ORDER[index + 1] ?? current
}

export function previousPhase(current: PhaseId): PhaseId {
  const index = PHASE_ORDER.indexOf(current)
  return index > 0 ? PHASE_ORDER[index - 1] : current
}

export function canAdvance(state: AppState): boolean {
  switch (state.phase) {
    case 'context':
      return (
        state.profile.focusIntention.trim().length > 0 &&
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

export function appReducer(state: AppState, action: AppAction): AppState {
  return reconcileBriefTicket(reduceApp(state, action))
}

function reduceApp(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_HORIZON': {
      if (state.horizon === action.horizon) {
        return state
      }
      return {
        ...withDesk(state, clearStaged(state.desk)),
        horizon: action.horizon,
        intake: EMPTY_INTAKE,
      }
    }
    case 'SET_PROFILE_FIELD':
      return {
        ...state,
        profile: { ...state.profile, [action.field]: action.value },
      }
    case 'SET_BELIEFS': {
      const beliefs = parseModularProfile(action.beliefs)
      if (beliefs === null) {
        return state
      }
      const next = {
        ...state,
        profile: { ...state.profile, beliefs },
        readingsByHorizon: admitReadings(state.readingsByHorizon, beliefs),
      }
      const staged = state.desk.staged
      if (staged !== null && !sectionsAdmissible(staged.packet.sections, beliefs)) {
        return {
          ...withDesk(next, clearStaged(state.desk)),
          intake: EMPTY_INTAKE,
        }
      }
      return next
    }
    case 'GENERATE_FORECAST':
      return seedForecast(state, 'regenerate')
    case 'ADVANCE':
      return advance(state)
    case 'BACK':
      return { ...state, phase: previousPhase(state.phase) }
    case 'SET_STEP_STATUS':
      return updateCurrentPlan(state, (plan) => ({
        ...plan,
        steps: plan.steps.map((step) =>
          step.id === action.stepId ? { ...step, status: action.status } : step,
        ),
      }))
    case 'SET_STEP_NOTE':
      return updateCurrentPlan(state, (plan) => ({
        ...plan,
        steps: plan.steps.map((step) =>
          step.id === action.stepId
            ? { ...step, userNote: clipPlanNote(action.userNote) }
            : step,
        ),
      }))
    case 'RESTART':
      return {
        ...freshSessionContent(),
        persistence: persistOnRestart(state.persistence),
        agentAvailability: state.agentAvailability,
      }
    case 'HYDRATE':
      return {
        ...state,
        phase: action.session.phase,
        horizon: action.session.horizon,
        profile: action.session.profile,
        forecastsByHorizon: action.session.forecastsByHorizon,
        readingsByHorizon: admitReadings(
          action.session.readingsByHorizon,
          action.session.profile.beliefs,
        ),
        resonanceByHorizon: action.session.resonanceByHorizon,
        plansByHorizon: action.session.plansByHorizon,
        persistence: { kind: 'saved', savedAt: action.session.savedAt },
        confirmation: IDLE_CONFIRMATION,
        desk: EMPTY_DESK,
        intake: EMPTY_INTAKE,
        externalShare: NO_SHARE,
      }
    case 'INTAKE_BEGIN':
      return applyIntakeAction(state, { op: 'begin', horizon: action.horizon })
    case 'INTAKE_APPEND_SOURCES':
      return applyIntakeAction(state, {
        op: 'append_sources',
        sources: action.sources,
      })
    case 'INTAKE_APPEND_SECTIONS':
      return applyIntakeAction(state, {
        op: 'append_sections',
        sections: action.sections,
      })
    case 'INTAKE_FINALIZE':
      return applyIntakeAction(state, { op: 'finalize' })
    case 'INTAKE_IMPORT_JSON':
      return applyIntakeAction(
        state,
        { op: 'import_json', text: action.text },
        action.now,
      )
    case 'INTAKE_CANCEL': {
      const cancelled = applyIntake(state.intake, { op: 'cancel' }, {
        beliefs: state.profile.beliefs,
      })
      return {
        ...withDesk(state, clearStaged(state.desk)),
        intake: cancelled.intake,
      }
    }
    case 'REQUEST_ADOPT_STAGED':
      return requestAdoptStaged(state, action.now)
    case 'STAGE_PACKET': {
      const admission = admitPacket(action.packet, {
        beliefs: state.profile.beliefs,
      })
      if (admission.status === 'blocked') {
        return state
      }
      const next = stagePacket(state.desk, admission.packet, { now: action.now })
      if (next === null) {
        return state
      }
      return {
        ...withDesk(state, next),
        intake: {
          status: 'ready',
          packet: admission.packet,
          review: admission.review,
        },
      }
    }
    case 'ADOPT_STAGED_PACKET': {
      const result = adoptStagedPacket(state.desk, {
        confirmationId: action.confirmationId,
        now: action.now,
        beliefs: state.profile.beliefs,
      })
      if (result === null) {
        return state
      }
      const spent = consumeTicket(result.desk, action.confirmationId)
      return {
        ...withDesk(state, spent ?? result.desk),
        readingsByHorizon: {
          ...state.readingsByHorizon,
          [result.artifact.horizon]: result.artifact,
        },
        intake: { status: 'adopted', digest: result.artifact.packetDigest },
      }
    }
    case 'PERSISTENCE_UNAVAILABLE':
      return { ...state, persistence: { kind: 'unavailable', reason: action.reason } }
    case 'PERSISTENCE_UNDECIDED':
      return { ...state, persistence: { kind: 'undecided' } }
    case 'PERSISTENCE_DECLINED_ON_LOAD':
      return { ...state, persistence: { kind: 'declined' } }
    case 'PERSISTENCE_GRANTED_EMPTY':
      return { ...state, persistence: { kind: 'saving' } }
    case 'PERSISTENCE_HELD': {
      const current = state.persistence
      if (
        current.kind === 'saving' ||
        current.kind === 'saved' ||
        (current.kind === 'error' && current.operation === 'save')
      ) {
        return state
      }
      return {
        ...state,
        persistence: { kind: 'held', savedAt: action.savedAt },
      }
    }
    case 'GRANT_PERSISTENCE_CONSENT':
      return { ...state, persistence: { kind: 'saving' } }
    case 'DECLINE_PERSISTENCE_CONSENT':
      return { ...state, persistence: { kind: 'declined' } }
    case 'PERSISTENCE_SAVE_START':
      return applySaveCallback(state, { kind: 'saving' })
    case 'PERSISTENCE_SAVE_SUCCESS':
      return applySaveCallback(state, {
        kind: 'saved',
        savedAt: action.savedAt,
      })
    case 'PERSISTENCE_SAVE_ERROR':
      return applySaveCallback(state, {
        kind: 'error',
        operation: 'save',
        message: action.message,
      })
    case 'PERSISTENCE_DECLINE_ERROR':
      return {
        ...state,
        persistence: {
          kind: 'error',
          operation: 'decline',
          message: action.message,
        },
      }
    case 'PERSISTENCE_ERASE_ERROR':
      return {
        ...state,
        persistence: {
          kind: 'error',
          operation: 'erase',
          message: action.message,
        },
      }
    case 'CLEAR_SAVED_DATA':
      return {
        ...freshSessionContent(),
        persistence: { kind: 'declined' },
        agentAvailability: state.agentAvailability,
      }
    case 'ADD_CUSTOM_STEP': {
      const title = action.title.trim()
      if (
        title.length === 0 ||
        title.length > PLAN_BOUNDS.maxTitleLength ||
        action.stepId.trim().length === 0
      ) {
        return state
      }
      return updateCurrentPlan(state, (plan) => {
        if (plan.steps.length >= PLAN_BOUNDS.maxStepsPerPlan) {
          return plan
        }
        return {
          ...plan,
          steps: [
            ...plan.steps,
            {
              id: action.stepId,
              title,
              rationale: '',
              status: 'proposed',
              userNote: clipPlanNote(action.userNote),
              origin: 'custom',
            },
          ],
        }
      })
    }
    case 'REMOVE_CUSTOM_STEP':
      return updateCurrentPlan(state, (plan) => ({
        ...plan,
        steps: plan.steps.filter(
          (step) => !(step.id === action.stepId && step.origin === 'custom'),
        ),
      }))
    case 'SET_AGENT_AVAILABILITY':
      return { ...state, agentAvailability: action.availability }
    case 'REQUEST_CONFIRMATION':
      return requestConfirmation(state, action)
    case 'APPROVE_CONFIRMATION':
      return approveConfirmation(
        state,
        action.id,
        action.persistSession === true,
        action.now,
      )
    case 'DENY_CONFIRMATION':
      return denyConfirmation(state, action.id)
    case 'CONSUME_CONFIRMATION':
      return consumeConfirmation(state, action.id)
    case 'SET_RESONANCE':
      return applySetResonance(state, action)
    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
  }
}

function withDesk(state: AppState, desk: AppState['desk']): AppState {
  return {
    ...state,
    desk,
    confirmation: confirmationView(desk),
  }
}

function reconcileBriefTicket(state: AppState): AppState {
  const ticket = state.desk.ticket
  if (ticket.status !== 'pending' && ticket.status !== 'approved') {
    return state
  }
  if (ticket.payload.kind !== 'research_brief') {
    return state
  }
  if (liveBriefDigest(state) === ticket.payload.briefDigest) {
    return state
  }
  return withDesk(state, { ...state.desk, ticket: { status: 'idle' } })
}

function applyIntakeAction(
  state: AppState,
  command: IntakeCommand,
  now?: Instant,
): AppState {
  const result = applyIntake(state.intake, command, {
    beliefs: state.profile.beliefs,
  })
  if (result.packet === null) {
    return { ...state, intake: result.intake }
  }
  const staged = stagePacket(state.desk, result.packet, {
    now: now ?? mustInstant(Date.now()),
  })
  if (staged === null) {
    return { ...state, intake: result.intake }
  }
  return {
    ...withDesk(state, staged),
    intake: result.intake,
  }
}

function requestAdoptStaged(state: AppState, now: Instant): AppState {
  const staged = state.desk.staged
  if (staged === null) {
    return {
      ...state,
      intake: {
        status: 'rejected',
        code: 'malformed',
        reason: 'There is no reviewed packet to adopt.',
      },
    }
  }
  if (now >= staged.expiresAt) {
    return {
      ...withDesk(state, clearStaged(state.desk)),
      intake: {
        status: 'rejected',
        code: 'expired',
        reason: 'This staged packet expired after 30 minutes and was not adopted.',
      },
    }
  }
  return requestConfirmation(state, {
    kind: 'adopt_reading',
    summary:
      'Adopt this reading packet onto the page. It stays a review until you approve. It is not an exhaustive search.',
    payload: {
      kind: 'adopt_reading',
      packetDigest: staged.digest,
      horizon: staged.packet.horizon,
    },
    now,
  })
}

function adoptAfterApproval(
  state: AppState,
  confirmationId: string,
  now: Instant,
): AppState {
  const result = adoptStagedPacket(state.desk, {
    confirmationId: confirmationId as ConfirmationId,
    now,
    beliefs: state.profile.beliefs,
  })
  if (result === null) {
    return {
      ...state,
      intake: {
        status: 'rejected',
        code: 'expired',
        reason: 'This packet could not be adopted. The confirmation may have expired or no longer match the staged packet.',
      },
    }
  }
  const spent = consumeTicket(result.desk, confirmationId as ConfirmationId)
  return {
    ...withDesk(state, spent ?? result.desk),
    readingsByHorizon: {
      ...state.readingsByHorizon,
      [result.artifact.horizon]: result.artifact,
    },
    intake: { status: 'adopted', digest: result.artifact.packetDigest },
  }
}

function isHorizonId(value: string): value is HorizonId {
  return value === 'daily' || value === 'weekly' || value === 'yearly'
}

function requestConfirmation(
  state: AppState,
  action: {
    kind: ConfirmationPayload['kind']
    summary: string
    payload: ConfirmationPayload
    now?: Instant
  },
): AppState {
  const issued = issueConfirmation(state.desk, {
    payload: action.payload,
    summary: action.summary,
    now: action.now ?? mustInstant(Date.now()),
  })
  if (issued === null) {
    return state
  }
  return withDesk(state, issued.desk)
}

function approveConfirmation(
  state: AppState,
  id: string,
  persistSession: boolean,
  now?: Instant,
): AppState {
  const nextDesk = approveTicket(
    state.desk,
    id as ConfirmationId,
    now ?? mustInstant(Date.now()),
  )
  if (nextDesk === null) {
    return state
  }
  const next = withDesk(state, nextDesk)
  const current = next.confirmation
  if (current.status !== 'approved') {
    return next
  }

  switch (current.payload.kind) {
    case 'personal_data_access':
    case 'research_brief':
      return next
    case 'adopt_reading':
      return adoptAfterApproval(next, current.id, mustInstant(Date.now()))
    case 'profile_update': {
      const proposed = current.payload.proposed
      const digestBound =
        confirmationIdForPayload(current.payload) === (current.id as ConfirmationId)
      return {
        ...next,
        profile: {
          displayName: proposed.displayName ?? state.profile.displayName,
          focusIntention: proposed.focusIntention ?? state.profile.focusIntention,
          tone: proposed.tone ?? state.profile.tone,
          beliefs:
            digestBound && proposed.beliefs !== undefined
              ? { ...state.profile.beliefs, ...proposed.beliefs }
              : state.profile.beliefs,
        },
      }
    }
    case 'external_share':
      return {
        ...next,
        externalShare: {
          kind: 'approved_not_sent',
          include: current.payload.include,
          reason:
            'Sharing was approved and nothing left this device. Hosted research is not part of this preview.',
        },
      }
    case 'plan_save': {
      const consented = persistSession ? applyPlanSaveConsent(next) : next
      const granted =
        persistSession &&
        consented.persistence.kind === 'saving' &&
        state.persistence.kind !== 'saving'
      return {
        ...consented,
        confirmation: {
          ...current,
          sessionPersist: granted ? 'granted' : 'unchanged',
        },
      }
    }
    default: {
      const _exhaustive: never = current.payload
      return _exhaustive
    }
  }
}

function denyConfirmation(state: AppState, id: string): AppState {
  const nextDesk = denyTicket(state.desk, id as ConfirmationId)
  if (nextDesk === null) {
    return state
  }
  const next = withDesk(state, nextDesk)
  if (state.desk.ticket.status === 'pending' && state.desk.ticket.payload.kind === 'external_share') {
    return { ...next, externalShare: { kind: 'denied' } }
  }
  if (state.desk.ticket.status === 'pending' && state.desk.ticket.payload.kind === 'adopt_reading') {
    const spent = consumeTicket(nextDesk, id as ConfirmationId)
    return spent === null ? next : withDesk(next, spent)
  }
  return next
}

function consumeConfirmation(state: AppState, id: string): AppState {
  const nextDesk = consumeTicket(state.desk, id as ConfirmationId)
  if (nextDesk === null) {
    return state
  }
  return withDesk(state, nextDesk)
}

function applyPlanSaveConsent(state: AppState): AppState {
  switch (state.persistence.kind) {
    case 'unavailable':
    case 'checking':
    case 'saving':
    case 'saved':
      return state
    case 'error':
      if (state.persistence.operation === 'decline') {
        return { ...state, persistence: { kind: 'saving' } }
      }
      return state
    case 'undecided':
    case 'declined':
    case 'held':
      return { ...state, persistence: { kind: 'saving' } }
    default: {
      const _exhaustive: never = state.persistence
      return _exhaustive
    }
  }
}

function applySaveCallback(
  state: AppState,
  persistence: PersistenceStatus,
): AppState {
  if (state.persistence.kind === 'held') {
    return state
  }
  if (
    state.persistence.kind === 'error' &&
    (state.persistence.operation === 'erase' ||
      state.persistence.operation === 'decline')
  ) {
    return state
  }
  return { ...state, persistence }
}

function clipPlanNote(note: string): string {
  return note.trim().slice(0, PLAN_BOUNDS.maxUserNoteLength)
}

function admitReadings(
  readings: Record<HorizonId, ReadingArtifact | null>,
  beliefs: ModularBeliefs,
): Record<HorizonId, ReadingArtifact | null> {
  return {
    daily: admitReading(readings.daily, beliefs),
    weekly: admitReading(readings.weekly, beliefs),
    yearly: admitReading(readings.yearly, beliefs),
  }
}

function admitReading(
  artifact: ReadingArtifact | null,
  beliefs: ModularBeliefs,
): ReadingArtifact | null {
  if (artifact === null || !sectionsAdmissible(artifact.sections, beliefs)) {
    return null
  }
  return artifact
}

function persistOnRestart(persistence: PersistenceStatus): PersistenceStatus {
  switch (persistence.kind) {
    case 'saved':
      return { kind: 'held', savedAt: persistence.savedAt }
    case 'saving':
      return { kind: 'held', savedAt: new Date().toISOString() }
    case 'error':
      if (persistence.operation === 'save') {
        return { kind: 'held', savedAt: new Date().toISOString() }
      }
      return persistence
    case 'unavailable':
    case 'declined':
    case 'checking':
    case 'undecided':
    case 'held':
      return persistence
    default: {
      const _exhaustive: never = persistence
      return _exhaustive
    }
  }
}

function updateCurrentPlan(
  state: AppState,
  patch: (plan: ChoicePlanDraft) => ChoicePlanDraft,
): AppState {
  const plan = currentPlan(state)
  if (plan === null) {
    return state
  }

  return {
    ...state,
    plansByHorizon: {
      ...state.plansByHorizon,
      [state.horizon]: patch(plan),
    },
  }
}

function seedForecast(
  state: AppState,
  mode: 'reopen' | 'regenerate',
): AppState {
  if (state.profile.focusIntention.trim().length === 0) {
    return state
  }

  const forecast = generateForecast(
    fixtureDerivedProfile(state.profile),
    state.horizon,
  )
  const existingPlan = state.plansByHorizon[state.horizon]
  const customSteps =
    existingPlan === null
      ? []
      : existingPlan.steps.filter((step) => step.origin === 'custom')
  const priorFixture = new Map(
    (existingPlan?.steps ?? [])
      .filter((step) => step.origin === 'fixture')
      .map((step) => [step.id, step]),
  )

  const plan: ChoicePlanDraft = {
    horizon: state.horizon,
    createdAt: forecast.generatedAt,
    steps: [
      ...forecast.suggestedSteps.map((step) => {
        const prior = mode === 'reopen' ? priorFixture.get(step.id) : undefined
        return {
          ...step,
          origin: 'fixture' as const,
          status: prior?.status ?? 'proposed',
          userNote: prior?.userNote ?? '',
        }
      }),
      ...customSteps,
    ],
    freeWillNote: FREE_WILL_NOTE,
  }

  return {
    ...state,
    forecastsByHorizon: {
      ...state.forecastsByHorizon,
      [state.horizon]: forecast,
    },
    plansByHorizon: {
      ...state.plansByHorizon,
      [state.horizon]: plan,
    },
  }
}

function advance(state: AppState): AppState {
  if (!canAdvance(state)) {
    return state
  }

  const phase = nextPhase(state.phase)
  if (phase === state.phase) {
    return state
  }

  if (state.phase === 'context') {
    return { ...seedForecast(state, 'reopen'), phase }
  }

  if (phase === 'choice' && currentPlan(state) === null) {
    return {
      ...state,
      phase,
      plansByHorizon: {
        ...state.plansByHorizon,
        [state.horizon]: emptyChoicePlan(state),
      },
    }
  }

  return { ...state, phase }
}

function emptyChoicePlan(state: AppState): ChoicePlanDraft {
  const artifact = currentReading(state)
  return {
    horizon: state.horizon,
    createdAt:
      artifact !== null
        ? new Date(artifact.adoptedAt).toISOString()
        : new Date().toISOString(),
    steps: [],
    freeWillNote: FREE_WILL_NOTE,
  }
}
