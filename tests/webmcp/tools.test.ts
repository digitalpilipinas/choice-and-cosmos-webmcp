import { describe, expect, it } from 'vitest'
import { appReducer, confirmationIdFor, INITIAL_STATE } from '../../src/domain/loop.ts'
import type { AppState } from '../../src/domain/types.ts'
import { TOOL_NAMES } from '../../src/webmcp/catalog.ts'
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

function withForecast(): AppState {
  return appReducer(withFocus(), { type: 'GENERATE_FORECAST' })
}

describe('runTool catalog', () => {
  it('exposes a stable eight-tool contract', () => {
    expect(TOOL_NAMES).toEqual([
      'get_session_status',
      'request_profile_access',
      'propose_profile_update',
      'generate_forecast',
      'inspect_evidence',
      'draft_choice_plan',
      'request_plan_save',
      'request_external_share',
    ])
  })
})

describe('get_session_status', () => {
  it('omits profile text and notes', () => {
    const state = withFocus('a private worry')
    const { result } = apply(state, 'get_session_status')
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('expected status')
    }
    const data = JSON.stringify(result.data)
    expect(data).not.toContain('a private worry')
    expect(result.data).toMatchObject({
      phase: 'context',
      horizon: 'daily',
      hasFocus: true,
      hasForecast: false,
      hasPlan: false,
    })
  })
})

describe('request_profile_access', () => {
  it('rejects a missing confirmation and returns personal data only after approve', () => {
    const focused = withFocus('keep this private')
    const first = apply(focused, 'request_profile_access')
    expect(first.result).toMatchObject({
      ok: false,
      code: 'needs_confirmation',
      confirmationId: confirmationIdFor('personal_data_access'),
    })
    if (first.result.ok) {
      throw new Error('expected a gate')
    }
    expect(JSON.stringify(first.result)).not.toContain('keep this private')

    const denied = apply(
      appReducer(first.state, {
        type: 'DENY_CONFIRMATION',
        id: confirmationIdFor('personal_data_access'),
      }),
      'request_profile_access',
      { confirmationId: confirmationIdFor('personal_data_access') },
    )
    expect(denied.result).toMatchObject({ ok: false, code: 'denied' })
    expect(JSON.stringify(denied.result)).not.toContain('keep this private')

    const approvedState = appReducer(first.state, {
      type: 'APPROVE_CONFIRMATION',
      id: confirmationIdFor('personal_data_access'),
    })
    const approved = apply(approvedState, 'request_profile_access', {
      confirmationId: confirmationIdFor('personal_data_access'),
    })
    expect(approved.result).toEqual({
      ok: true,
      data: {
        displayName: 'You',
        focusIntention: 'keep this private',
        tone: 'grounded',
      },
    })
  })
})

