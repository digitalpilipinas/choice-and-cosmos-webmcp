import { confirmationIdFor, createCustomStepId, type AppAction } from '../domain/loop.ts'
import { HORIZON_BY_ID } from '../fixtures/horizons.ts'
import {
  currentForecast,
  currentPlan,
  evidenceForSection,
  sectionsCitingEvidence,
  uncertaintyFor,
} from '../domain/selectors.ts'
import type {
  AppState,
  ChoiceStepStatus,
  ConfirmationPayload,
  DerivedProfile,
  HorizonId,
  ReportSectionId,
  ShareInclude,
} from '../domain/types.ts'
import { TOOL_NAMES, type ToolName } from './catalog.ts'
import type { ToolResult } from './results.ts'

const TONES = ['grounded', 'curious', 'bold'] as const
const HORIZONS = ['daily', 'weekly', 'yearly'] as const
const STEP_STATUSES = ['proposed', 'accepted', 'dismissed'] as const
const SHARE_INCLUDES = ['profile', 'forecast', 'plan'] as const
const SECTION_IDS = [
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
] as const

export interface ToolRun {
  result: ToolResult
  actions: AppAction[]
}

export function runTool(
  state: AppState,
  name: string,
  input: Record<string, unknown>,
): ToolRun {
  if (!isToolName(name)) {
    return {
      result: {
        ok: false,
        code: 'invalid_input',
        message: `Unknown tool ${name}.`,
      },
      actions: [],
    }
  }

  switch (name) {
    case 'get_session_status':
      return { result: { ok: true, data: sessionStatus(state) }, actions: [] }
    case 'request_profile_access':
      return gatedRead(state, input, {
        kind: 'personal_data_access',
        summary:
          'An agent wants to read your display name, focus intention, and tone. Nothing else is included. You can deny this.',
        payload: { kind: 'personal_data_access' },
        onApproved: (current) => ({
          displayName: current.profile.displayName,
          focusIntention: current.profile.focusIntention,
          tone: current.profile.tone,
        }),
      })
    case 'propose_profile_update':
      return proposeProfileUpdate(state, input)
    case 'generate_forecast':
      return generateForecastTool(state, input)
    case 'inspect_evidence':
      return inspectEvidence(state, input)
    case 'draft_choice_plan':
      return draftChoicePlan(state, input)
    case 'request_plan_save':
      return requestPlanSave(state, input)
    case 'request_external_share':
      return requestExternalShare(state, input)
    default: {
      const _exhaustive: never = name
      return _exhaustive
    }
  }
}

function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name)
}

function sessionStatus(state: AppState) {
  const confirmation =
    state.confirmation.status === 'idle'
      ? { status: 'idle' as const }
      : {
          status: state.confirmation.status,
          id: state.confirmation.id,
          kind: state.confirmation.kind,
        }

  return {
    phase: state.phase,
    horizon: state.horizon,
    hasFocus: state.profile.focusIntention.trim().length > 0,
    hasForecast: currentForecast(state) !== null,
    hasPlan: currentPlan(state) !== null,
    persistence: state.persistence.kind,
    agent: state.agentAvailability.kind,
    confirmation,
    externalShare: state.externalShare.kind,
  }
}

function gatedRead(
  state: AppState,
  input: Record<string, unknown>,
  spec: {
    kind: ConfirmationPayload['kind']
    summary: string
    payload: ConfirmationPayload
    onApproved: (current: AppState) => unknown
  },
): ToolRun {
  const confirmationId = optionalString(input.confirmationId)
  return resolveGate(state, confirmationId, spec)
}

