import { type ComponentType, type Dispatch } from 'react'
import { studioView } from '../domain/studioView.ts'
import type { AppAction } from '../domain/loop.ts'
import type { AppState, PhaseId } from '../domain/types.ts'
import { EvidenceCard } from './EvidenceCard.tsx'
import { PhaseStepper } from './PhaseStepper.tsx'
import { ChoicePhase } from './phases/ChoicePhase.tsx'
import { ContextPhase } from './phases/ContextPhase.tsx'
import { ContinuityPhase } from './phases/ContinuityPhase.tsx'
import { ContrastPhase } from './phases/ContrastPhase.tsx'
import { CosmosPhase } from './phases/CosmosPhase.tsx'
import type { StudioPhaseProps } from './phases/phaseProps.ts'
import '../styles.css'

const PHASE_VIEWS: Record<PhaseId, ComponentType<StudioPhaseProps>> = {
  context: ContextPhase,
  cosmos: CosmosPhase,
  contrast: ContrastPhase,
  choice: ChoicePhase,
  continuity: ContinuityPhase,
}

export function StudioShell({
  state,
  dispatch,
}: {
  state: AppState
  dispatch: Dispatch<AppAction>
}) {
  const studio = studioView(state)
  const PhaseView = PHASE_VIEWS[studio.shell.phase]
  return (
    <div className="studio-grid">
      <PhaseStepper phase={studio.shell.phase} />
      <main id="main-content" className="studio-canvas">
        <PhaseView studio={studio} dispatch={dispatch} />
      </main>
      {studio.shell.showEvidenceRail ? (
        <aside className="studio-evidence" aria-label="Evidence">
          {studio.reading.status === 'ready'
            ? studio.reading.evidence.map((card) => (
                <EvidenceCard
                  key={card.id}
                  card={card}
                  showCiting={studio.shell.phase === 'contrast'}
                />
              ))
            : null}
        </aside>
      ) : null}
      <nav className="wizard-nav" aria-label="Phase controls">
        <button
          type="button"
          onClick={() => dispatch({ type: 'BACK' })}
          disabled={!studio.shell.backEnabled}
        >
          Back
        </button>
        {studio.shell.continueLabel === null ? (
          <p className="nav-hint">
            Use Start a new reflection above if you want another pass.
          </p>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={() => dispatch({ type: 'ADVANCE' })}
            disabled={!studio.shell.continueEnabled}
          >
            {studio.shell.continueLabel}
          </button>
        )}
      </nav>
      {studio.shell.emptyAdvanceHint !== null ? (
        <p className="nav-hint" id="advance-hint">
          {studio.shell.emptyAdvanceHint}
        </p>
      ) : null}
    </div>
  )
}