describe('propose_profile_update', () => {
  it('redacts existing profile values from the pre-approval agent result', () => {
    const existing = withFocus('keep this private')
    const first = apply(existing, 'propose_profile_update', {
      tone: 'bold',
      focusIntention: 'a slower question',
    })
    expect(first.result).toMatchObject({
      ok: false,
      code: 'needs_confirmation',
      kind: 'profile_update',
    })
    const dumped = JSON.stringify(first.result)
    expect(dumped).not.toContain('keep this private')
    expect(dumped).not.toContain('grounded')
    expect(dumped).not.toContain('You')
    expect(first.state.confirmation.status).toBe('pending')
    if (first.state.confirmation.status !== 'pending') {
      throw new Error('expected a pending confirmation')
    }
    expect(first.state.confirmation.summary).not.toContain('keep this private')
    expect(first.state.confirmation.payload).toEqual({
      kind: 'profile_update',
      proposed: { tone: 'bold', focusIntention: 'a slower question' },
    })
  })

  it('applies the exact diff only after approval', () => {
    const first = apply(INITIAL_STATE, 'propose_profile_update', {
      tone: 'curious',
      focusIntention: 'a slower question',
    })
    expect(first.result).toMatchObject({
      ok: false,
      code: 'needs_confirmation',
      kind: 'profile_update',
    })
    expect(first.state.profile.tone).toBe('grounded')

    const approved = appReducer(first.state, {
      type: 'APPROVE_CONFIRMATION',
      id: confirmationIdFor('profile_update'),
    })
    expect(approved.profile).toMatchObject({
      tone: 'curious',
      focusIntention: 'a slower question',
    })

    const replay = apply(approved, 'propose_profile_update', {
      tone: 'curious',
      focusIntention: 'a slower question',
      confirmationId: confirmationIdFor('profile_update'),
    })
    expect(replay.result.ok).toBe(true)
    expect(replay.state.confirmation.status).toBe('idle')
  })

  it('returns only the approved profile fields after confirmation', () => {
    const named = appReducer(INITIAL_STATE, {
      type: 'SET_PROFILE_FIELD',
      field: 'displayName',
      value: 'Ada',
    })
    const existing = appReducer(named, {
      type: 'SET_PROFILE_FIELD',
      field: 'focusIntention',
      value: 'keep this private',
    })
    const first = apply(existing, 'propose_profile_update', { tone: 'bold' })
    const approved = appReducer(first.state, {
      type: 'APPROVE_CONFIRMATION',
      id: confirmationIdFor('profile_update'),
    })
    expect(approved.profile).toMatchObject({
      displayName: 'Ada',
      focusIntention: 'keep this private',
      tone: 'bold',
    })
    const replay = apply(approved, 'propose_profile_update', {
      tone: 'bold',
      confirmationId: confirmationIdFor('profile_update'),
    })
    expect(replay.result).toEqual({
      ok: true,
      data: { tone: 'bold' },
    })
    const dumped = JSON.stringify(replay.result)
    expect(dumped).not.toContain('Ada')
    expect(dumped).not.toContain('keep this private')
  })

  it('returns the stored approved patch when replay adds unapproved fields', () => {
    const named = appReducer(INITIAL_STATE, {
      type: 'SET_PROFILE_FIELD',
      field: 'displayName',
      value: 'Ada',
    })
    const existing = appReducer(named, {
      type: 'SET_PROFILE_FIELD',
      field: 'focusIntention',
      value: 'keep this private',
    })
    const first = apply(existing, 'propose_profile_update', { tone: 'bold' })
    const approved = appReducer(first.state, {
      type: 'APPROVE_CONFIRMATION',
      id: confirmationIdFor('profile_update'),
    })
    expect(approved.confirmation).toMatchObject({
      status: 'approved',
      payload: { kind: 'profile_update', proposed: { tone: 'bold' } },
    })

    const replay = apply(approved, 'propose_profile_update', {
      tone: 'bold',
      displayName: 'Ada',
      focusIntention: 'keep this private',
      confirmationId: confirmationIdFor('profile_update'),
    })
    expect(replay.result).toEqual({
      ok: true,
      data: { tone: 'bold' },
    })
    const dumped = JSON.stringify(replay.result)
    expect(dumped).not.toContain('Ada')
    expect(dumped).not.toContain('keep this private')
  })

  it('returns the stored approved patch when replay values do not match the proposal', () => {
    const existing = withFocus('keep this private')
    const first = apply(existing, 'propose_profile_update', { tone: 'bold' })
    const approved = appReducer(first.state, {
      type: 'APPROVE_CONFIRMATION',
      id: confirmationIdFor('profile_update'),
    })
    expect(approved.confirmation).toMatchObject({
      status: 'approved',
      payload: { kind: 'profile_update', proposed: { tone: 'bold' } },
    })

    const replay = apply(approved, 'propose_profile_update', {
      tone: 'curious',
      displayName: 'Ada',
      focusIntention: 'keep this private',
      confirmationId: confirmationIdFor('profile_update'),
    })
    expect(replay.result).toEqual({
      ok: true,
      data: { tone: 'bold' },
    })
    const dumped = JSON.stringify(replay.result)
    expect(dumped).not.toContain('curious')
    expect(dumped).not.toContain('Ada')
    expect(dumped).not.toContain('keep this private')
  })
})