function proposeProfileUpdate(
  state: AppState,
  input: Record<string, unknown>,
): ToolRun {
  const proposed: Partial<DerivedProfile> = {}
  if (input.displayName !== undefined) {
    const displayName = requiredString(input.displayName)
    if (displayName === null) {
      return invalid('displayName must be a string.')
    }
    proposed.displayName = displayName
  }
  if (input.focusIntention !== undefined) {
    const focusIntention = requiredString(input.focusIntention)
    if (focusIntention === null) {
      return invalid('focusIntention must be a string.')
    }
    proposed.focusIntention = focusIntention
  }
  if (input.tone !== undefined) {
    if (!isTone(input.tone)) {
      return invalid('tone must be grounded, curious, or bold.')
    }
    proposed.tone = input.tone
  }

  if (Object.keys(proposed).length === 0) {
    return invalid('Propose at least one of displayName, focusIntention, or tone.')
  }

  const confirmationId = optionalString(input.confirmationId)
  return resolveGate(state, confirmationId, {
    kind: 'profile_update',
    summary: profileUpdateSummary(proposed),
    payload: { kind: 'profile_update', proposed },
    onApproved: (current) =>
      current.confirmation.status === 'approved'
      && current.confirmation.payload.kind === 'profile_update'
        ? current.confirmation.payload.proposed
        : {},
  })
}

function generateForecastTool(
  state: AppState,
  input: Record<string, unknown>,
): ToolRun {
  const actions: AppAction[] = []
  let working = state

  if (input.horizon !== undefined) {
    if (!isHorizon(input.horizon)) {
      return invalid('horizon must be daily, weekly, or yearly.')
    }
    actions.push({ type: 'SET_HORIZON', horizon: input.horizon })
    working = { ...working, horizon: input.horizon }
  }

  if (working.profile.focusIntention.trim().length === 0) {
    return {
      result: {
        ok: false,
        code: 'focus_required',
        message: 'A focus intention is required before a forecast can be generated.',
      },
      actions: [],
    }
  }

  actions.push({ type: 'GENERATE_FORECAST' })
  return {
    result: {
      ok: true,
      data: {
        horizon: working.horizon,
        generated: true,
        mode: 'regenerate',
      },
    },
    actions,
  }
}

function inspectEvidence(
  state: AppState,
  input: Record<string, unknown>,
): ToolRun {
  const forecast = currentForecast(state)
  if (forecast === null) {
    return {
      result: {
        ok: false,
        code: 'no_forecast',
        message: 'No forecast is in memory for this horizon yet.',
      },
      actions: [],
    }
  }

  if (input.sectionId !== undefined) {
    if (!isSectionId(input.sectionId)) {
      return invalid('sectionId is not a known report section.')
    }
    const section = forecast.sections.find((entry) => entry.id === input.sectionId)
    if (section === undefined) {
      return invalid('That section is not in the current forecast.')
    }
    return {
      result: {
        ok: true,
        data: {
          section: { id: section.id, title: section.title },
          evidence: evidenceForSection(forecast, section),
          uncertainty: uncertaintyFor(forecast),
        },
      },
      actions: [],
    }
  }

  if (input.evidenceId !== undefined) {
    const evidenceId = requiredString(input.evidenceId)
    if (evidenceId === null) {
      return invalid('evidenceId must be a string.')
    }
    const item = forecast.evidence.find((entry) => entry.id === evidenceId)
    if (item === undefined) {
      return invalid('That evidence id is not in the current forecast.')
    }
    return {
      result: {
        ok: true,
        data: {
          evidence: item,
          citedBy: sectionsCitingEvidence(forecast, evidenceId).map((section) => ({
            id: section.id,
            title: section.title,
          })),
        },
      },
      actions: [],
    }
  }

  return {
    result: {
      ok: true,
      data: {
        cockpit: {
          horizon: state.horizon,
          name: HORIZON_BY_ID[state.horizon].label,
          tagline: HORIZON_BY_ID[state.horizon].tagline,
          windowDescription: HORIZON_BY_ID[state.horizon].windowDescription,
          generatedAt: forecast.generatedAt,
        },
        coverage: forecast.coverage,
        uncertainty: uncertaintyFor(forecast),
        evidence: forecast.evidence,
        sections: forecast.sections.map((section) => ({
          id: section.id,
          title: section.title,
          evidenceIds: section.evidenceIds,
        })),
      },
    },
    actions: [],
  }
}

