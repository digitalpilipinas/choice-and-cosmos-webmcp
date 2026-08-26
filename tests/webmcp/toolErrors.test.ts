import { describe, expect, it } from 'vitest'
import {
  appReducer,
  confirmationIdFor,
  INITIAL_STATE,
} from '../../src/domain/loop.ts'
import type { AppState } from '../../src/domain/types.ts'
import { runTool } from '../../src/webmcp/tools.ts'

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

describe('WebMCP argument, consent, and fallback errors', () => {
  it('rejects an unknown tool name without mutating session text', () => {
    const state = withFocus('secret worry')
    const { result } = apply(state, 'not_a_tool')
    expect(result).toMatchObject({ ok: false, code: 'invalid_input' })
    expect(JSON.stringify(result)).not.toContain('secret worry')
  })

  it('rejects a bad horizon before generating', () => {
    const { result } = apply(withFocus(), 'generate_forecast', {
      horizon: 'forever',
    })
    expect(result).toMatchObject({ ok: false, code: 'invalid_input' })
  })

  it('returns no_forecast and no_plan when memory is empty', () => {
    expect(apply(INITIAL_STATE, 'inspect_evidence').result).toMatchObject({
      ok: false,
      code: 'no_forecast',
    })
    expect(apply(INITIAL_STATE, 'draft_choice_plan', { action: 'add_step' }).result)
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
    const second = apply(first.state, 'request_external_share')
    expect(second.result).toMatchObject({ ok: false, code: 'confirmation_busy' })
  })

  it('returns confirmation_busy while an approved slot is still unconsumed', () => {
    const first = apply(INITIAL_STATE, 'request_profile_access')
    const approved = appReducer(first.state, {
      type: 'APPROVE_CONFIRMATION',
      id: confirmationIdFor('personal_data_access'),
    })
    const second = apply(approved, 'request_external_share')
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
      id: confirmationIdFor('personal_data_access'),
    })
    const replay = apply(deniedState, 'request_profile_access', {
      confirmationId: confirmationIdFor('personal_data_access'),
    })
    expect(replay.result).toMatchObject({ ok: false, code: 'denied' })
    expect(JSON.stringify(replay.result)).not.toContain('keep this private')
  })

  it('rejects a non-string evidence id', () => {
    const generated = appReducer(withFocus(), { type: 'GENERATE_FORECAST' })
    const { result } = apply(generated, 'inspect_evidence', { evidenceId: 12 })
    expect(result).toMatchObject({ ok: false, code: 'invalid_input' })
  })
})
