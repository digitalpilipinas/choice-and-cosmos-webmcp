import { HORIZONS } from '../../fixtures/horizons.ts'
import type { PersonProfile } from '../../domain/types.ts'
import { CosmicFields } from './CosmicFields.tsx'
import type { StudioPhaseProps } from './phaseProps.ts'

const TONE_OPTIONS: Record<
  PersonProfile['tone'],
  { label: string; hint: string }
> = {
  grounded: {
    label: 'Grounded',
    hint: 'Keep the reading close to the next hour you can touch.',
  },
  curious: {
    label: 'Curious',
    hint: 'Treat every image as a question, not a verdict.',
  },
  bold: {
    label: 'Bold',
    hint: 'Take the largest honest step you can stand behind.',
  },
}

const TONE_ORDER = ['grounded', 'curious', 'bold'] as const

export function ContextPhase({ studio, dispatch }: StudioPhaseProps) {
  return (
    <section className="phase context-phase" aria-labelledby="context-heading">
      <header className="phase-header">
        <h2 id="context-heading">Context</h2>
        <p>
          Set a horizon, a focus intention, and any cosmic details you already
          know. This preview does not collect a birth date, birth time, or birth
          location, and it never infers optional signs or numbers.
        </p>
      </header>

      <fieldset className="picker-grid">
        <legend>Horizon</legend>
        {HORIZONS.map((horizon) => (
          <label
            key={horizon.id}
            className={
              studio.horizon === horizon.id ? 'choice-card is-selected' : 'choice-card'
            }
          >
            <input
              type="radio"
              name="horizon"
              value={horizon.id}
              checked={studio.horizon === horizon.id}
              onChange={() =>
                dispatch({ type: 'SET_HORIZON', horizon: horizon.id })
              }
            />
            <span className="choice-card-kicker">{horizon.id}</span>
            <span className="choice-card-title">{horizon.label}</span>
            <span className="choice-card-tagline">{horizon.tagline}</span>
            <span className="choice-card-window">{horizon.windowDescription}</span>
          </label>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor="focus-intention">What&apos;s on your mind right now?</label>
        <textarea
          id="focus-intention"
          name="focusIntention"
          rows={4}
          value={studio.profile.focusIntention}
          onChange={(event) =>
            dispatch({
              type: 'SET_PROFILE_FIELD',
              field: 'focusIntention',
              value: event.target.value,
            })
          }
          placeholder="A decision, a mood, a piece of work, a relationship knot. Whatever you want to sit with."
        />
      </div>

      <fieldset className="picker-row">
        <legend>Tone</legend>
        {TONE_ORDER.map((tone) => {
          const copy = TONE_OPTIONS[tone]
          return (
            <label
              key={tone}
              className={
                studio.profile.tone === tone
                  ? 'choice-chip is-selected'
                  : 'choice-chip'
              }
            >
              <input
                type="radio"
                name="tone"
                value={tone}
                checked={studio.profile.tone === tone}
                onChange={() =>
                  dispatch({
                    type: 'SET_PROFILE_FIELD',
                    field: 'tone',
                    value: tone,
                  })
                }
              />
              <span className="choice-chip-title">{copy.label}</span>
              <span className="choice-chip-hint">{copy.hint}</span>
            </label>
          )
        })}
      </fieldset>

      <CosmicFields beliefs={studio.profile.beliefs} dispatch={dispatch} />
    </section>
  )
}