function draftChoicePlan(
  state: AppState,
  input: Record<string, unknown>,
): ToolRun {
  const plan = currentPlan(state)
  if (plan === null) {
    return {
      result: {
        ok: false,
        code: 'no_plan',
        message: 'No choice plan is in memory yet. Generate a forecast first.',
      },
      actions: [],
    }
  }

  const action = input.action
  if (action === 'set_status') {
    const stepId = requiredString(input.stepId)
    if (stepId === null || !isStepStatus(input.status)) {
      return invalid('set_status needs stepId and a proposed, accepted, or dismissed status.')
    }
    if (!plan.steps.some((step) => step.id === stepId)) {
      return invalid('That step is not on the current plan.')
    }
    return {
      result: { ok: true, data: { stepId, status: input.status } },
      actions: [{ type: 'SET_STEP_STATUS', stepId, status: input.status }],
    }
  }

  if (action === 'set_note') {
    const stepId = requiredString(input.stepId)
    const userNote = requiredString(input.userNote)
    if (stepId === null || userNote === null) {
      return invalid('set_note needs stepId and userNote.')
    }
    if (!plan.steps.some((step) => step.id === stepId)) {
      return invalid('That step is not on the current plan.')
    }
    return {
      result: { ok: true, data: { stepId, userNote } },
      actions: [{ type: 'SET_STEP_NOTE', stepId, userNote }],
    }
  }

  if (action === 'add_step') {
    const title = requiredString(input.title)
    if (title === null || title.trim().length === 0) {
      return invalid('add_step needs a non-empty title.')
    }
    const userNote =
      input.userNote === undefined ? '' : requiredString(input.userNote)
    if (userNote === null) {
      return invalid('userNote must be a string.')
    }
    return {
      result: { ok: true, data: { title: title.trim(), userNote } },
      actions: [{ type: 'ADD_CUSTOM_STEP', stepId: createCustomStepId(), title, userNote }],
    }
  }

  if (action === 'remove_step') {
    const stepId = requiredString(input.stepId)
    if (stepId === null) {
      return invalid('remove_step needs stepId.')
    }
    const step = plan.steps.find((entry) => entry.id === stepId)
    if (step === undefined || step.origin !== 'custom') {
      return invalid('Only a custom step can be removed.')
    }
    return {
      result: { ok: true, data: { stepId } },
      actions: [{ type: 'REMOVE_CUSTOM_STEP', stepId }],
    }
  }

  return invalid('action must be set_status, set_note, add_step, or remove_step.')
}

function requestPlanSave(
  state: AppState,
  input: Record<string, unknown>,
): ToolRun {
  if (currentPlan(state) === null) {
    return {
      result: {
        ok: false,
        code: 'no_plan',
        message: 'No choice plan is in memory to save.',
      },
      actions: [],
    }
  }

  if (state.persistence.kind === 'unavailable') {
    return {
      result: {
        ok: false,
        code: 'unavailable',
        message: state.persistence.reason,
      },
      actions: [],
    }
  }

  const confirmationId = optionalString(input.confirmationId)
  return resolveGate(state, confirmationId, {
    kind: 'plan_save',
    summary:
      'An agent wants you to approve this choice plan. Approving the plan does not turn on local saving. A separate checkbox can also save this session in this browser.',
    payload: { kind: 'plan_save', horizon: state.horizon },
    onApproved: (current) => ({
      horizon: current.horizon,
      sessionPersist:
        current.confirmation.status === 'approved'
          ? (current.confirmation.sessionPersist ?? 'unchanged')
          : 'unchanged',
      persistence: current.persistence.kind,
    }),
  })
}

function requestExternalShare(
  state: AppState,
  input: Record<string, unknown>,
): ToolRun {
  let include: ShareInclude[] = ['profile', 'forecast', 'plan']
  if (input.include !== undefined) {
    if (!Array.isArray(input.include) || input.include.length === 0) {
      return invalid('include must be a non-empty array of profile, forecast, or plan.')
    }
    const parsed: ShareInclude[] = []
    for (const item of input.include) {
      if (!isShareInclude(item)) {
        return invalid('include entries must be profile, forecast, or plan.')
      }
      if (!parsed.includes(item)) {
        parsed.push(item)
      }
    }
    include = parsed
  }

  const confirmationId = optionalString(input.confirmationId)
  return resolveGate(state, confirmationId, {
    kind: 'external_share',
    summary: `An agent wants permission to share ${include.join(', ')} with a future Gemini research run. Approval is recorded only. This slice does not send anything.`,
    payload: {
      kind: 'external_share',
      destination: 'gemini-research',
      include,
    },
    onApproved: (current) => current.externalShare,
  })
}

