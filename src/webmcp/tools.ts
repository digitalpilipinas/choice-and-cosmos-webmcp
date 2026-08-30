import { mustInstant } from '../domain/brand.ts'
import {
  appReducer,
  confirmationIdForPayload,
  createCustomStepId,
  type ToolAction,
} from '../domain/loop.ts'
import {
  hasBeliefModule,
  parseModularProfile,
} from '../domain/profile.ts'
import {
  currentForecast,
  currentPlan,
  currentReading,
} from '../domain/selectors.ts'
import { isStagedExpired, isTicketExpired } from '../domain/trust.ts'
import type {
  AppState,
  ConfirmationPayload,
  HorizonId,
  PersonProfile,
  ProfileAccessField,
  ProfileUpdatePatch,
} from '../domain/types.ts'
import {
  DEFAULT_PROFILE_ACCESS_FIELDS,
  PROFILE_ACCESS_FIELDS,
} from '../domain/types.ts'
import { PACKET_BOUNDS, PLAN_BOUNDS } from '../domain/bounds.ts'
import { buildExactBrief, briefConsentSnapshot, briefDigest } from '../research/brief.ts'
import { intakeProgress } from '../research/coordinator.ts'
import { TOOL_NAMES, type ToolName } from './catalog.ts'
import type { ToolResult } from './results.ts'

const TONES = ['grounded', 'curious', 'bold'] as const
const HORIZONS = ['daily', 'weekly', 'yearly'] as const
const PACKET_OPS = [
  'begin',
  'append_sources',
  'append_content',
  'finalize',
  'cancel',
] as const

export interface ToolRun {
  result: ToolResult
  actions: ToolAction[]
}

export function profileAccessPayload(
  fields: readonly ProfileAccessField[] = DEFAULT_PROFILE_ACCESS_FIELDS,
): Extract<ConfirmationPayload, { kind: 'personal_data_access' }> {
  return {
    kind: 'personal_data_access',
    fields: PROFILE_ACCESS_FIELDS.filter((field) => fields.includes(field)),
  }
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
      return requestProfileAccess(state, input)
    case 'propose_profile_update':
      return proposeProfileUpdate(state, input)
    case 'get_research_brief':
      return getResearchBrief(state, input)
    case 'submit_reading_packet':
      return submitReadingPacket(state, input)
    case 'inspect_reading':
      return { result: { ok: true, data: inspectReading(state) }, actions: [] }
    case 'propose_choice_plan':
      return proposeChoicePlan(state, input)
    case 'request_plan_save':
      return requestPlanSave(state, input)
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
    hasPlan: currentPlan(state) !== null,
    hasReading: currentReading(state) !== null,
    hasStagedPacket: state.desk.staged !== null,
    intake: state.intake.status,
    persistence: state.persistence.kind,
    agent: state.agentAvailability.kind,
    fallback:
      state.agentAvailability.kind === 'unavailable' ? 'manual_import' : null,
    confirmation,
  }
}

function requestProfileAccess(
  state: AppState,
  input: Record<string, unknown>,
): ToolRun {
  const fields = parseAccessFields(input.fields)
  if (fields === null) {
    return invalid('fields must be an array of approved profile field names.')
  }
  const payload = profileAccessPayload(fields)
  return resolveGate(state, optionalString(input.confirmationId), {
    kind: 'personal_data_access',
    summary:
      'An agent wants to read the exact profile fields listed on this page. Nothing else is included. You can deny this.',
    payload,
    onApproved: (current) =>
      projectProfile(
        current.profile,
        current.confirmation.status === 'approved' &&
          current.confirmation.payload.kind === 'personal_data_access'
          ? (current.confirmation.payload.fields ?? DEFAULT_PROFILE_ACCESS_FIELDS)
          : payload.fields ?? DEFAULT_PROFILE_ACCESS_FIELDS,
      ),
  })
}

