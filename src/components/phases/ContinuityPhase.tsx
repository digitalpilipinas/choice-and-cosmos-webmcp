import { CalendarExport } from '../continuity/CalendarExport.tsx'
import { ReadingPrintSheet } from '../continuity/ReadingPrintSheet.tsx'
import type { StudioPhaseProps } from './phaseProps.ts'

export function ContinuityPhase({ studio, dispatch }: StudioPhaseProps) {
  const receipt = studio.continuity

  return (
    <section className="phase continuity-phase" aria-labelledby="continuity-heading">
      <header className="phase-header">
        <h2 id="continuity-heading">Continuity</h2>
        <p>
          A session receipt for {receipt.displayName}. {receipt.intro}
        </p>
      </header>

      <article className="receipt" aria-labelledby="receipt-heading">
        <h3 id="receipt-heading">This session</h3>
        <dl className="receipt-list">
          <div>
            <dt>Horizon</dt>
            <dd>
              {receipt.horizonLabel} · {receipt.windowDescription}
            </dd>
          </div>
          <div>
            <dt>Focus intention</dt>
            <dd>{receipt.focusIntention}</dd>
          </div>
          <div>
            <dt>Tone</dt>
            <dd>{receipt.tone}</dd>
          </div>
          <div>
            <dt>{receipt.stampLabel}</dt>
            <dd>{receipt.stampValue}</dd>
          </div>
          {receipt.adoptedDigest !== null ? (
            <div>
              <dt>Adopted digest</dt>
              <dd>{receipt.adoptedDigest}</dd>
            </div>
          ) : null}
        </dl>
      </article>

      <section className="receipt-steps" aria-labelledby="accepted-heading">
        <h3 id="accepted-heading">Accepted steps</h3>
        {receipt.accepted.length === 0 ? (
          <p>
            You did not accept any suggested step. That is a complete choice.
            Free will includes walking away empty-handed.
          </p>
        ) : (
          <ol>
            {receipt.accepted.map((step) => (
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

      {receipt.dismissed.length > 0 ? (
        <section aria-labelledby="dismissed-heading">
          <h3 id="dismissed-heading">Dismissed</h3>
          <ul>
            {receipt.dismissed.map((step) => (
              <li key={step.id}>{step.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {receipt.proposed.length > 0 ? (
        <section aria-labelledby="proposed-heading">
          <h3 id="proposed-heading">Left proposed</h3>
          <ul>
            {receipt.proposed.map((step) => (
              <li key={step.id}>{step.title}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="persistence-note">{receipt.persistenceNote}</p>

      {receipt.print.kind === 'available' ? (
        <>
          <button type="button" onClick={() => window.print()}>
            {receipt.print.buttonLabel}
          </button>
          <ReadingPrintSheet sheet={receipt.print.sheet} />
        </>
      ) : null}

      {receipt.calendar.kind === 'available' ? (
        <CalendarExport calendar={receipt.calendar} />
      ) : null}

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