function resolveGate(
  state: AppState,
  confirmationId: string | undefined,
  spec: {
    kind: ConfirmationPayload['kind']
    summary: string
    payload: ConfirmationPayload
    onApproved: (current: AppState) => unknown
  },
): ToolRun {
  const expectedId = confirmationIdFor(spec.kind)
  const current = state.confirmation

  if (confirmationId !== undefined && confirmationId !== expectedId) {
    return {
      result: {
        ok: false,
        code: 'unknown_confirmation',
        message: 'That confirmation id does not match this request.',
      },
      actions: [],
    }
  }

  if (confirmationId === expectedId) {
    if (current.status === 'approved' && current.id === expectedId) {
      return {
        result: { ok: true, data: spec.onApproved(state) },
        actions: [{ type: 'CONSUME_CONFIRMATION', id: expectedId }],
      }
    }
    if (current.status === 'denied' && current.id === expectedId) {
      return {
        result: {
          ok: false,
          code: 'denied',
          message: 'The person denied this confirmation.',
          confirmationId: expectedId,
          kind: spec.kind,
        },
        actions: [{ type: 'CONSUME_CONFIRMATION', id: expectedId }],
      }
    }
    if (current.status === 'pending' && current.id === expectedId) {
      return {
        result: {
          ok: false,
          code: 'needs_confirmation',
          message: current.summary,
          confirmationId: expectedId,
          kind: spec.kind,
        },
        actions: [],
      }
    }
    return {
      result: {
        ok: false,
        code: 'unknown_confirmation',
        message: 'There is no matching approved confirmation.',
      },
      actions: [],
    }
  }

  if (current.status !== 'idle' && current.kind !== spec.kind) {
    return {
      result: {
        ok: false,
        code: 'confirmation_busy',
        message: 'Another confirmation is already waiting.',
        confirmationId: current.id,
        kind: current.kind,
      },
      actions: [],
    }
  }

  if (current.status === 'pending' && current.kind === spec.kind) {
    return {
      result: {
        ok: false,
        code: 'needs_confirmation',
        message: current.summary,
        confirmationId: current.id,
        kind: current.kind,
      },
      actions: [],
    }
  }

  if (current.status === 'approved' || current.status === 'denied') {
    return {
      result: {
        ok: false,
        code: 'needs_confirmation',
        message:
          current.status === 'denied'
            ? 'The person denied this confirmation.'
            : spec.summary,
        confirmationId: current.id,
        kind: current.kind,
      },
      actions: [],
    }
  }

  return {
    result: {
      ok: false,
      code: 'needs_confirmation',
      message: spec.summary,
      confirmationId: expectedId,
      kind: spec.kind,
    },
    actions: [
      {
        type: 'REQUEST_CONFIRMATION',
        kind: spec.kind,
        summary: spec.summary,
        payload: spec.payload,
      },
    ],
  }
}

function profileUpdateSummary(proposed: Partial<DerivedProfile>): string {
  const fields: string[] = []
  if (proposed.displayName !== undefined) {
    fields.push('display name')
  }
  if (proposed.focusIntention !== undefined) {
    fields.push('focus intention')
  }
  if (proposed.tone !== undefined) {
    fields.push('tone')
  }
  return `An agent wants to change ${fields.join(' and ')}. The exact diff is on this page only.`
}

function invalid(message: string): ToolRun {
  return {
    result: { ok: false, code: 'invalid_input', message },
    actions: [],
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function isTone(value: unknown): value is DerivedProfile['tone'] {
  return (TONES as readonly unknown[]).includes(value)
}

function isHorizon(value: unknown): value is HorizonId {
  return (HORIZONS as readonly unknown[]).includes(value)
}

function isStepStatus(value: unknown): value is ChoiceStepStatus {
  return (STEP_STATUSES as readonly unknown[]).includes(value)
}

function isShareInclude(value: unknown): value is ShareInclude {
  return (SHARE_INCLUDES as readonly unknown[]).includes(value)
}

function isSectionId(value: unknown): value is ReportSectionId {
  return (SECTION_IDS as readonly unknown[]).includes(value)
}
