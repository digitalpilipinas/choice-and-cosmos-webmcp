import { useEffect, useRef, type Dispatch } from 'react'
import type { AppAction } from '../domain/loop.ts'
import { hasPersistenceConsent } from '../domain/selectors.ts'
import type { PersistenceStatus } from '../domain/types.ts'
import {
  saveSession,
  type SessionFields,
} from '../persistence/sessionStore.ts'

interface PersistenceBarProps {
  persistence: PersistenceStatus
  session: SessionFields
  dispatch: Dispatch<AppAction>
  onGrant: () => void
  onDecline: () => void
  onRetry: () => void
  onClear: () => void
}

export function PersistenceBar({
  persistence,
  session,
  dispatch,
  onGrant,
  onDecline,
  onRetry,
  onClear,
}: PersistenceBarProps) {
  return (
    <section className="persistence-bar" aria-label="Local saving">
      <SessionPersistWatcher
        persistence={persistence}
        session={session}
        dispatch={dispatch}
      />
      <PersistenceBody
        persistence={persistence}
        onGrant={onGrant}
        onDecline={onDecline}
        onRetry={onRetry}
        onClear={onClear}
      />
    </section>
  )
}

function SessionPersistWatcher({
  persistence,
  session,
  dispatch,
}: {
  persistence: PersistenceStatus
  session: SessionFields
  dispatch: Dispatch<AppAction>
}) {
  const consent = hasPersistenceConsent(persistence)
  const eraseFailed =
    persistence.kind === 'error' && persistence.operation === 'erase'
  const {
    phase,
    horizon,
    profile,
    forecastsByHorizon,
    plansByHorizon,
    readingsByHorizon,
    resonanceByHorizon,
  } = session

  const persistenceRef = useRef(persistence)
  useEffect(() => {
    persistenceRef.current = persistence
  }, [persistence])

  useEffect(() => {
    if (!consent || eraseFailed) {
      return
    }
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (cancelled || !hasPersistenceConsent(persistenceRef.current)) {
        return
      }
      dispatch({ type: 'PERSISTENCE_SAVE_START' })
      void saveSession({
        phase,
        horizon,
        profile,
        forecastsByHorizon,
        readingsByHorizon,
        resonanceByHorizon,
        plansByHorizon,
      }).then((result) => {
        if (cancelled || !hasPersistenceConsent(persistenceRef.current)) {
          return
        }
        if ('savedAt' in result) {
          dispatch({ type: 'PERSISTENCE_SAVE_SUCCESS', savedAt: result.savedAt })
        } else {
          dispatch({ type: 'PERSISTENCE_SAVE_ERROR', message: result.error })
        }
      })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [
    consent,
    eraseFailed,
    dispatch,
    phase,
    horizon,
    profile,
    forecastsByHorizon,
    plansByHorizon,
    readingsByHorizon,
    resonanceByHorizon,
  ])

  return null
}

function PersistenceBody({
  persistence,
  onGrant,
  onDecline,
  onRetry,
  onClear,
}: {
  persistence: PersistenceStatus
  onGrant: () => void
  onDecline: () => void
  onRetry: () => void
  onClear: () => void
}) {
  switch (persistence.kind) {
    case 'checking':
      return (
        <p role="status">Checking whether this browser can save locally…</p>
      )
    case 'unavailable':
      return (
        <p role="status">
          {persistence.reason} The preview still works fully in this tab without
          saving.
        </p>
      )
    case 'undecided':
      return (
        <>
          <p role="status">
            Saving is optional. If you opt in, this browser stores the current
            horizon, focus intention, tone, any self-supplied belief-system
            fields you entered, adopted readings, and any generated forecasts
            and choice-plan steps for each horizon. The copy stays only in this
            browser profile. It is never sent anywhere, and you can turn saving
            off and erase it at any time.
          </p>
          <div className="persistence-actions">
            <button type="button" className="primary" onClick={onGrant}>
              Save on this device
            </button>
            <button type="button" onClick={onDecline}>
              Don&apos;t save
            </button>
          </div>
        </>
      )
    case 'held':
      return (
        <>
          <p role="status">
            A saved copy exists in this browser. This tab is not using that copy,
            and nothing will be overwritten until you choose. Save on this
            device replaces the stored copy with this tab.
          </p>
          <div className="persistence-actions">
            <button type="button" className="primary" onClick={onGrant}>
              Save on this device
            </button>
          </div>
        </>
      )
    case 'declined':
      return (
        <>
          <p role="status">
            Nothing is being saved on this device. You can change your mind
            later.
          </p>
          <div className="persistence-actions">
            <button type="button" className="primary" onClick={onGrant}>
              Save on this device
            </button>
          </div>
        </>
      )
    case 'saving':
      return <p role="status">Saving to this device…</p>
    case 'saved':
      return (
        <>
          <p role="status">
            Saved on this device. Last saved {formatSavedAt(persistence.savedAt)}
            .
          </p>
          <div className="persistence-actions">
            <button type="button" className="danger" onClick={onClear}>
              Stop saving &amp; erase this device&apos;s copy
            </button>
          </div>
        </>
      )
    case 'error':
      if (persistence.operation === 'decline') {
        return (
          <>
            <p role="status">{persistence.message}</p>
            <div className="persistence-actions">
              <button type="button" className="primary" onClick={onGrant}>
                Save on this device
              </button>
              <button type="button" onClick={onDecline}>
                Don&apos;t save
              </button>
            </div>
          </>
        )
      }
      if (persistence.operation === 'erase') {
        return (
          <>
            <p role="status">{persistence.message}</p>
            <div className="persistence-actions">
              <button type="button" className="danger" onClick={onClear}>
                Stop saving &amp; erase this device&apos;s copy
              </button>
            </div>
          </>
        )
      }
      return (
        <>
          <p role="status">{persistence.message}</p>
          <div className="persistence-actions">
            <button type="button" className="primary" onClick={onRetry}>
              Try saving again
            </button>
          </div>
        </>
      )
    default: {
      const _exhaustive: never = persistence
      return _exhaustive
    }
  }
}

function formatSavedAt(iso: string): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) {
    return iso
  }

  const elapsedMs = Date.now() - then.getTime()
  if (elapsedMs < 45_000) {
    return 'just now'
  }
  if (elapsedMs < 3_600_000) {
    const minutes = Math.max(1, Math.round(elapsedMs / 60_000))
    return `${minutes} min ago`
  }
  return then.toLocaleString()
}
