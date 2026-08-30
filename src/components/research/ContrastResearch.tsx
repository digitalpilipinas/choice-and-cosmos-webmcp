import type { Dispatch } from 'react'
import { CONTRAST_RESEARCH_IDLE_NOTICE } from '../../domain/synthesis.ts'
import { mustInstant } from '../../domain/brand.ts'
import type { AppAction } from '../../domain/loop.ts'
import type { StudioIntake } from '../../domain/studioView.ts'

export function ContrastResearch({
  intake,
  dispatch,
}: {
  intake: StudioIntake
  dispatch: Dispatch<AppAction>
}) {
  const expired = intake.status === 'rejected' && intake.code === 'expired'

  return (
    <article className="research-panel" aria-labelledby="research-panel-heading">
      <h3 id="research-panel-heading">Reading packet</h3>
      <p>{CONTRAST_RESEARCH_IDLE_NOTICE}</p>
      {intake.status === 'rejected' ? (
        <p role="alert">
          {expired
            ? 'This staged packet expired after 30 minutes and was not adopted.'
            : intake.reason}
        </p>
      ) : null}
      {intake.status === 'adopted' ? (
        <p role="status">
          Adopted packet digest {intake.digest}. Coverage is not exhaustive.
        </p>
      ) : null}
      {intake.status === 'ready' && !intake.blocked ? (
        <button
          type="button"
          className="primary"
          onClick={() =>
            dispatch({ type: 'REQUEST_ADOPT_STAGED', now: mustInstant(Date.now()) })
          }
        >
          Adopt this packet
        </button>
      ) : null}
    </article>
  )
}
