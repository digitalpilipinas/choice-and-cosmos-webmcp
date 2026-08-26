import { describe, expect, it } from 'vitest'
import { INITIAL_STATE, appReducer } from '../../src/domain/loop.ts'
import type { StoredSessionV1 } from '../../src/domain/types.ts'

describe('appReducer horizon caches', () => {
  it('starts with null forecast and plan slots for every horizon', () => {
    expect(INITIAL_STATE.forecastsByHorizon).toEqual({
      daily: null,
      weekly: null,
      yearly: null,
    })
    expect(INITIAL_STATE.plansByHorizon).toEqual({
      daily: null,
      weekly: null,
      yearly: null,
    })
  })

  it('GENERATE_FORECAST fills only the current horizon', () => {
    let state = appReducer(INITIAL_STATE, {
      type: 'SET_PROFILE_FIELD',
      field: 'focusIntention',
      value: 'finish the draft',
    })
    state = appReducer(state, { type: 'GENERATE_FORECAST' })

    expect(state.horizon).toBe('daily')
    expect(state.forecastsByHorizon.daily).not.toBeNull()
    expect(state.plansByHorizon.daily).not.toBeNull()
    expect(state.forecastsByHorizon.weekly).toBeNull()
    expect(state.forecastsByHorizon.yearly).toBeNull()
    expect(state.plansByHorizon.weekly).toBeNull()
    expect(state.plansByHorizon.yearly).toBeNull()
  })

  it('keeps a cached horizon when generating for another', () => {
    let state = appReducer(INITIAL_STATE, {
      type: 'SET_PROFILE_FIELD',
      field: 'focusIntention',
      value: 'finish the draft',
    })
    state = appReducer(state, { type: 'GENERATE_FORECAST' })
    const dailyForecast = state.forecastsByHorizon.daily
    const dailyPlan = state.plansByHorizon.daily

    state = appReducer(state, { type: 'SET_HORIZON', horizon: 'weekly' })
    state = appReducer(state, { type: 'GENERATE_FORECAST' })

    expect(state.forecastsByHorizon.daily).toBe(dailyForecast)
    expect(state.plansByHorizon.daily).toBe(dailyPlan)
    expect(state.forecastsByHorizon.weekly).not.toBeNull()
    expect(state.plansByHorizon.weekly).not.toBeNull()
    expect(state.forecastsByHorizon.yearly).toBeNull()
    expect(state.plansByHorizon.yearly).toBeNull()
  })
})

