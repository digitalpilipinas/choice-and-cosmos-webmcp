import { describe, expect, it } from 'vitest'
import { STAGED_TTL_MS, mustInstant } from '../../src/domain/brand.ts'
import { PLAN_BOUNDS } from '../../src/domain/bounds.ts'
import {
  INITIAL_STATE,
  appReducer,
  confirmationIdForPayload,
} from '../../src/domain/loop.ts'
import {
  EMPTY_DESK,
  adoptStagedPacket,
  approveTicket,
  issueConfirmation,
  packetDigest,
  stagePacket,
} from '../../src/domain/trust.ts'
import { parseStoredSession } from '../../src/persistence/sessionStore.ts'
import { parseReadingPacketV1 } from '../../src/research/packet.ts'
import { TOOL_CATALOG } from '../../src/webmcp/catalog.ts'
import { profileAccessPayload, runTool } from '../../src/webmcp/tools.ts'
import { SAMPLE_PACKET } from '../research/samplePacket.ts'
import type { AppState } from '../../src/domain/types.ts'

const PERSONAL_DATA_PAYLOAD = profileAccessPayload()
const PERSONAL_DATA_ID = confirmationIdForPayload(PERSONAL_DATA_PAYLOAD)

const WESTERN_PACKET = {
  ...SAMPLE_PACKET,
  sections: [
    {
      id: 'westernAstrology' as const,
      title: 'Western',
      frameworkLabel: 'Guide',
      reflection: 'Sit with leo.',
      evidenceIds: ['ev_sun_1'],
    },
  ],
}

function withFocus(focus = 'finish the draft'): AppState {
  return appReducer(INITIAL_STATE, {
    type: 'SET_PROFILE_FIELD',
    field: 'focusIntention',
    value: focus,
  })
}

function withBeliefs(focus = 'finish the draft'): AppState {
  return appReducer(withFocus(focus), {
    type: 'SET_BELIEFS',
    beliefs: { western: { sun: 'leo' } },
  })
}

function withForecast(): AppState {
  return appReducer(withFocus(), { type: 'GENERATE_FORECAST' })
}

function apply(state: AppState, name: string, input: Record<string, unknown> = {}) {
  const run = runTool(state, name, input)
  return {
    result: run.result,
    state: run.actions.reduce(appReducer, state),
  }
}

function westernArtifact() {
  const parsed = parseReadingPacketV1(WESTERN_PACKET)
  if (parsed === null) {
    throw new Error('expected western packet')
  }
  const now = mustInstant(1_000)
  const staged = stagePacket(EMPTY_DESK, parsed, { now })
  if (staged === null) {
    throw new Error('expected staged western packet')
  }
  const payload = {
    kind: 'adopt_reading' as const,
    packetDigest: packetDigest(parsed),
    horizon: 'daily' as const,
  }
  const issued = issueConfirmation(staged, { payload, summary: 'adopt', now })
  if (issued === null || issued.desk.ticket.status !== 'pending') {
    throw new Error('expected pending adopt')
  }
  const approved = approveTicket(issued.desk, issued.desk.ticket.id, now)
  if (approved === null) {
    throw new Error('expected approve')
  }
  const result = adoptStagedPacket(approved, {
    confirmationId: issued.desk.ticket.id,
    now,
    beliefs: { western: { sun: 'leo' } },
  })
  if (result === null) {
    throw new Error('expected western artifact')
  }
  return result.artifact
}

describe('T030 confirmation kind and expiry', () => {
  it('refuses to approve an expired pending ticket', () => {
    const now = mustInstant(1_000)
    const issued = issueConfirmation(EMPTY_DESK, {
      payload: PERSONAL_DATA_PAYLOAD,
      summary: 'read profile',
      now,
    })
    if (issued === null || issued.desk.ticket.status !== 'pending') {
      throw new Error('expected pending ticket')
    }
    expect(
      approveTicket(
        issued.desk,
        issued.desk.ticket.id,
        mustInstant(now + STAGED_TTL_MS),
      ),
    ).toBeNull()
    expect(approveTicket(issued.desk, issued.desk.ticket.id, now)).not.toBeNull()
  })

  it('does not let an approved personal_data_access ticket unlock the research brief', () => {
    const first = apply(withBeliefs(), 'request_profile_access')
    if (first.result.ok || first.result.confirmationId === undefined) {
      throw new Error('expected a pending profile gate')
    }
    const approved = appReducer(first.state, {
      type: 'APPROVE_CONFIRMATION',
      id: first.result.confirmationId,
    })
    const stolen = apply(approved, 'get_research_brief', {
      confirmationId: first.result.confirmationId,
    })
    expect(stolen.result).toMatchObject({
      ok: false,
      code: 'unknown_confirmation',
    })
    expect(JSON.stringify(stolen.result)).not.toContain('finish the draft')
    expect(stolen.state.confirmation.status).toBe('approved')
  })

  it('rejects an expired approved ticket at gated execution', () => {
    const ancient = mustInstant(1)
    let state = appReducer(withFocus(), {
      type: 'REQUEST_CONFIRMATION',
      kind: 'personal_data_access',
      summary: 'read the profile',
      payload: PERSONAL_DATA_PAYLOAD,
      now: ancient,
    })
    state = appReducer(state, {
      type: 'APPROVE_CONFIRMATION',
      id: PERSONAL_DATA_ID,
      now: ancient,
    })
    expect(state.confirmation.status).toBe('approved')
    const replay = apply(state, 'request_profile_access', {
      confirmationId: PERSONAL_DATA_ID,
    })
    expect(replay.result).toMatchObject({
      ok: false,
      code: 'stale_confirmation',
    })
  })
})