function proposeProfileUpdate(
  state: AppState,
  input: Record<string, unknown>,
): ToolRun {
  if (input.status !== undefined || input.resonance !== undefined) {
    return invalid('A profile update cannot mark resonance or step status.')
  }
  const proposed: ProfileUpdatePatch = {}
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
  if (input.beliefs !== undefined) {
    const beliefs = parseModularProfile(input.beliefs)
    if (beliefs === null) {
      return invalid(
        'beliefs must be self-supplied modular values. Birth data, accounts, and inferred fields are not allowed.',
      )
    }
    proposed.beliefs = beliefs
  }

  if (Object.keys(proposed).length === 0) {
    return invalid(
      'Propose at least one of displayName, focusIntention, tone, or beliefs.',
    )
  }

  return resolveGate(state, optionalString(input.confirmationId), {
    kind: 'profile_update',
    summary: profileUpdateSummary(proposed),
    payload: { kind: 'profile_update', proposed },
    onApproved: (current) =>
      current.confirmation.status === 'approved' &&
      current.confirmation.payload.kind === 'profile_update'
        ? current.confirmation.payload.proposed
        : {},
  })
}

function getResearchBrief(
  state: AppState,
  input: Record<string, unknown>,
): ToolRun {
  if (state.profile.focusIntention.trim().length === 0) {
    return {
      result: {
        ok: false,
        code: 'focus_required',
        message: 'A focus intention is required before a research brief exists.',
      },
      actions: [],
    }
  }
  if (!hasBeliefModule(state.profile.beliefs)) {
    return {
      result: {
        ok: false,
        code: 'no_brief',
        message: 'At least one belief-system module is required for a research brief.',
      },
      actions: [],
    }
  }

  const brief = buildExactBrief({
    horizon: state.horizon,
    focus: state.profile.focusIntention,
    tone: state.profile.tone,
    beliefs: state.profile.beliefs,
  })
  if (brief === null) {
    return {
      result: {
        ok: false,
        code: 'no_brief',
        message: 'A research brief is not available for this profile.',
      },
      actions: [],
    }
  }

  const fields = briefAccessFields(state.profile)
  const snapshot = briefConsentSnapshot(brief)
  const payload: Extract<ConfirmationPayload, { kind: 'research_brief' }> = {
    kind: 'research_brief',
    horizon: brief.horizon,
    briefDigest: briefDigest(brief),
    fields,
    snapshot,
  }
  return resolveGate(state, optionalString(input.confirmationId), {
    kind: 'research_brief',
    summary:
      'An agent wants the exact research brief, which includes your focus, tone, and the self-supplied belief fields already on this page. You can deny this.',
    payload,
    onApproved: (current) => {
      if (
        current.confirmation.status !== 'approved' ||
        current.confirmation.payload.kind !== 'research_brief'
      ) {
        return {
          stale: true,
          message:
            'Your profile changed after this request. Ask again to see the current brief.',
        }
      }
      const approved = current.confirmation.payload
      const live = buildExactBrief({
        horizon: current.horizon,
        focus: current.profile.focusIntention,
        tone: current.profile.tone,
        beliefs: current.profile.beliefs,
      })
      if (live === null || briefDigest(live) !== approved.briefDigest) {
        return {
          stale: true,
          message:
            'Your profile changed after this request. Ask again to see the current brief.',
        }
      }
      return {
        horizon: approved.horizon,
        focus: approved.snapshot.focus,
        tone: approved.snapshot.tone,
        requestedLenses: approved.snapshot.requestedLenses,
        skippedLenses: live.skippedLenses,
        beliefs: live.beliefs,
        caps: {
          maxSources: PACKET_BOUNDS.maxSources,
          maxSections: PACKET_BOUNDS.maxSections,
        },
        exhaustive: false,
      }
    },
  })
}

function submitReadingPacket(
  state: AppState,
  input: Record<string, unknown>,
): ToolRun {
  const op = input.op
  if (!isPacketOp(op)) {
    return invalid(
      'op must be begin, append_sources, append_content, finalize, or cancel.',
    )
  }

  const actions: ToolAction[] = []
  switch (op) {
    case 'begin': {
      let horizon = state.horizon
      if (input.horizon !== undefined) {
        if (!isHorizon(input.horizon)) {
          return invalid('horizon must be daily, weekly, or yearly.')
        }
        horizon = input.horizon
      }
      actions.push({ type: 'INTAKE_BEGIN', horizon })
      break
    }
    case 'append_sources': {
      if (!Array.isArray(input.sources)) {
        return invalid('append_sources needs a sources array.')
      }
      actions.push({ type: 'INTAKE_APPEND_SOURCES', sources: input.sources })
      break
    }
    case 'append_content': {
      if (!Array.isArray(input.content)) {
        return invalid('append_content needs a content array.')
      }
      actions.push({ type: 'INTAKE_APPEND_SECTIONS', sections: input.content })
      break
    }
    case 'finalize':
      actions.push({ type: 'INTAKE_FINALIZE' })
      break
    case 'cancel':
      actions.push({ type: 'INTAKE_CANCEL' })
      break
    default: {
      const _exhaustive: never = op
      return _exhaustive
    }
  }

  const next = actions.reduce(appReducer, state)
  const view = packetView(next)
  if (next.intake.status === 'rejected') {
    return {
      result: {
        ok: false,
        code: 'invalid_input',
        message: next.intake.reason,
      },
      actions,
    }
  }
  return {
    result: { ok: true, data: view },
    actions,
  }
}

