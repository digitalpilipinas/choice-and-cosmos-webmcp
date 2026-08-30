import { describe, expect, it } from 'vitest'
import {
  appReducer,
  confirmationIdForPayload,
  INITIAL_STATE,
} from '../../src/domain/loop.ts'
import type { AppState } from '../../src/domain/types.ts'
import { profileAccessPayload, runTool } from '../../src/webmcp/tools.ts'
import { SAMPLE_PACKET } from '../research/samplePacket.ts'

const PERSONAL_DATA_ID = confirmationIdForPayload(profileAccessPayload())

function apply(state: AppState, name: string, input: Record<string, unknown> = {}) {
  const run = runTool(state, name, input)
  return {
    result: run.result,
    state: run.actions.reduce(appReducer, state),
  }
}

function withFocus(focus = 'finish the draft'): AppState {
  return appReducer(INITIAL_STATE, {
    type: 'SET_PROFILE_FIELD',
    field: 'focusIntention',
    value: focus,
  })
}

function withBeliefs(): AppState {
  return appReducer(withFocus(), {
    type: 'SET_BELIEFS',
    beliefs: { western: { sun: 'leo' } },
  })
}

describe('WebMCP argument, consent, and fallback errors', () => {
  it('rejects an unknown tool name without mutating session text', () => {
    const state = withFocus('secret worry')
    const { result, state: nextState } = apply(state, 'not_a_tool')
    expect(result).toMatchObject({ ok: false, code: 'invalid_input' })
    expect(JSON.stringify(result)).not.toContain('secret worry')
    expect(nextState).toEqual(state)
  })

  it('rejects a bad packet op without mutating intake', () => {
    const state = withBeliefs()
    const { result, state: nextState } = apply(state, 'submit_reading_packet', {
      op: 'adopt',
    })
    expect(result).toMatchObject({ ok: false, code: 'invalid_input' })
    expect(nextState.intake.status).toBe('idle')
  })

  it('returns no_brief and no_plan when the page is empty', () => {
    expect(apply(INITIAL_STATE, 'get_research_brief').result).toMatchObject({
      ok: false,
      code: 'focus_required',
    })
    expect(apply(withFocus(), 'get_research_brief').result).toMatchObject({
      ok: false,
      code: 'no_brief',
    })
    expect(apply(INITIAL_STATE, 'propose_choice_plan', { titles: ['one'] }).result)
      .toMatchObject({ ok: false, code: 'no_plan' })
    expect(apply(INITIAL_STATE, 'request_plan_save').result).toMatchObject({
      ok: false,
      code: 'no_plan',
    })
  })

  it('returns unavailable when local saving cannot run', () => {
    const withPlan = appReducer(withFocus(), { type: 'GENERATE_FORECAST' })
    const blocked: AppState = {
      ...withPlan,
      persistence: { kind: 'unavailable', reason: 'IndexedDB is blocked in this test.' },
    }
    expect(apply(blocked, 'request_plan_save').result).toMatchObject({
      ok: false,
      code: 'unavailable',
    })
  })

  it('returns confirmation_busy when a second gated tool arrives', () => {
    const first = apply(INITIAL_STATE, 'request_profile_access')
    expect(first.result).toMatchObject({ ok: false, code: 'needs_confirmation' })
    const second = apply(first.state, 'propose_profile_update', { tone: 'bold' })
    expect(second.result).toMatchObject({
      ok: false,
      code: 'confirmation_busy',
    })
  })

  it('returns confirmation_busy while an approved slot is still unconsumed', () => {
    const first = apply(INITIAL_STATE, 'request_profile_access')
    const approved = appReducer(first.state, {
      type: 'APPROVE_CONFIRMATION',
      id: PERSONAL_DATA_ID,
    })
    const second = apply(approved, 'propose_profile_update', { tone: 'bold' })
    expect(second.result).toMatchObject({
      ok: false,
      code: 'confirmation_busy',
      kind: 'personal_data_access',
    })
    expect(second.state.confirmation).toMatchObject({
      status: 'approved',
      kind: 'personal_data_access',
    })
  })

  it('honors deny and does not leak the focus text', () => {
    const focused = withFocus('keep this private')
    const gated = apply(focused, 'request_profile_access')
    const deniedState = appReducer(gated.state, {
      type: 'DENY_CONFIRMATION',
      id: PERSONAL_DATA_ID,
    })
    const replay = apply(deniedState, 'request_profile_access', {
      confirmationId: PERSONAL_DATA_ID,
    })
    expect(replay.result).toMatchObject({ ok: false, code: 'denied' })
    expect(JSON.stringify(replay.result)).not.toContain('keep this private')
  })

  it('rejects a digest mismatch and a stale replay', () => {
    const first = apply(INITIAL_STATE, 'request_profile_access')
    expect(apply(first.state, 'request_profile_access', {
      confirmationId: 'c1.not-this-digest',
    }).result).toMatchObject({ ok: false, code: 'unknown_confirmation' })

    const approved = appReducer(first.state, {
      type: 'APPROVE_CONFIRMATION',
      id: PERSONAL_DATA_ID,
    })
    const consumed = apply(approved, 'request_profile_access', {
      confirmationId: PERSONAL_DATA_ID,
    })
    expect(consumed.result.ok).toBe(true)
    const replay = apply(consumed.state, 'request_profile_access', {
      confirmationId: PERSONAL_DATA_ID,
    })
    expect(replay.result).toMatchObject({ ok: false, code: 'unknown_confirmation' })
  })

  it('rejects an unsafe source URL through the shared parser', () => {
    const started = apply(withBeliefs(), 'submit_reading_packet', { op: 'begin' })
    const sourced = apply(started.state, 'submit_reading_packet', {
      op: 'append_sources',
      sources: [
        {
          ...SAMPLE_PACKET.sources[0],
          url: 'http://example.com/insecure',
        },
      ],
    })
    const content = apply(sourced.state, 'submit_reading_packet', {
      op: 'append_content',
      content: SAMPLE_PACKET.sections,
    })
    const finalized = apply(content.state, 'submit_reading_packet', {
      op: 'finalize',
    })
    expect(finalized.result).toMatchObject({ ok: false, code: 'invalid_input' })
    expect(finalized.state.desk.staged).toBeNull()
    expect(finalized.state.readingsByHorizon.daily).toBeNull()
  })
})