describe('T030 belief revalidation and hydration', () => {
  it('clears a staged packet whose sections no longer match the selected beliefs', () => {
    const now = mustInstant(2_000)
    let state = appReducer(withBeliefs(), {
      type: 'INTAKE_IMPORT_JSON',
      text: JSON.stringify(WESTERN_PACKET),
      now,
    })
    expect(state.desk.staged).not.toBeNull()
    expect(state.intake.status).toBe('ready')
    state = appReducer(state, {
      type: 'SET_BELIEFS',
      beliefs: { chinese: { animal: 'horse' } },
    })
    expect(state.desk.staged).toBeNull()
    expect(state.intake.status).toBe('idle')
  })

  it('omits a persisted artifact whose sections are incompatible with stored beliefs', () => {
    const artifact = westernArtifact()
    const session = {
      schemaVersion: 3 as const,
      savedAt: '2026-08-26T12:00:00.000Z',
      phase: 'choice' as const,
      horizon: 'daily' as const,
      profile: {
        displayName: 'You',
        focusIntention: 'name the season',
        tone: 'bold' as const,
        beliefs: {},
      },
      forecastsByHorizon: { daily: null, weekly: null, yearly: null },
      readingsByHorizon: {
        daily: artifact,
        weekly: null,
        yearly: null,
      },
      resonanceByHorizon: { daily: null, weekly: null, yearly: null },
      plansByHorizon: { daily: null, weekly: null, yearly: null },
    }
    const parsed = parseStoredSession(session)
    expect(parsed).not.toBeNull()
    expect(parsed?.readingsByHorizon.daily).toBeNull()
  })
})

describe('T030 plan bounds and inspect trust', () => {
  it('returns an invalid result instead of a successful overflow proposal', () => {
    let state = withForecast()
    const plan = state.plansByHorizon.daily
    if (plan === null) {
      throw new Error('expected a plan')
    }
    for (let index = plan.steps.length; index < PLAN_BOUNDS.maxStepsPerPlan; index += 1) {
      state = appReducer(state, {
        type: 'ADD_CUSTOM_STEP',
        stepId: `custom-fill-${index}`,
        title: `fill ${index}`,
        userNote: '',
      })
    }
    const overflow = apply(state, 'propose_choice_plan', { titles: ['one more'] })
    expect(overflow.result).toMatchObject({ ok: false, code: 'invalid_input' })
    expect(overflow.state.plansByHorizon.daily?.steps.length).toBe(
      PLAN_BOUNDS.maxStepsPerPlan,
    )
    expect(
      overflow.state.plansByHorizon.daily?.steps.some((step) => step.title === 'one more'),
    ).toBe(false)
  })

  it('clips personal notes to PLAN_BOUNDS.maxUserNoteLength', () => {
    let state = withForecast()
    const stepId = state.plansByHorizon.daily?.steps[0]?.id
    if (stepId === undefined) {
      throw new Error('expected a fixture step')
    }
    state = appReducer(state, {
      type: 'SET_STEP_NOTE',
      stepId,
      userNote: 'n'.repeat(PLAN_BOUNDS.maxUserNoteLength + 40),
    })
    expect(state.plansByHorizon.daily?.steps[0]?.userNote).toHaveLength(
      PLAN_BOUNDS.maxUserNoteLength,
    )
  })

  it('marks inspect_reading as untrusted content', () => {
    const inspect = TOOL_CATALOG.find((tool) => tool.name === 'inspect_reading')
    expect(inspect?.untrustedContentHint).toBe(true)
  })
})
