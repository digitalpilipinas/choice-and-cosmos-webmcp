import type { PersistenceStatus } from '../domain/types.ts'

interface PersistenceBarProps {
  persistence: PersistenceStatus
  onGrant: () => void
  onDecline: () => void
  onRetry: () => void
  onClear: () => void
}

export function PersistenceBar({
  persistence,
  onGrant,
  onDecline,
  onRetry,
  onClear,
}: PersistenceBarProps) {
  return (
    <section className="persistence-bar" aria-label="Local saving">
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

function PersistenceBody({
  persistence,
  onGrant,
  onDecline,
  onRetry,
  onClear,
}: PersistenceBarProps) {
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
            horizon, focus intention, tone, and any generated forecasts and
            choice-plan steps for each horizon. The copy stays only in this
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