describe('generate_forecast and inspect_evidence', () => {
  it('generates after a focus exists and inspects without personal notes', () => {
    const missing = apply(INITIAL_STATE, 'generate_forecast')
    expect(missing.result).toMatchObject({ ok: false, code: 'focus_required' })

    const generated = apply(withFocus(), 'generate_forecast')
    expect(generated.result).toMatchObject({
      ok: true,
      data: { horizon: 'daily', generated: true },
    })
    const inspected = apply(generated.state, 'inspect_evidence')
    expect(inspected.result.ok).toBe(true)
    if (!inspected.result.ok) {
      throw new Error('expected evidence')
    }
    const payload = JSON.stringify(inspected.result.data)
    expect(payload).not.toContain('finish the draft')
    expect(inspected.result.data).toMatchObject({
      coverage: { mode: 'fixture' },
    })
  })
})

describe('draft_choice_plan and request_plan_save', () => {
  it('drafts without a save, then gates plan save', () => {
    const forecast = withForecast()
    const stepId = forecast.plansByHorizon.daily?.steps[0]?.id
    if (stepId === undefined) {
      throw new Error('expected a fixture step')
    }

    const drafted = apply(forecast, 'draft_choice_plan', {
      action: 'set_status',
      stepId,
      status: 'accepted',
    })
    expect(drafted.result.ok).toBe(true)
    expect(
      drafted.state.plansByHorizon.daily?.steps.find((step) => step.id === stepId)
        ?.status,
    ).toBe('accepted')

    const gated = apply(drafted.state, 'request_plan_save')
    expect(gated.result).toMatchObject({
      ok: false,
      code: 'needs_confirmation',
      kind: 'plan_save',
    })
    expect(gated.state.persistence.kind).toBe('checking')

    const approvedInMemory = appReducer(gated.state, {
      type: 'APPROVE_CONFIRMATION',
      id: confirmationIdFor('plan_save'),
    })
    expect(approvedInMemory.persistence.kind).toBe('checking')
    expect(approvedInMemory.confirmation).toMatchObject({
      status: 'approved',
      sessionPersist: 'unchanged',
    })

    const approvedWithSave = appReducer(gated.state, {
      type: 'APPROVE_CONFIRMATION',
      id: confirmationIdFor('plan_save'),
      persistSession: true,
    })
    expect(approvedWithSave.persistence.kind).toBe('checking')
    expect(approvedWithSave.confirmation).toMatchObject({
      status: 'approved',
      sessionPersist: 'unchanged',
    })
  })

  it('stores the same trimmed add_step title in the result and the plan', () => {
    const { result, state } = apply(withForecast(), 'draft_choice_plan', {
      action: 'add_step',
      title: '  keep one block  ',
    })
    expect(result).toEqual({
      ok: true,
      data: { title: 'keep one block', userNote: '' },
    })
    const custom = state.plansByHorizon.daily?.steps.filter(
      (step) => step.origin === 'custom',
    )
    expect(custom).toEqual([
      expect.objectContaining({
        title: 'keep one block',
        origin: 'custom',
      }),
    ])
  })
})

describe('request_external_share', () => {
  it('records approval and never claims a send', () => {
    const gated = apply(INITIAL_STATE, 'request_external_share', {
      include: ['profile'],
    })
    expect(gated.result).toMatchObject({
      ok: false,
      code: 'needs_confirmation',
      kind: 'external_share',
    })

    const approved = appReducer(gated.state, {
      type: 'APPROVE_CONFIRMATION',
      id: confirmationIdFor('external_share'),
    })
    const replay = apply(approved, 'request_external_share', {
      include: ['profile'],
      confirmationId: confirmationIdFor('external_share'),
    })
    expect(replay.result).toEqual({
      ok: true,
      data: {
        kind: 'approved_not_sent',
        destination: 'gemini-research',
        include: ['profile'],
        reason:
          'Sharing was approved and nothing left this device. Gemini research is not connected in this slice.',
      },
    })
  })
})
