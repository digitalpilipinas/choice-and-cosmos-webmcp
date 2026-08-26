import type { UncertaintyState } from '../domain/types.ts'

export function UncertaintyPanel({
  state,
  compact = false,
}: {
  state: UncertaintyState
  compact?: boolean
}) {
  if (compact) {
    return (
      <aside className="uncertainty-readout" aria-label="Uncertainty state">
        <p className="uncertainty-kind">Uncertainty kind: {state.kind}</p>
        {state.kind === 'unavailable' ? (
          <p>{state.reason}</p>
        ) : (
          <p className="uncertainty-source">Source: {state.source}</p>
        )}
      </aside>
    )
  }

  return (
    <article className="uncertainty-panel" aria-labelledby="uncertainty-heading">
      <h3 id="uncertainty-heading">Uncertainty state</h3>
      <p className="uncertainty-kind">Uncertainty kind: {state.kind}</p>
      {state.kind === 'unavailable' ? (
        <p>{state.reason}</p>
      ) : (
        <>
          <p className="uncertainty-source">Source: {state.source}</p>
          <dl className="coverage-list">
            <div>
              <dt>Sources considered</dt>
              <dd>{state.coverage.sourcesConsidered}</dd>
            </div>
            <div>
              <dt>Sources used</dt>
              <dd>{state.coverage.sourcesUsed}</dd>
            </div>
            <div>
              <dt>Time window</dt>
              <dd>{state.coverage.timeWindowDescription}</dd>
            </div>
            <div>
              <dt>Why it stopped</dt>
              <dd>{state.coverage.stoppingReason}</dd>
            </div>
          </dl>
          <p>{state.limitations}</p>
        </>
      )}
    </article>
  )
}
