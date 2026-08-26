import { generateForecast } from '../fixtures/generateForecast.ts'
import { currentForecast, currentPlan } from './selectors.ts'
import type {
  AgentAvailability,
  AppState,
  ChoicePlanDraft,
  ChoiceStepStatus,
  ConfirmationPayload,
  DerivedProfile,
  ForecastFixture,
  HorizonId,
  PersistenceStatus,
  PhaseId,
  StoredSessionV1,
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

const IDLE_CONFIRMATION = { status: 'idle' } as const
const NO_SHARE = { kind: 'none' } as const

function freshSessionContent(): Omit<AppState, 'persistence' | 'agentAvailability'> {
  return {
    phase: 'context',
    horizon: 'daily',
    profile: { displayName: 'You', focusIntention: '', tone: 'grounded' },
    forecastsByHorizon: emptyForecasts(),
    plansByHorizon: emptyPlans(),
    confirmation: IDLE_CONFIRMATION,
    externalShare: NO_SHARE,
  }
}

export const INITIAL_STATE: AppState = {
  ...freshSessionContent(),
  persistence: { kind: 'checking' },
  agentAvailability: { kind: 'checking' },
}

export function confirmationIdFor(kind: ConfirmationPayload['kind']): string {
  return `confirm-${kind}`
}

export const FREE_WILL_NOTE =
  'This is a reflective guide, not a command. You retain free will. Nothing here is required or automatic.'

type SetProfileFieldAction = {
  [K in keyof DerivedProfile]: {
    type: 'SET_PROFILE_FIELD'
    field: K
    value: DerivedProfile[K]
  }
}[keyof DerivedProfile]

export type AppAction =
  | { type: 'SET_HORIZON'; horizon: HorizonId }
  | SetProfileFieldAction
  | { type: 'GENERATE_FORECAST' }
  | { type: 'ADVANCE' }
  | { type: 'BACK' }
  | { type: 'SET_STEP_STATUS'; stepId: string; status: ChoiceStepStatus }
  | { type: 'SET_STEP_NOTE'; stepId: string; userNote: string }
  | { type: 'RESTART' }
  | { type: 'HYDRATE'; session: StoredSessionV1 }
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
    }
  | { type: 'APPROVE_CONFIRMATION'; id: string; persistSession?: boolean }
  | { type: 'DENY_CONFIRMATION'; id: string }
  | { type: 'CONSUME_CONFIRMATION'; id: string }

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
      return currentForecast(state) !== null
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
  switch (action.type) {
    case 'SET_HORIZON':
      return { ...state, horizon: action.horizon }
    case 'SET_PROFILE_FIELD':
      return {
        ...state,
        profile: { ...state.profile, [action.field]: action.value },
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
            ? { ...step, userNote: action.userNote }
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
        plansByHorizon: action.session.plansByHorizon,
        persistence: { kind: 'saved', savedAt: action.session.savedAt },
        confirmation: IDLE_CONFIRMATION,
        externalShare: NO_SHARE,
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
      if (title.length === 0 || action.stepId.trim().length === 0) {
        return state
      }
      return updateCurrentPlan(state, (plan) => ({
        ...plan,
        steps: [
          ...plan.steps,
          {
            id: action.stepId,
            title,
            rationale: '',
            status: 'proposed',
            userNote: action.userNote.trim(),
            origin: 'custom',
          },
        ],
      }))
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
      return approveConfirmation(state, action.id, action.persistSession === true)
    case 'DENY_CONFIRMATION':
      return denyConfirmation(state, action.id)
    case 'CONSUME_CONFIRMATION':
      return consumeConfirmation(state, action.id)
    default: {
      const _exhaustive: never = action
      return _exhaustive
    }
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
  },
): AppState {
  const id = confirmationIdFor(action.kind)
  const current = state.confirmation
  if (current.status !== 'idle') {
    return state
  }

  return {
    ...state,
    confirmation: {
      status: 'pending',
      id,
      kind: action.kind,
      summary: action.summary,
      payload: action.payload,
    },
  }
}

function approveConfirmation(
  state: AppState,
  id: string,
  persistSession: boolean,
): AppState {
  const current = state.confirmation
  if (current.status !== 'pending' || current.id !== id) {
    return state
  }

  const approved = {
    status: 'approved' as const,
    id: current.id,
    kind: current.kind,
    payload: current.payload,
  }

  switch (current.payload.kind) {
    case 'personal_data_access':
      return { ...state, confirmation: approved }
    case 'profile_update':
      return {
        ...state,
        confirmation: approved,
        profile: { ...state.profile, ...current.payload.proposed },
      }
    case 'external_share':
      return {
        ...state,
        confirmation: approved,
        externalShare: {
          kind: 'approved_not_sent',
          destination: current.payload.destination,
          include: current.payload.include,
          reason:
            'Sharing was approved and nothing left this device. Gemini research is not connected in this slice.',
        },
      }
    case 'plan_save': {
      const next = persistSession ? applyPlanSaveConsent(state) : state
      const granted =
        persistSession &&
        next.persistence.kind === 'saving' &&
        state.persistence.kind !== 'saving'
      return {
        ...next,
        confirmation: {
          ...approved,
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
  const current = state.confirmation
  if (current.status !== 'pending' || current.id !== id) {
    return state
  }

  if (current.kind === 'external_share') {
    return {
      ...state,
      confirmation: { status: 'denied', id: current.id, kind: current.kind },
      externalShare: { kind: 'denied', destination: 'gemini-research' },
    }
  }

  return {
    ...state,
    confirmation: { status: 'denied', id: current.id, kind: current.kind },
  }
}

function consumeConfirmation(state: AppState, id: string): AppState {
  const current = state.confirmation
  if (
    (current.status !== 'approved' && current.status !== 'denied') ||
    current.id !== id
  ) {
    return state
  }
  return { ...state, confirmation: IDLE_CONFIRMATION }
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
  return { ...state, persistence }
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

  const forecast = generateForecast(state.profile, state.horizon)
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

  return { ...state, phase }
}
