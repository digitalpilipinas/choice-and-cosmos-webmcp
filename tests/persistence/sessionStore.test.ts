import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FREE_WILL_NOTE, INITIAL_STATE, fixtureDerivedProfile } from '../../src/domain/loop.ts'
import type { AppState } from '../../src/domain/types.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'
import { getItem, setItem } from '../../src/persistence/db.ts'
import {
  actionFromBootstrap,
  bootstrapPersistence,
  clearSavedData,
  declineConsent,
  grantConsentAndSave,
  migrateV1ToV2,
  migrateV2ToV3,
  parseStoredSession,
  parseStoredSessionV1,
  saveSession,
  sessionFieldsOf,
} from '../../src/persistence/sessionStore.ts'

const savedIndexedDb = globalThis.indexedDB

const EMPTY_HORIZONS = { daily: null, weekly: null, yearly: null }

const v1Profile = {
  displayName: 'You',
  focusIntention: 'name the season',
  tone: 'bold' as const,
}

const sampleState: Pick<
  AppState,
  | 'phase'
  | 'horizon'
  | 'profile'
  | 'forecastsByHorizon'
  | 'readingsByHorizon'
  | 'resonanceByHorizon'
  | 'plansByHorizon'
> = {
  phase: 'contrast',
  horizon: 'yearly',
  profile: {
    ...v1Profile,
    beliefs: {},
  },
  forecastsByHorizon: EMPTY_HORIZONS,
  readingsByHorizon: EMPTY_HORIZONS,
  resonanceByHorizon: EMPTY_HORIZONS,
  plansByHorizon: EMPTY_HORIZONS,
}

