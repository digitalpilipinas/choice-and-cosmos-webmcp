import {
  currentPlan,
  hasPersistenceConsent,
} from '../../domain/selectors.ts'
import { HORIZON_BY_ID } from '../../fixtures/horizons.ts'
import type { PersistenceStatus } from '../../domain/types.ts'
import type { PhaseProps } from './phaseProps.ts'

export function ContinuityPhase({ state, dispatch }: PhaseProps) {
  const plan = currentPlan(state)
  const horizon = HORIZON_BY_ID[state.horizon]
  const accepted = plan?.steps.filter((step) => step.status === 'accepted') ?? []
  const dismissed = plan?.steps.filter((step) => step.status === 'dismissed') ?? []
  const proposed = plan?.steps.filter((step) => step.status === 'proposed') ?? []

  return (
    <section className="phase continuity-phase" aria-labelledby="continuity-heading">
      <header className="phase-header">
        <h2 id="continuity-heading">Continuity</h2>
        <p>
          A session receipt for {state.profile.displayName}.{' '}
          {continuityIntro(state.persistence)}
        </p>
      </header>

      <article className="receipt" aria-labelledby="receipt-heading">
        <h3 id="receipt-heading">This session</h3>
        <dl className="receipt-list">
          <div>
            <dt>Horizon</dt>
            <dd>
              {horizon.label} · {horizon.windowDescription}
            </dd>
          </div>
          <div>
            <dt>Focus intention</dt>
            <dd>{state.profile.focusIntention.trim() || 'None written'}</dd>
          </div>
          <div>
            <dt>Tone</dt>
            <dd>{state.profile.tone}</dd>
          </div>
          <div>
            <dt>Fixture stamp</dt>
            <dd>{plan?.createdAt ?? 'Not generated'}</dd>
          </div>
        </dl>
      </article>

      <section className="receipt-steps" aria-labelledby="accepted-heading">
        <h3 id="accepted-heading">Accepted steps</h3>
        {accepted.length === 0 ? (
          <p>
            You did not accept any suggested step. That is a complete choice.
            Free will includes walking away empty-handed.
          </p>
        ) : (
          <ol>
            {accepted.map((step) => (
              <li key={step.id}>
                <p className="receipt-step-title">{step.title}</p>
                {step.userNote.trim() ? (
                  <p className="receipt-note">{step.userNote.trim()}</p>
                ) : (
                  <p className="receipt-note is-empty">No personal note.</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {dismissed.length > 0 ? (
        <section aria-labelledby="dismissed-heading">
          <h3 id="dismissed-heading">Dismissed</h3>
          <ul>
            {dismissed.map((step) => (
              <li key={step.id}>{step.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {proposed.length > 0 ? (
        <section aria-labelledby="proposed-heading">
          <h3 id="proposed-heading">Left proposed</h3>
          <ul>
            {proposed.map((step) => (
              <li key={step.id}>{step.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="persistence-note">{continuityNote(state.persistence)}</p>

      <button
        type="button"
        className="restart"
        onClick={() => dispatch({ type: 'RESTART' })}
      >
        Start a new reflection
      </button>
    </section>
  )
}

function continuityIntro(persistence: PersistenceStatus): string {
  switch (persistence.kind) {
    case 'saved':
      return 'This session is saved on this device. Start a new reflection clears this tab and leaves the stored copy in place. Erase it from the local-saving control at the top of the page.'
    case 'saving':
      return 'This session is being saved on this device. Start a new reflection clears this tab and leaves the stored copy in place. You can stop and erase the saved copy from the control at the top.'
    case 'error':
      if (persistence.operation === 'decline') {
        return 'Nothing is being saved on this device. Reload the page and this session starts over.'
      }
      if (persistence.operation === 'erase') {
        return 'A copy is still on this device. Erase did not finish. Use the control at the top to try erasing again. Start a new reflection clears this tab and leaves the stored copy in place.'
      }
      return 'Saving on this device is on, but the last save did not complete. Use the control at the top to try again. Start a new reflection clears this tab and leaves the stored copy in place.'
    case 'unavailable':
      return `${persistence.reason} A reload starts this session over.`
    case 'checking':
      return 'Checking whether this browser can save locally. Until then, a reload starts from zero.'
    case 'held':
      return 'This tab is not using the stored copy, and nothing is being overwritten. Use the control at the top if you want to replace the saved copy.'
    case 'undecided':
    case 'declined':
      return 'Nothing is being saved on this device. Reload the page and this session starts over.'
    default: {
      const _exhaustive: never = persistence
      return _exhaustive
    }
  }
}

function continuityNote(persistence: PersistenceStatus): string {
  if (hasPersistenceConsent(persistence)) {
    return 'A copy can live in this browser profile until you erase it from the local-saving control at the top. There is no export, no share, no account, and no cloud backup.'
  }
  return 'Nothing on this page is stored. Close the tab or reload and the plan, notes, and report disappear. There is no export, no share, and no account.'
}
