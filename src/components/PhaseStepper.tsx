import { PHASE_ORDER } from '../domain/loop.ts'
import type { PhaseId } from '../domain/types.ts'

const PHASE_COPY: Record<PhaseId, { name: string; description: string }> = {
  context: {
    name: 'Context',
    description: 'Intention, horizon, and belief-system lenses',
  },
  cosmos: {
    name: 'Cosmos',
    description: 'Interpretive report',
  },
  contrast: {
    name: 'Contrast',
    description: 'Evidence and coverage',
  },
  choice: {
    name: 'Choice',
    description: 'Steps you accept or dismiss',
  },
  continuity: {
    name: 'Continuity',
    description: 'Session receipt',
  },
}

export function PhaseStepper({ phase }: { phase: PhaseId }) {
  const currentIndex = PHASE_ORDER.indexOf(phase)

  return (
    <nav className="phase-stepper" aria-label="Reflection phases">
      <ol>
        {PHASE_ORDER.map((id, index) => {
          const copy = PHASE_COPY[id]
          const isCurrent = id === phase
          return (
            <li
              key={id}
              className={
                isCurrent
                  ? 'is-current'
                  : index < currentIndex
                    ? 'is-done'
                    : undefined
              }
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="step-index">{index + 1}</span>
              <span className="step-copy">
                <span className="step-name">{copy.name}</span>
                <span className="step-description">{copy.description}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
