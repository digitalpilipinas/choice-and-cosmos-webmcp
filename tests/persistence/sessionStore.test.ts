import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FREE_WILL_NOTE, INITIAL_STATE } from '../../src/domain/loop.ts'
import type { AppState } from '../../src/domain/types.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'
import { setItem } from '../../src/persistence/db.ts'
import {
  actionFromBootstrap,
  bootstrapPersistence,
  clearSavedData,
  declineConsent,
  grantConsentAndSave,
  parseStoredSessionV1,
  saveSession,
  sessionFieldsOf,
} from '../../src/persistence/sessionStore.ts'

const savedIndexedDb = globalThis.indexedDB

const sampleState: Pick<
  AppState,
  'phase' | 'horizon' | 'profile' | 'forecastsByHorizon' | 'plansByHorizon'
> = {
  phase: 'contrast',
  horizon: 'yearly',
  profile: {
    displayName: 'You',
    focusIntention: 'name the season',
    tone: 'bold',
  },
  forecastsByHorizon: { daily: null, weekly: null, yearly: null },
  plansByHorizon: { daily: null, weekly: null, yearly: null },
}

describe('sessionStore', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    // Restore in case a test temporarily removed the factory.
    if (typeof indexedDB === 'undefined' && savedIndexedDb !== undefined) {
      globalThis.indexedDB = savedIndexedDb
    }
  })

  it('bootstraps as undecided with a fresh store', async () => {
    await expect(bootstrapPersistence()).resolves.toEqual({ kind: 'undecided' })
  })

  it('hydrates a session after consent and save', async () => {
    const saved = await grantConsentAndSave(sampleState)
    expect(saved).toEqual({ savedAt: expect.any(String) })
    if (!('savedAt' in saved)) {
      throw new Error('expected a successful save')
    }

    const result = await bootstrapPersistence()
    expect(result).toEqual({
      kind: 'hydrated',
      session: {
        schemaVersion: 1,
        savedAt: saved.savedAt,
        phase: sampleState.phase,
        horizon: sampleState.horizon,
        profile: sampleState.profile,
        forecastsByHorizon: sampleState.forecastsByHorizon,
        plansByHorizon: sampleState.plansByHorizon,
      },
    })
  })

  it('bootstraps as declined after declineConsent', async () => {
    await declineConsent()
    await expect(bootstrapPersistence()).resolves.toEqual({ kind: 'declined' })
  })

  it('treats an unknown consent value as undecided', async () => {
    await setItem('consent', 'yes')
    await expect(bootstrapPersistence()).resolves.toEqual({ kind: 'undecided' })
  })

  it('does not save when stored consent is not exactly granted', async () => {
    await setItem('consent', 'yes')
    await expect(saveSession(sampleState)).resolves.toEqual({
      error: 'Saving is off.',
    })
  })

  it('projects only session fields for persistence writes', () => {
    const fields = sessionFieldsOf(INITIAL_STATE)
    expect(fields).toEqual({
      phase: INITIAL_STATE.phase,
      horizon: INITIAL_STATE.horizon,
      profile: INITIAL_STATE.profile,
      forecastsByHorizon: INITIAL_STATE.forecastsByHorizon,
      plansByHorizon: INITIAL_STATE.plansByHorizon,
    })
    expect(fields).not.toHaveProperty('confirmation')
    expect(fields).not.toHaveProperty('persistence')
  })

  it('clearSavedData returns bootstrap to undecided', async () => {
    await grantConsentAndSave(sampleState)
    await clearSavedData()
    await expect(bootstrapPersistence()).resolves.toEqual({ kind: 'undecided' })
  })

  it('does not let an in-flight save restore a session after erase', async () => {
    await grantConsentAndSave(sampleState)
    const inFlight = saveSession({
      ...sampleState,
      phase: 'choice',
    })
    await clearSavedData()
    await inFlight
    await expect(bootstrapPersistence()).resolves.toEqual({ kind: 'undecided' })
  })

  it('does not write a session when saveSession runs after erase', async () => {
    await grantConsentAndSave(sampleState)
    await clearSavedData()
    const result = await saveSession({
      ...sampleState,
      phase: 'choice',
    })
    expect(result).toEqual({ error: 'Saving is off.' })
    await expect(bootstrapPersistence()).resolves.toEqual({ kind: 'undecided' })
  })

  it('does not write a session when saveSession runs after decline', async () => {
    await grantConsentAndSave(sampleState)
    await declineConsent()
    const result = await saveSession({
      ...sampleState,
      phase: 'choice',
    })
    expect(result).toEqual({ error: 'Saving is off.' })
    await expect(bootstrapPersistence()).resolves.toEqual({ kind: 'declined' })
  })

  it('reports unavailable when indexedDB is missing', async () => {
    const original = globalThis.indexedDB
    try {
      delete (globalThis as { indexedDB?: IDBFactory }).indexedDB
      const result = await bootstrapPersistence()
      expect(result.kind).toBe('unavailable')
      if (result.kind !== 'unavailable') {
        throw new Error('expected unavailable bootstrap')
      }
      expect(result.reason.length).toBeGreaterThan(0)
    } finally {
      globalThis.indexedDB = original
    }
  })

  it('treats a corrupt stored session as granted-empty', async () => {
    await grantConsentAndSave(sampleState)
    await setItem('session', { schemaVersion: 99, savedAt: 'nope' })
    await expect(bootstrapPersistence()).resolves.toEqual({ kind: 'granted-empty' })
  })

  it('returns an error when decline cannot write', async () => {
    const original = globalThis.indexedDB
    try {
      delete (globalThis as { indexedDB?: IDBFactory }).indexedDB
      const result = await declineConsent()
      expect(result).toEqual({ error: expect.any(String) })
    } finally {
      globalThis.indexedDB = original
    }
  })

  it('returns an error when erase cannot delete', async () => {
    const original = globalThis.indexedDB
    try {
      delete (globalThis as { indexedDB?: IDBFactory }).indexedDB
      const result = await clearSavedData()
      expect(result).toEqual({ error: expect.any(String) })
    } finally {
      globalThis.indexedDB = original
    }
  })

  it('keeps in-progress edits instead of hydrating over them', () => {
    const session = {
      schemaVersion: 1 as const,
      savedAt: '2026-08-26T12:00:00.000Z',
      phase: 'cosmos' as const,
      horizon: 'yearly' as const,
      profile: sampleState.profile,
      forecastsByHorizon: sampleState.forecastsByHorizon,
      plansByHorizon: sampleState.plansByHorizon,
    }
    expect(
      actionFromBootstrap({ kind: 'hydrated', session }, true),
    ).toEqual({
      type: 'PERSISTENCE_HELD',
      savedAt: session.savedAt,
    })
    expect(
      actionFromBootstrap({ kind: 'hydrated', session }, false),
    ).toEqual({ type: 'HYDRATE', session })
  })

  it('rejects a stored session that is not v1', () => {
    expect(parseStoredSessionV1({ schemaVersion: 2, savedAt: 'x' })).toBeNull()
    expect(parseStoredSessionV1(null)).toBeNull()
  })

  it('rejects nested forecast and plan documents that fail deep validation', async () => {
    const envelope = {
      schemaVersion: 1 as const,
      savedAt: '2026-08-26T12:00:00.000Z',
      phase: 'cosmos' as const,
      horizon: 'yearly' as const,
      profile: sampleState.profile,
      forecastsByHorizon: {
        daily: null,
        weekly: null,
        yearly: {
          horizon: 'yearly',
          generatedAt: '2026-08-26T12:00:00.000Z',
          sections: [{}],
          evidence: [],
          coverage: {
            sourcesConsidered: 1,
            sourcesUsed: 1,
            timeWindowDescription: 'year',
            stoppingReason: 'stop',
            mode: 'fixture',
          },
          suggestedSteps: [],
        },
      },
      plansByHorizon: { daily: null, weekly: null, yearly: null },
    }

    expect(parseStoredSessionV1(envelope)).toBeNull()
    expect(
      parseStoredSessionV1({
        ...envelope,
        forecastsByHorizon: {
          daily: null,
          weekly: null,
          yearly: {
            horizon: 'yearly',
            generatedAt: '2026-08-26T12:00:00.000Z',
            sections: [],
            evidence: [],
            coverage: {},
            suggestedSteps: [],
          },
        },
      }),
    ).toBeNull()
    expect(
      parseStoredSessionV1({
        ...envelope,
        forecastsByHorizon: { daily: null, weekly: null, yearly: null },
        plansByHorizon: {
          daily: null,
          weekly: null,
          yearly: {
            horizon: 'yearly',
            createdAt: '2026-08-26T12:00:00.000Z',
            steps: [{ id: 1 }],
            freeWillNote: 'choice stays with you',
          },
        },
      }),
    ).toBeNull()

    await grantConsentAndSave(sampleState)
    await setItem('session', envelope)
    await expect(bootstrapPersistence()).resolves.toEqual({
      kind: 'granted-empty',
    })
  })

  it('hydrates a valid nested forecast and plan', async () => {
    const forecast = generateForecast(sampleState.profile, 'yearly')
    const plan = {
      horizon: 'yearly' as const,
      createdAt: forecast.generatedAt,
      steps: forecast.suggestedSteps,
      freeWillNote: FREE_WILL_NOTE,
    }
    const withNested = {
      ...sampleState,
      forecastsByHorizon: {
        daily: null,
        weekly: null,
        yearly: forecast,
      },
      plansByHorizon: {
        daily: null,
        weekly: null,
        yearly: plan,
      },
    }

    expect(
      parseStoredSessionV1({
        schemaVersion: 1,
        savedAt: '2026-08-26T12:00:00.000Z',
        ...withNested,
      }),
    ).toEqual({
      schemaVersion: 1,
      savedAt: '2026-08-26T12:00:00.000Z',
      ...withNested,
    })

    const saved = await grantConsentAndSave(withNested)
    expect(saved).toEqual({ savedAt: expect.any(String) })
    await expect(bootstrapPersistence()).resolves.toEqual({
      kind: 'hydrated',
      session: {
        schemaVersion: 1,
        savedAt: 'savedAt' in saved ? saved.savedAt : '',
        ...withNested,
      },
    })
  })
})