describe('custom choice steps', () => {
  it('appends custom steps and only removes custom-origin ones', () => {
    let state = appReducer(INITIAL_STATE, {
      type: 'SET_PROFILE_FIELD',
      field: 'focusIntention',
      value: 'finish the draft',
    })
    state = appReducer(state, { type: 'GENERATE_FORECAST' })

    const fixtureSteps = state.plansByHorizon.daily?.steps ?? []
    expect(fixtureSteps.length).toBeGreaterThan(0)
    const fixtureId = fixtureSteps[0]?.id
    expect(fixtureId).toEqual(expect.any(String))

    state = appReducer(state, {
      type: 'ADD_CUSTOM_STEP',
      stepId: 'custom-walk',
      title: '  walk the block  ',
      userNote: '  if it still fits  ',
    })

    const withCustom = state.plansByHorizon.daily?.steps ?? []
    const custom = withCustom.find((step) => step.origin === 'custom')
    expect(custom).toMatchObject({
      id: 'custom-walk',
      title: 'walk the block',
      rationale: '',
      status: 'proposed',
      userNote: 'if it still fits',
      origin: 'custom',
    })
    expect(custom?.id.startsWith('custom-')).toBe(true)

    if (fixtureId === undefined || custom === undefined) {
      throw new Error('expected fixture and custom steps')
    }

    const afterFixtureRemove = appReducer(state, {
      type: 'REMOVE_CUSTOM_STEP',
      stepId: fixtureId,
    })
    expect(afterFixtureRemove.plansByHorizon.daily?.steps.map((step) => step.id)).toEqual(
      withCustom.map((step) => step.id),
    )

    const afterCustomRemove = appReducer(state, {
      type: 'REMOVE_CUSTOM_STEP',
      stepId: custom.id,
    })
    expect(
      afterCustomRemove.plansByHorizon.daily?.steps.some((step) => step.id === custom.id),
    ).toBe(false)
    expect(
      afterCustomRemove.plansByHorizon.daily?.steps.some((step) => step.id === fixtureId),
    ).toBe(true)
  })

  it('resets fixture steps on regenerate but keeps custom steps as-is', () => {
    let state = appReducer(INITIAL_STATE, {
      type: 'SET_PROFILE_FIELD',
      field: 'focusIntention',
      value: 'finish the draft',
    })
    state = appReducer(state, { type: 'GENERATE_FORECAST' })

    const fixtureId = state.plansByHorizon.daily?.steps[0]?.id
    if (fixtureId === undefined) {
      throw new Error('expected a fixture step')
    }

    state = appReducer(state, {
      type: 'SET_STEP_STATUS',
      stepId: fixtureId,
      status: 'accepted',
    })
    state = appReducer(state, {
      type: 'ADD_CUSTOM_STEP',
      stepId: 'custom-letter',
      title: 'write the letter',
      userNote: 'keep this',
    })

    const customId = state.plansByHorizon.daily?.steps.find(
      (step) => step.origin === 'custom',
    )?.id
    if (customId === undefined) {
      throw new Error('expected a custom step')
    }

    state = appReducer(state, {
      type: 'SET_STEP_STATUS',
      stepId: customId,
      status: 'dismissed',
    })
    state = appReducer(state, {
      type: 'SET_STEP_NOTE',
      stepId: customId,
      userNote: 'still mine',
    })

    state = appReducer(state, { type: 'GENERATE_FORECAST' })

    const steps = state.plansByHorizon.daily?.steps ?? []
    const fixtureSteps = steps.filter((step) => step.origin === 'fixture')
    const customSteps = steps.filter((step) => step.origin === 'custom')

    expect(fixtureSteps.length).toBeGreaterThan(0)
    expect(fixtureSteps.every((step) => step.status === 'proposed')).toBe(true)
    expect(customSteps).toHaveLength(1)
    expect(customSteps[0]).toMatchObject({
      id: customId,
      title: 'write the letter',
      status: 'dismissed',
      userNote: 'still mine',
      origin: 'custom',
    })
  })

  it('keeps fixture status and notes when Context ADVANCE reopens an existing horizon', () => {
    let state = appReducer(INITIAL_STATE, {
      type: 'SET_PROFILE_FIELD',
      field: 'focusIntention',
      value: 'finish the draft',
    })
    state = appReducer(state, { type: 'ADVANCE' })

    const fixture = state.plansByHorizon.daily?.steps.find(
      (step) => step.title === 'Name the next honest hour',
    )
    if (fixture === undefined) {
      throw new Error('expected the daily fixture step')
    }

    state = appReducer(state, {
      type: 'SET_STEP_STATUS',
      stepId: fixture.id,
      status: 'accepted',
    })
    state = appReducer(state, {
      type: 'SET_STEP_NOTE',
      stepId: fixture.id,
      userNote: 'keep this accept',
    })
    state = appReducer(state, {
      type: 'ADD_CUSTOM_STEP',
      stepId: 'custom-opening',
      title: 'Review the opening',
      userNote: 'after lunch',
    })

    state = appReducer(state, { type: 'BACK' })
    state = appReducer(state, { type: 'SET_HORIZON', horizon: 'weekly' })
    state = appReducer(state, { type: 'ADVANCE' })
    state = appReducer(state, { type: 'BACK' })
    state = appReducer(state, { type: 'SET_HORIZON', horizon: 'daily' })
    state = appReducer(state, { type: 'ADVANCE' })

    const steps = state.plansByHorizon.daily?.steps ?? []
    const reopened = steps.find((step) => step.id === fixture.id)
    const custom = steps.find((step) => step.title === 'Review the opening')

    expect(reopened).toMatchObject({
      id: fixture.id,
      origin: 'fixture',
      status: 'accepted',
      userNote: 'keep this accept',
    })
    expect(custom).toMatchObject({
      title: 'Review the opening',
      origin: 'custom',
      userNote: 'after lunch',
    })
  })
})

describe('persistence reducer cases', () => {
  it('CLEAR_SAVED_DATA restores empty content with declined persistence', () => {
    let state = appReducer(INITIAL_STATE, {
      type: 'SET_PROFILE_FIELD',
      field: 'focusIntention',
      value: 'finish the draft',
    })
    state = appReducer(state, { type: 'GENERATE_FORECAST' })
    state = appReducer(state, { type: 'GRANT_PERSISTENCE_CONSENT' })

    const cleared = appReducer(state, { type: 'CLEAR_SAVED_DATA' })

    expect(cleared).toEqual({
      ...INITIAL_STATE,
      persistence: { kind: 'declined' },
    })
  })

  it('HYDRATE restores a stored session as saved', () => {
    const session: StoredSessionV1 = {
      schemaVersion: 1,
      savedAt: '2026-08-26T12:00:00.000Z',
      phase: 'choice',
      horizon: 'weekly',
      profile: {
        displayName: 'You',
        focusIntention: 'a slower question',
        tone: 'curious',
      },
      forecastsByHorizon: { daily: null, weekly: null, yearly: null },
      plansByHorizon: { daily: null, weekly: null, yearly: null },
    }

    const hydrated = appReducer(INITIAL_STATE, { type: 'HYDRATE', session })

    expect(hydrated).toEqual({
      phase: 'choice',
      horizon: 'weekly',
      profile: session.profile,
      forecastsByHorizon: session.forecastsByHorizon,
      plansByHorizon: session.plansByHorizon,
      persistence: { kind: 'saved', savedAt: '2026-08-26T12:00:00.000Z' },
      agentAvailability: INITIAL_STATE.agentAvailability,
      confirmation: { status: 'idle' },
      externalShare: { kind: 'none' },
    })
  })
})