describe('sessionStore', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
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
        schemaVersion: 3,
        savedAt: saved.savedAt,
        phase: sampleState.phase,
        horizon: sampleState.horizon,
        profile: sampleState.profile,
        forecastsByHorizon: sampleState.forecastsByHorizon,
        readingsByHorizon: sampleState.readingsByHorizon,
        resonanceByHorizon: sampleState.resonanceByHorizon,
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
      readingsByHorizon: INITIAL_STATE.readingsByHorizon,
      resonanceByHorizon: INITIAL_STATE.resonanceByHorizon,
      plansByHorizon: INITIAL_STATE.plansByHorizon,
    })
    expect(fields).not.toHaveProperty('confirmation')
    expect(fields).not.toHaveProperty('persistence')
    expect(fields).not.toHaveProperty('desk')
    expect(fields).not.toHaveProperty('intake')
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

  it('treats a corrupt stored session as unreadable without overwriting it', async () => {
    await grantConsentAndSave(sampleState)
    const blob = { schemaVersion: 99, savedAt: 'nope' }
    await setItem('session', blob)
    await expect(bootstrapPersistence()).resolves.toEqual({
      kind: 'unreadable',
      savedAt: { status: 'recorded', value: 'nope' },
    })
    await expect(getItem('session')).resolves.toEqual(blob)
  })

  it('does not invent an unreadable timestamp sentinel when savedAt is missing', async () => {
    await setItem('consent', 'granted')
    await setItem('session', { schemaVersion: 99 })
    await expect(bootstrapPersistence()).resolves.toEqual({
      kind: 'unreadable',
      savedAt: { status: 'missing' },
    })
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
      schemaVersion: 3 as const,
      savedAt: '2026-08-26T12:00:00.000Z',
      phase: 'cosmos' as const,
      horizon: 'yearly' as const,
      profile: sampleState.profile,
      forecastsByHorizon: sampleState.forecastsByHorizon,
      readingsByHorizon: sampleState.readingsByHorizon,
      resonanceByHorizon: sampleState.resonanceByHorizon,
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
    expect(parseStoredSessionV1({ schemaVersion: 1, savedAt: 'x' })).toBeNull()
  })

  it('rejects nested forecast and plan documents that fail deep validation', async () => {
    const envelope = {
      schemaVersion: 1 as const,
      savedAt: '2026-08-26T12:00:00.000Z',
      phase: 'cosmos' as const,
      horizon: 'yearly' as const,
      profile: v1Profile,
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
      kind: 'unreadable',
      savedAt: { status: 'recorded', value: envelope.savedAt },
    })
    await expect(getItem('session')).resolves.toEqual(envelope)
  })

  it('hydrates a valid nested forecast and plan', async () => {
    const forecast = generateForecast(
      fixtureDerivedProfile(sampleState.profile),
      'yearly',
    )
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

    const v1Nested = {
      phase: withNested.phase,
      horizon: withNested.horizon,
      profile: v1Profile,
      forecastsByHorizon: withNested.forecastsByHorizon,
      plansByHorizon: withNested.plansByHorizon,
    }

    expect(
      parseStoredSessionV1({
        schemaVersion: 1,
        savedAt: '2026-08-26T12:00:00.000Z',
        ...v1Nested,
      }),
    ).toEqual({
      schemaVersion: 1,
      savedAt: '2026-08-26T12:00:00.000Z',
      ...v1Nested,
    })
    expect(
      parseStoredSession({
        schemaVersion: 1,
        savedAt: '2026-08-26T12:00:00.000Z',
        ...v1Nested,
      }),
    ).toEqual({
      schemaVersion: 3,
      savedAt: '2026-08-26T12:00:00.000Z',
      ...withNested,
    })
    expect(
      migrateV2ToV3(
        migrateV1ToV2({
          schemaVersion: 1,
          savedAt: '2026-08-26T12:00:00.000Z',
          ...v1Nested,
        }),
      ),
    ).toEqual({
      schemaVersion: 3,
      savedAt: '2026-08-26T12:00:00.000Z',
      ...withNested,
    })

    const saved = await grantConsentAndSave(withNested)
    expect(saved).toEqual({ savedAt: expect.any(String) })
    await expect(bootstrapPersistence()).resolves.toEqual({
      kind: 'hydrated',
      session: {
        schemaVersion: 3,
        savedAt: 'savedAt' in saved ? saved.savedAt : '',
        ...withNested,
      },
    })
  })

  it('round-trips entered belief fields and leaves omitted fields absent', async () => {
    const withBeliefs = {
      ...sampleState,
      profile: {
        ...sampleState.profile,
        beliefs: {
          western: { sun: 'leo' as const },
          humanDesign: { type: 'projector' as const },
        },
      },
    }
    const saved = await grantConsentAndSave(withBeliefs)
    expect(saved).toEqual({ savedAt: expect.any(String) })
    const result = await bootstrapPersistence()
    expect(result).toEqual({
      kind: 'hydrated',
      session: {
        schemaVersion: 3,
        savedAt: 'savedAt' in saved ? saved.savedAt : '',
        ...withBeliefs,
      },
    })
    if (result.kind !== 'hydrated') {
      throw new Error('expected hydrated beliefs session')
    }
    expect(result.session.profile.beliefs).toEqual({
      western: { sun: 'leo' },
      humanDesign: { type: 'projector' },
    })
    expect(result.session.profile.beliefs.western).not.toHaveProperty('moon')
    expect(result.session.profile.beliefs).not.toHaveProperty('numerology')
  })

  it('migrates a stored v1 document to v3 without dropping forecasts', async () => {
    const forecast = generateForecast(
      fixtureDerivedProfile(sampleState.profile),
      'yearly',
    )
    const v1 = {
      schemaVersion: 1 as const,
      savedAt: '2026-08-26T12:00:00.000Z',
      phase: 'contrast' as const,
      horizon: 'yearly' as const,
      profile: v1Profile,
      forecastsByHorizon: {
        daily: null,
        weekly: null,
        yearly: forecast,
      },
      plansByHorizon: { daily: null, weekly: null, yearly: null },
    }
    await setItem('consent', 'granted')
    await setItem('session', v1)
    await expect(bootstrapPersistence()).resolves.toEqual({
      kind: 'hydrated',
      session: {
        schemaVersion: 3,
        savedAt: v1.savedAt,
        phase: v1.phase,
        horizon: v1.horizon,
        profile: { ...v1Profile, beliefs: {} },
        forecastsByHorizon: v1.forecastsByHorizon,
        readingsByHorizon: EMPTY_HORIZONS,
        resonanceByHorizon: EMPTY_HORIZONS,
        plansByHorizon: v1.plansByHorizon,
      },
    })
  })

  it('migrateV1ToV2 still returns v2 with cosmic', () => {
    const v1 = {
      schemaVersion: 1 as const,
      savedAt: '2026-08-26T12:00:00.000Z',
      phase: 'contrast' as const,
      horizon: 'yearly' as const,
      profile: v1Profile,
      forecastsByHorizon: EMPTY_HORIZONS,
      plansByHorizon: EMPTY_HORIZONS,
    }
    expect(migrateV1ToV2(v1)).toEqual({
      schemaVersion: 2,
      savedAt: v1.savedAt,
      phase: v1.phase,
      horizon: v1.horizon,
      profile: { ...v1Profile, cosmic: {} },
      forecastsByHorizon: v1.forecastsByHorizon,
      plansByHorizon: v1.plansByHorizon,
    })
  })

  it('rejects smuggled desk, staged, confirmation, or packet keys on v3', () => {
    const envelope = {
      schemaVersion: 3,
      savedAt: '2026-08-26T12:00:00.000Z',
      phase: 'context',
      horizon: 'daily',
      profile: { ...v1Profile, beliefs: {} },
      forecastsByHorizon: EMPTY_HORIZONS,
      readingsByHorizon: EMPTY_HORIZONS,
      resonanceByHorizon: EMPTY_HORIZONS,
      plansByHorizon: EMPTY_HORIZONS,
    }
    expect(parseStoredSession({ ...envelope, desk: {} })).toBeNull()
    expect(parseStoredSession({ ...envelope, staged: {} })).toBeNull()
    expect(parseStoredSession({ ...envelope, confirmation: {} })).toBeNull()
    expect(parseStoredSession({ ...envelope, packet: {} })).toBeNull()
  })

  it('rejects extra cosmic keys without inferring values', () => {
    expect(
      parseStoredSession({
        schemaVersion: 2,
        savedAt: '2026-08-26T12:00:00.000Z',
        phase: 'context',
        horizon: 'daily',
        profile: {
          ...v1Profile,
          cosmic: { sunSign: 'leo', inferredFromBirthDate: '1991-01-01' },
        },
        forecastsByHorizon: sampleState.forecastsByHorizon,
        plansByHorizon: sampleState.plansByHorizon,
      }),
    ).toBeNull()
  })

  it('maps unreadable bootstrap to held so App.tsx will not overwrite', () => {
    expect(
      actionFromBootstrap({ kind: 'unreadable', savedAt: { status: 'recorded', value: 'kept' } }, false),
    ).toEqual({ type: 'PERSISTENCE_HELD', savedAt: 'kept' })
    expect(
      actionFromBootstrap({ kind: 'unreadable', savedAt: { status: 'missing' } }, false),
    ).toEqual({ type: 'PERSISTENCE_HELD', savedAt: '' })
  })

  it('writes schemaVersion 3 after a v1 migrate-on-read', async () => {
    const v1 = {
      schemaVersion: 1 as const,
      savedAt: '2026-08-26T12:00:00.000Z',
      phase: 'contrast' as const,
      horizon: 'yearly' as const,
      profile: v1Profile,
      forecastsByHorizon: sampleState.forecastsByHorizon,
      plansByHorizon: sampleState.plansByHorizon,
    }
    await setItem('consent', 'granted')
    await setItem('session', v1)
    const result = await bootstrapPersistence()
    if (result.kind !== 'hydrated') {
      throw new Error('expected migrated v1')
    }
    const written = await saveSession({
      phase: result.session.phase,
      horizon: result.session.horizon,
      profile: result.session.profile,
      forecastsByHorizon: result.session.forecastsByHorizon,
      readingsByHorizon: result.session.readingsByHorizon,
      resonanceByHorizon: result.session.resonanceByHorizon,
      plansByHorizon: result.session.plansByHorizon,
    })
    expect(written).toEqual({ savedAt: expect.any(String) })
    await expect(getItem('session')).resolves.toMatchObject({
      schemaVersion: 3,
      profile: { ...v1Profile, beliefs: {} },
    })
  })

  it('fails parse for null, empty, inferred, or extra cosmic values on v2', () => {
    const envelope = {
      schemaVersion: 2,
      savedAt: '2026-08-26T12:00:00.000Z',
      phase: 'context',
      horizon: 'daily',
      forecastsByHorizon: sampleState.forecastsByHorizon,
      plansByHorizon: sampleState.plansByHorizon,
    }
    expect(
      parseStoredSession({
        ...envelope,
        profile: { ...v1Profile, cosmic: { sunSign: '' } },
      }),
    ).toBeNull()
    expect(
      parseStoredSession({
        ...envelope,
        profile: { ...v1Profile, cosmic: { sunSign: null } },
      }),
    ).toBeNull()
    expect(
      parseStoredSession({
        ...envelope,
        profile: { ...v1Profile, cosmic: { sunSign: 'inferred' } },
      }),
    ).toBeNull()
    expect(
      parseStoredSession({
        ...envelope,
        profile: { ...v1Profile, cosmic: { lifePath: 10 } },
      }),
    ).toBeNull()
    expect(
      parseStoredSession({
        ...envelope,
        profile: { ...v1Profile },
      })?.profile.beliefs,
    ).toEqual({})
  })

  it('bootstraps granted-empty when consent is granted and no session key exists', async () => {
    await setItem('consent', 'granted')
    await expect(bootstrapPersistence()).resolves.toEqual({
      kind: 'granted-empty',
    })
  })
})
