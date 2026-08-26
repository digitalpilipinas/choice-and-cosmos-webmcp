import { useState } from 'react'
import { createCustomStepId } from '../../domain/loop.ts'
import {
  currentForecast,
  currentPlan,
  forecastCockpit,
  hasPersistenceConsent,
  uncertaintyFor,
} from '../../domain/selectors.ts'
import { ForecastCockpit } from '../ForecastCockpit.tsx'
import { FreeWillBanner } from '../FreeWillBanner.tsx'
import type { ChoiceStepStatus } from '../../domain/types.ts'
import type { PhaseProps } from './phaseProps.ts'

const STATUS_ACTIONS: readonly {
  status: ChoiceStepStatus
  label: string
}[] = [
  { status: 'proposed', label: 'Leave proposed' },
  { status: 'accepted', label: 'Accept' },
  { status: 'dismissed', label: 'Dismiss' },
]

export function ChoicePhase({ state, dispatch }: PhaseProps) {
  const [draftTitle, setDraftTitle] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const plan = currentPlan(state)
  const forecast = currentForecast(state)
  const cockpit = forecastCockpit(state.horizon, state.profile, forecast)
  const uncertainty = uncertaintyFor(forecast)
  if (plan === null) {
    return (
      <section className="phase" aria-labelledby="choice-heading">
        <h2 id="choice-heading">Choice</h2>
        <p>No plan is in memory yet. Go back and open a report from Context.</p>
        <ForecastCockpit cockpit={cockpit} uncertainty={uncertainty} />
      </section>
    )
  }

  return (
    <section className="phase choice-phase" aria-labelledby="choice-heading">
      <header className="phase-header">
        <h2 id="choice-heading">Choice</h2>
        <p>
          These steps are suggestions seeded from your focus intention. Accept
          them, dismiss them, or leave them proposed. None of this runs on its
          own, and none of it is required to continue.
        </p>
      </header>
      <FreeWillBanner />
      <ForecastCockpit cockpit={cockpit} uncertainty={uncertainty} />
      <p className="plan-note">{plan.freeWillNote}</p>
      <ol className="step-list">
        {plan.steps.map((step, index) => (
          <li key={step.id} className={`plan-step is-${step.status}`}>
            <header>
              <span className="step-ordinal">{index + 1}</span>
              <h3>{step.title}</h3>
              <p className="step-status">Currently {step.status}</p>
            </header>
            <p>{step.rationale}</p>
            <div className="step-actions" role="group" aria-label={`${step.title} status`}>
              {STATUS_ACTIONS.map((action) => (
                <button
                  key={action.status}
                  type="button"
                  className={
                    step.status === action.status ? 'is-pressed' : undefined
                  }
                  aria-pressed={step.status === action.status}
                  onClick={() =>
                    dispatch({
                      type: 'SET_STEP_STATUS',
                      stepId: step.id,
                      status: action.status,
                    })
                  }
                >
                  {action.label}
                </button>
              ))}
              {step.origin === 'custom' ? (
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'REMOVE_CUSTOM_STEP', stepId: step.id })
                  }
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor={`${step.id}-note`}>Personal note (optional)</label>
              <textarea
                id={`${step.id}-note`}
                rows={2}
                value={step.userNote}
                onChange={(event) =>
                  dispatch({
                    type: 'SET_STEP_NOTE',
                    stepId: step.id,
                    userNote: event.target.value,
                  })
                }
                placeholder={
                  hasPersistenceConsent(state.persistence) &&
                  !(
                    state.persistence.kind === 'error' &&
                    state.persistence.operation === 'erase'
                  )
                    ? 'A reminder for you. It is stored with this session on this device.'
                    : 'A reminder for you. It stays in this tab unless you choose to save.'
                }
              />
            </div>
          </li>
        ))}
      </ol>
      <form
        className="add-step-form"
        onSubmit={(event) => {
          event.preventDefault()
          const title = draftTitle.trim()
          if (title.length === 0) {
            return
          }
          dispatch({
            type: 'ADD_CUSTOM_STEP',
            stepId: createCustomStepId(),
            title,
            userNote: draftNote,
          })
          setDraftTitle('')
          setDraftNote('')
        }}
      >
        <h3>Add your own step</h3>
        <p>
          A personal step stays tagged as yours. Regenerating a fixture reading
          will not silently discard it. You can remove it whenever you want.
        </p>
        <div className="field">
          <label htmlFor="custom-step-title">Step title</label>
          <input
            id="custom-step-title"
            type="text"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Something you might actually do"
          />
        </div>
        <div className="field">
          <label htmlFor="custom-step-note">Note (optional)</label>
          <textarea
            id="custom-step-note"
            rows={2}
            value={draftNote}
            onChange={(event) => setDraftNote(event.target.value)}
            placeholder="A reminder for you. Optional."
          />
        </div>
        <button
          type="submit"
          className="primary"
          disabled={draftTitle.trim().length === 0}
        >
          Add step
        </button>
      </form>
    </section>
  )
}