describe('confirmation reducer', () => {
  it('approves a profile update only for the pending id', () => {
    let state = appReducer(INITIAL_STATE, {
      type: 'REQUEST_CONFIRMATION',
      kind: 'profile_update',
      summary: 'change tone',
      payload: { kind: 'profile_update', proposed: { tone: 'bold' } },
    })

    const ignored = appReducer(state, {
      type: 'APPROVE_CONFIRMATION',
      id: 'confirm-other',
    })
    expect(ignored.profile.tone).toBe('grounded')
    expect(ignored.confirmation.status).toBe('pending')

    state = appReducer(state, {
      type: 'APPROVE_CONFIRMATION',
      id: 'confirm-profile_update',
    })
    expect(state.profile.tone).toBe('bold')
    expect(state.confirmation).toMatchObject({
      status: 'approved',
      id: 'confirm-profile_update',
    })
  })

  it('records external share approval without a send flag', () => {
    let state = appReducer(INITIAL_STATE, {
      type: 'REQUEST_CONFIRMATION',
      kind: 'external_share',
      summary: 'share profile',
      payload: {
        kind: 'external_share',
        destination: 'gemini-research',
        include: ['profile'],
      },
    })
    state = appReducer(state, {
      type: 'APPROVE_CONFIRMATION',
      id: 'confirm-external_share',
    })

    expect(state.externalShare).toMatchObject({
      kind: 'approved_not_sent',
      destination: 'gemini-research',
      include: ['profile'],
    })
  })

  it('does not grant IndexedDB when a plan is approved without persistSession', () => {
    let state = appReducer(INITIAL_STATE, {
      type: 'PERSISTENCE_UNDECIDED',
    })
    state = appReducer(state, {
      type: 'REQUEST_CONFIRMATION',
      kind: 'plan_save',
      summary: 'approve the plan',
      payload: { kind: 'plan_save', horizon: 'daily' },
    })

    const inMemory = appReducer(state, {
      type: 'APPROVE_CONFIRMATION',
      id: 'confirm-plan_save',
    })
    expect(inMemory.persistence.kind).toBe('undecided')
    expect(inMemory.confirmation).toMatchObject({
      status: 'approved',
      sessionPersist: 'unchanged',
    })

    const withPersist = appReducer(state, {
      type: 'APPROVE_CONFIRMATION',
      id: 'confirm-plan_save',
      persistSession: true,
    })
    expect(withPersist.persistence.kind).toBe('saving')
    expect(withPersist.confirmation).toMatchObject({
      status: 'approved',
      sessionPersist: 'granted',
    })
  })

  it('does not grant persistence from a plan-save while still checking', () => {
    let state = appReducer(INITIAL_STATE, {
      type: 'REQUEST_CONFIRMATION',
      kind: 'plan_save',
      summary: 'approve the plan',
      payload: { kind: 'plan_save', horizon: 'daily' },
    })
    expect(state.persistence.kind).toBe('checking')

    state = appReducer(state, {
      type: 'APPROVE_CONFIRMATION',
      id: 'confirm-plan_save',
      persistSession: true,
    })
    expect(state.persistence.kind).toBe('checking')
    expect(state.confirmation).toMatchObject({
      status: 'approved',
      sessionPersist: 'unchanged',
    })
  })

  it('does not let a late PERSISTENCE_HELD replace saving, saved, or a save error', () => {
    const held = {
      type: 'PERSISTENCE_HELD' as const,
      savedAt: '2026-08-26T12:00:00.000Z',
    }

    const fromChecking = appReducer(INITIAL_STATE, held)
    expect(fromChecking.persistence).toEqual({
      kind: 'held',
      savedAt: held.savedAt,
    })

    const saving = appReducer(INITIAL_STATE, { type: 'GRANT_PERSISTENCE_CONSENT' })
    expect(appReducer(saving, held).persistence).toEqual({ kind: 'saving' })

    const saved = appReducer(saving, {
      type: 'PERSISTENCE_SAVE_SUCCESS',
      savedAt: '2026-08-26T11:00:00.000Z',
    })
    expect(appReducer(saved, held).persistence).toEqual({
      kind: 'saved',
      savedAt: '2026-08-26T11:00:00.000Z',
    })

    const saveError = appReducer(saving, {
      type: 'PERSISTENCE_SAVE_ERROR',
      message: 'write failed',
    })
    expect(appReducer(saveError, held).persistence).toEqual({
      kind: 'error',
      operation: 'save',
      message: 'write failed',
    })
  })

  it('moves consented restart to held so autosave cannot overwrite the stored copy', () => {
    const savedAt = '2026-08-26T11:00:00.000Z'
    let saved = appReducer(INITIAL_STATE, { type: 'GRANT_PERSISTENCE_CONSENT' })
    saved = appReducer(saved, {
      type: 'PERSISTENCE_SAVE_SUCCESS',
      savedAt,
    })
    saved = appReducer(saved, {
      type: 'SET_PROFILE_FIELD',
      field: 'focusIntention',
      value: 'finish the draft',
    })

    const fromSaved = appReducer(saved, { type: 'RESTART' })
    expect(fromSaved.profile.focusIntention).toBe('')
    expect(fromSaved.persistence).toEqual({ kind: 'held', savedAt })

    const fromSaving = appReducer(
      appReducer(INITIAL_STATE, { type: 'GRANT_PERSISTENCE_CONSENT' }),
      { type: 'RESTART' },
    )
    expect(fromSaving.persistence.kind).toBe('held')
    expect(
      appReducer(fromSaving, { type: 'PERSISTENCE_SAVE_START' }).persistence,
    ).toEqual(fromSaving.persistence)
    expect(
      appReducer(fromSaving, {
        type: 'PERSISTENCE_SAVE_SUCCESS',
        savedAt: '2026-08-26T12:00:00.000Z',
      }).persistence,
    ).toEqual(fromSaving.persistence)
    expect(
      appReducer(fromSaving, {
        type: 'PERSISTENCE_SAVE_ERROR',
        message: 'too late',
      }).persistence,
    ).toEqual(fromSaving.persistence)

    const fromSaveError = appReducer(
      appReducer(INITIAL_STATE, {
        type: 'PERSISTENCE_SAVE_ERROR',
        message: 'write failed',
      }),
      { type: 'RESTART' },
    )
    expect(fromSaveError.persistence.kind).toBe('held')

    const declined = appReducer(INITIAL_STATE, {
      type: 'DECLINE_PERSISTENCE_CONSENT',
    })
    expect(appReducer(declined, { type: 'RESTART' }).persistence).toEqual({
      kind: 'declined',
    })
  })

  it('keeps an approved or denied slot until consume', () => {
    let state = appReducer(INITIAL_STATE, {
      type: 'REQUEST_CONFIRMATION',
      kind: 'profile_update',
      summary: 'change tone',
      payload: { kind: 'profile_update', proposed: { tone: 'bold' } },
    })
    state = appReducer(state, {
      type: 'APPROVE_CONFIRMATION',
      id: 'confirm-profile_update',
    })

    const afterSecondRequest = appReducer(state, {
      type: 'REQUEST_CONFIRMATION',
      kind: 'personal_data_access',
      summary: 'read the profile',
      payload: { kind: 'personal_data_access' },
    })
    expect(afterSecondRequest.confirmation).toMatchObject({
      status: 'approved',
      id: 'confirm-profile_update',
      kind: 'profile_update',
    })

    const consumed = appReducer(state, {
      type: 'CONSUME_CONFIRMATION',
      id: 'confirm-profile_update',
    })
    const next = appReducer(consumed, {
      type: 'REQUEST_CONFIRMATION',
      kind: 'personal_data_access',
      summary: 'read the profile',
      payload: { kind: 'personal_data_access' },
    })
    expect(next.confirmation).toMatchObject({
      status: 'pending',
      kind: 'personal_data_access',
    })

    let denied = appReducer(INITIAL_STATE, {
      type: 'REQUEST_CONFIRMATION',
      kind: 'external_share',
      summary: 'share profile',
      payload: {
        kind: 'external_share',
        destination: 'gemini-research',
        include: ['profile'],
      },
    })
    denied = appReducer(denied, {
      type: 'DENY_CONFIRMATION',
      id: 'confirm-external_share',
    })
    const deniedHeld = appReducer(denied, {
      type: 'REQUEST_CONFIRMATION',
      kind: 'personal_data_access',
      summary: 'read the profile',
      payload: { kind: 'personal_data_access' },
    })
    expect(deniedHeld.confirmation).toMatchObject({
      status: 'denied',
      id: 'confirm-external_share',
      kind: 'external_share',
    })
  })
})