function proposeChoicePlan(
  state: AppState,
  input: Record<string, unknown>,
): ToolRun {
  if (
    input.status !== undefined ||
    input.mark !== undefined ||
    input.resonance !== undefined ||
    input.persist !== undefined ||
    input.export !== undefined
  ) {
    return invalid(
      'An agent cannot mark resonance, accept or dismiss steps, persist, export, or erase.',
    )
  }
  const plan = currentPlan(state)
  if (plan === null) {
    return {
      result: {
        ok: false,
        code: 'no_plan',
        message: 'No choice plan is in memory yet. The person creates the plan on the page.',
      },
      actions: [],
    }
  }
  if (!Array.isArray(input.titles) || input.titles.length === 0) {
    return invalid('propose_choice_plan needs a non-empty titles array.')
  }
  if (input.titles.length > PLAN_BOUNDS.maxProposedTitles) {
    return invalid(
      `propose_choice_plan accepts at most ${PLAN_BOUNDS.maxProposedTitles} titles.`,
    )
  }
  const titles: string[] = []
  for (const title of input.titles) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      return invalid('Each proposed title must be a non-empty string.')
    }
    const trimmed = title.trim()
    if (trimmed.length > PLAN_BOUNDS.maxTitleLength) {
      return invalid(
        `Each proposed title must be at most ${PLAN_BOUNDS.maxTitleLength} characters.`,
      )
    }
    titles.push(trimmed)
  }
  const remaining = PLAN_BOUNDS.maxStepsPerPlan - plan.steps.length
  if (remaining <= 0) {
    return invalid(`The plan already has ${PLAN_BOUNDS.maxStepsPerPlan} steps.`)
  }
  const accepted = titles.slice(0, remaining)
  const actions: ToolAction[] = accepted.map((title) => ({
    type: 'ADD_CUSTOM_STEP',
    stepId: createCustomStepId(),
    title,
    userNote: '',
  }))
  return {
    result: {
      ok: true,
      data: { proposed: accepted, status: 'proposed' as const },
    },
    actions,
  }
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

  return resolveGate(state, optionalString(input.confirmationId), {
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

function inspectReading(state: AppState) {
  const now = mustInstant(Date.now())
  const adopted = currentReading(state)
  if (adopted !== null) {
    return {
      status: 'adopted' as const,
      horizon: adopted.horizon,
      digest: adopted.packetDigest,
      coverage: {
        sourcesConsidered: adopted.coverage.sourcesConsidered,
        sourcesUsed: adopted.coverage.sourcesUsed,
        stoppingReason: adopted.coverage.stoppingReason,
        exhaustive: false,
      },
      supported: adopted.sections.map((section) => section.id),
      skipped: adopted.skippedLenses.map((item) => item.lens),
      evidence: adopted.sources.map((source) => ({
        id: source.id,
        title: source.title,
        domain: source.domain,
      })),
      sections: adopted.sections.map((section) => ({
        id: section.id,
        title: section.title,
      })),
    }
  }

  const staged = state.desk.staged
  if (staged !== null) {
    const expired = isStagedExpired(staged, now)
    return {
      status: expired ? ('expired' as const) : ('staged' as const),
      horizon: staged.packet.horizon,
      digest: staged.digest,
      coverage: {
        sourcesConsidered: staged.packet.sources.length,
        sourcesUsed: staged.packet.sources.length,
        stoppingReason:
          'This packet is staged for review. It is not adopted and is not an exhaustive search.',
        exhaustive: false,
      },
      supported: staged.packet.sections.map((section) => section.id),
      skipped: [],
      evidence: staged.packet.sources.map((source) => ({
        id: source.id,
        title: source.title,
        domain: source.domain,
      })),
      sections: staged.packet.sections.map((section) => ({
        id: section.id,
        title: section.title,
      })),
    }
  }

  const fixture = currentForecast(state)
  if (fixture !== null) {
    return {
      status: 'legacy_fixture' as const,
      horizon: fixture.horizon,
      digest: null,
      coverage: {
        sourcesConsidered: fixture.coverage.sourcesConsidered,
        sourcesUsed: fixture.coverage.sourcesUsed,
        stoppingReason: fixture.coverage.stoppingReason,
        exhaustive: false,
      },
      supported: fixture.sections.map((section) => section.id),
      skipped: [],
      evidence: fixture.evidence.map((item) => ({
        id: item.id,
        title: item.label,
        domain: null,
      })),
      sections: fixture.sections.map((section) => ({
        id: section.id,
        title: section.title,
      })),
    }
  }

  return {
    status: 'empty' as const,
    horizon: state.horizon,
    digest: null,
    coverage: null,
    supported: [],
    skipped: [],
    evidence: [],
    sections: [],
    fallback: 'manual_import',
  }
}

function packetView(state: AppState) {
  const progress = intakeProgress(state.intake)
  if (state.intake.status === 'ready') {
    return {
      status: state.intake.status,
      adopted: false,
      digest: state.intake.review.digest,
      untrustedAsData: state.intake.review.untrustedAsData,
      skipped: state.intake.review.skipped,
      progress,
    }
  }
  if (state.intake.status === 'adopted') {
    return {
      status: state.intake.status,
      adopted: true,
      digest: state.intake.digest,
      progress,
    }
  }
  if (state.intake.status === 'rejected') {
    return {
      status: state.intake.status,
      adopted: false,
      code: state.intake.code,
      reason: state.intake.reason,
      progress,
    }
  }
  return {
    status: state.intake.status,
    adopted: false,
    progress,
  }
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
  const expectedId = confirmationIdForPayload(spec.payload)
  const current = state.confirmation
  const presentedId =
    confirmationId !== undefined &&
    current.status !== 'idle' &&
    current.id === confirmationId
      ? current.id
      : confirmationId === expectedId
        ? expectedId
        : undefined

  if (confirmationId !== undefined && presentedId === undefined) {
    if (spec.kind === 'research_brief') {
      return {
        result: {
          ok: false,
          code: 'stale_confirmation',
          message:
            'Your profile changed after this request. Ask again to see the current brief.',
        },
        actions: [],
      }
    }
    return {
      result: {
        ok: false,
        code: 'unknown_confirmation',
        message: 'That confirmation id does not match this request.',
      },
      actions: [],
    }
  }

  if (presentedId !== undefined) {
    if (current.status !== 'idle' && current.kind !== spec.kind) {
      return {
        result: {
          ok: false,
          code: 'unknown_confirmation',
          message: 'That confirmation id does not match this request.',
        },
        actions: [],
      }
    }
    const ticket = state.desk.ticket
    const now = mustInstant(Date.now())
    if (
      (ticket.status === 'pending' || ticket.status === 'approved') &&
      ticket.id === presentedId &&
      isTicketExpired(ticket, now)
    ) {
      return {
        result: {
          ok: false,
          code: 'stale_confirmation',
          message: 'This confirmation expired. Ask again.',
        },
        actions: [{ type: 'CONSUME_CONFIRMATION', id: presentedId }],
      }
    }
    if (current.status === 'approved' && current.id === presentedId) {
      const data = spec.onApproved(state)
      if (isStaleApproved(data)) {
        return {
          result: {
            ok: false,
            code: 'stale_confirmation',
            message: data.message,
          },
          actions: [{ type: 'CONSUME_CONFIRMATION', id: presentedId }],
        }
      }
      return {
        result: { ok: true, data },
        actions: [{ type: 'CONSUME_CONFIRMATION', id: presentedId }],
      }
    }
    if (current.status === 'denied' && current.id === presentedId) {
      return {
        result: {
          ok: false,
          code: 'denied',
          message: 'The person denied this confirmation.',
          confirmationId: presentedId,
          kind: spec.kind,
        },
        actions: [{ type: 'CONSUME_CONFIRMATION', id: presentedId }],
      }
    }
    if (current.status === 'pending' && current.id === presentedId) {
      return {
        result: {
          ok: false,
          code: 'needs_confirmation',
          message: current.summary,
          confirmationId: presentedId,
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
    if (current.id !== expectedId) {
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
        now: mustInstant(Date.now()),
      },
    ],
  }
}

function projectProfile(
  profile: PersonProfile,
  fields: readonly ProfileAccessField[],
): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const field of fields) {
    switch (field) {
      case 'displayName':
        data.displayName = profile.displayName
        break
      case 'focusIntention':
        data.focusIntention = profile.focusIntention
        break
      case 'tone':
        data.tone = profile.tone
        break
      case 'beliefs.western':
        if (profile.beliefs.western !== undefined) {
          data.beliefs = {
            ...(asRecord(data.beliefs) ?? {}),
            western: profile.beliefs.western,
          }
        }
        break
      case 'beliefs.numerology':
        if (profile.beliefs.numerology !== undefined) {
          data.beliefs = {
            ...(asRecord(data.beliefs) ?? {}),
            numerology: profile.beliefs.numerology,
          }
        }
        break
      case 'beliefs.chinese':
        if (profile.beliefs.chinese !== undefined) {
          data.beliefs = {
            ...(asRecord(data.beliefs) ?? {}),
            chinese: profile.beliefs.chinese,
          }
        }
        break
      case 'beliefs.bazi':
        if (profile.beliefs.bazi !== undefined) {
          data.beliefs = {
            ...(asRecord(data.beliefs) ?? {}),
            bazi: profile.beliefs.bazi,
          }
        }
        break
      case 'beliefs.humanDesign':
        if (profile.beliefs.humanDesign !== undefined) {
          data.beliefs = {
            ...(asRecord(data.beliefs) ?? {}),
            humanDesign: profile.beliefs.humanDesign,
          }
        }
        break
      default: {
        const _exhaustive: never = field
        return _exhaustive
      }
    }
  }
  return data
}

function briefAccessFields(profile: PersonProfile): ProfileAccessField[] {
  const fields: ProfileAccessField[] = ['focusIntention', 'tone']
  if (profile.beliefs.western !== undefined) {
    fields.push('beliefs.western')
  }
  if (profile.beliefs.numerology !== undefined) {
    fields.push('beliefs.numerology')
  }
  if (profile.beliefs.chinese !== undefined) {
    fields.push('beliefs.chinese')
  }
  if (profile.beliefs.bazi !== undefined) {
    fields.push('beliefs.bazi')
  }
  if (profile.beliefs.humanDesign !== undefined) {
    fields.push('beliefs.humanDesign')
  }
  return fields
}

function parseAccessFields(value: unknown): ProfileAccessField[] | null {
  if (value === undefined) {
    return [...DEFAULT_PROFILE_ACCESS_FIELDS]
  }
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }
  const parsed: ProfileAccessField[] = []
  for (const item of value) {
    if (!isAccessField(item)) {
      return null
    }
    if (!parsed.includes(item)) {
      parsed.push(item)
    }
  }
  return parsed
}

function profileUpdateSummary(proposed: ProfileUpdatePatch): string {
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
  if (proposed.beliefs !== undefined) {
    fields.push('belief-system fields')
  }
  return `An agent wants to change ${fields.join(' and ')}. The exact diff is on this page only.`
}

function invalid(message: string): ToolRun {
  return {
    result: { ok: false, code: 'invalid_input', message },
    actions: [],
  }
}

function isStaleApproved(
  value: unknown,
): value is { stale: true; message: string } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  if (!('stale' in value) || !('message' in value)) {
    return false
  }
  return value.stale === true && typeof value.message === 'string'
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function isTone(value: unknown): value is PersonProfile['tone'] {
  return (TONES as readonly unknown[]).includes(value)
}

function isHorizon(value: unknown): value is HorizonId {
  return (HORIZONS as readonly unknown[]).includes(value)
}

function isPacketOp(
  value: unknown,
): value is (typeof PACKET_OPS)[number] {
  return (PACKET_OPS as readonly unknown[]).includes(value)
}

function isAccessField(value: unknown): value is ProfileAccessField {
  return (PROFILE_ACCESS_FIELDS as readonly unknown[]).includes(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}
