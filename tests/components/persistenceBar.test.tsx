import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PersistenceBar } from '../../src/components/PersistenceBar.tsx'
import { mustInstant } from '../../src/domain/brand.ts'
import { asPacketDigest } from '../../src/domain/digest.ts'
import { INITIAL_STATE } from '../../src/domain/loop.ts'
import { sessionFieldsOf, type SessionFields } from '../../src/persistence/sessionStore.ts'

const saveMock = vi.hoisted(() => ({
  fn: vi.fn(async () => ({ savedAt: '2026-08-29T12:00:00.000Z' })),
}))

vi.mock('../../src/persistence/sessionStore.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/persistence/sessionStore.ts')>()
  return {
    ...actual,
    saveSession: saveMock.fn,
  }
})

function emptySession(): SessionFields {
  return sessionFieldsOf(INITIAL_STATE)
}

describe('PersistenceBar autosave', () => {
  beforeEach(() => {
    saveMock.fn.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('saves when resonanceByHorizon changes after consent', async () => {
    const dispatch = vi.fn()
    const session = emptySession()
    const view = render(
      <PersistenceBar
        persistence={{ kind: 'saved', savedAt: '2026-08-29T11:00:00.000Z' }}
        session={session}
        dispatch={dispatch}
        onGrant={() => undefined}
        onDecline={() => undefined}
        onRetry={() => undefined}
        onClear={() => undefined}
      />,
    )
    await vi.advanceTimersByTimeAsync(400)
    expect(saveMock.fn).toHaveBeenCalledTimes(1)
    saveMock.fn.mockClear()

    view.rerender(
      <PersistenceBar
        persistence={{ kind: 'saved', savedAt: '2026-08-29T11:00:00.000Z' }}
        session={{
          ...session,
          resonanceByHorizon: {
            daily: { energyOverview: 'resonates' },
            weekly: null,
            yearly: null,
          },
        }}
        dispatch={dispatch}
        onGrant={() => undefined}
        onDecline={() => undefined}
        onRetry={() => undefined}
        onClear={() => undefined}
      />,
    )
    await vi.advanceTimersByTimeAsync(400)
    expect(saveMock.fn).toHaveBeenCalledTimes(1)
    expect(saveMock.fn).toHaveBeenCalledWith(
      expect.objectContaining({
        resonanceByHorizon: {
          daily: { energyOverview: 'resonates' },
          weekly: null,
          yearly: null,
        },
      }),
    )
  })

  it('saves when readingsByHorizon changes after consent', async () => {
    const dispatch = vi.fn()
    const session = emptySession()
    const view = render(
      <PersistenceBar
        persistence={{ kind: 'saved', savedAt: '2026-08-29T11:00:00.000Z' }}
        session={session}
        dispatch={dispatch}
        onGrant={() => undefined}
        onDecline={() => undefined}
        onRetry={() => undefined}
        onClear={() => undefined}
      />,
    )
    await vi.advanceTimersByTimeAsync(400)
    saveMock.fn.mockClear()

    view.rerender(
      <PersistenceBar
        persistence={{ kind: 'saved', savedAt: '2026-08-29T11:00:00.000Z' }}
        session={{
          ...session,
          readingsByHorizon: {
            ...session.readingsByHorizon,
            weekly: {
              horizon: 'weekly',
              adoptedAt: mustInstant(1_000),
              packetDigest: asPacketDigest('adopted'),
              sources: [],
              sections: [],
              coverage: {
                sourcesConsidered: 0,
                sourcesUsed: 0,
                timeWindowDescription: 'Adopted from a reviewed reading packet.',
                stoppingReason:
                  'The person adopted this packet. It is not an exhaustive search.',
                mode: 'adopted',
                exhaustive: false,
              },
              skippedLenses: [],
            },
          },
        }}
        dispatch={dispatch}
        onGrant={() => undefined}
        onDecline={() => undefined}
        onRetry={() => undefined}
        onClear={() => undefined}
      />,
    )
    await vi.advanceTimersByTimeAsync(400)
    expect(saveMock.fn).toHaveBeenCalledTimes(1)
    expect(saveMock.fn).toHaveBeenCalledWith(
      expect.objectContaining({
        readingsByHorizon: expect.objectContaining({ weekly: expect.anything() }),
      }),
    )
  })

  it('does not save again when only persistence.kind moves between saving and saved', async () => {
    const dispatch = vi.fn()
    const session = emptySession()
    const view = render(
      <PersistenceBar
        persistence={{ kind: 'saved', savedAt: '2026-08-29T11:00:00.000Z' }}
        session={session}
        dispatch={dispatch}
        onGrant={() => undefined}
        onDecline={() => undefined}
        onRetry={() => undefined}
        onClear={() => undefined}
      />,
    )
    await vi.advanceTimersByTimeAsync(400)
    saveMock.fn.mockClear()

    view.rerender(
      <PersistenceBar
        persistence={{ kind: 'saving' }}
        session={session}
        dispatch={dispatch}
        onGrant={() => undefined}
        onDecline={() => undefined}
        onRetry={() => undefined}
        onClear={() => undefined}
      />,
    )
    await vi.advanceTimersByTimeAsync(400)
    expect(saveMock.fn).not.toHaveBeenCalled()
  })
})
