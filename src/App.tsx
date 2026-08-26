import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type Dispatch,
} from 'react'
import { AgentBar } from './components/AgentBar.tsx'
import { PersistenceBar } from './components/PersistenceBar.tsx'
import { PhaseStepper } from './components/PhaseStepper.tsx'
import { ChoicePhase } from './components/phases/ChoicePhase.tsx'
import { ContextPhase } from './components/phases/ContextPhase.tsx'
import { ContinuityPhase } from './components/phases/ContinuityPhase.tsx'
import { ContrastPhase } from './components/phases/ContrastPhase.tsx'
import { CosmosPhase } from './components/phases/CosmosPhase.tsx'
import type { PhaseProps } from './components/phases/phaseProps.ts'
import {
  INITIAL_STATE,
  appReducer,
  blocksDelayedHydrate,
  canAdvance,
  type AppAction,
} from './domain/loop.ts'
import {
  currentPlan,
  hasPersistenceConsent,
  persistSessionOffered,
} from './domain/selectors.ts'
import type { PhaseId } from './domain/types.ts'
import {
  actionFromBootstrap,
  bootstrapPersistence,
  clearSavedData,
  declineConsent,
  grantConsentAndSave,
  saveSession,
} from './persistence/sessionStore.ts'
import {
  AGENT_REGISTER_FAILED_REASON,
  detectModelContext,
} from './webmcp/detect.ts'
import { registerCatalog } from './webmcp/host.ts'
import './App.css'

const PHASE_VIEWS: Record<PhaseId, ComponentType<PhaseProps>> = {
  context: ContextPhase,
  cosmos: CosmosPhase,
  contrast: ContrastPhase,
  choice: ChoicePhase,
  continuity: ContinuityPhase,
}

const CONTINUE_LABEL: Record<Exclude<PhaseId, 'continuity'>, string> = {
  context: 'Open the cosmos',
  cosmos: 'See the contrast',
  contrast: 'Choose your steps',
  choice: 'Review this session',
}

function dispatchSaveResult(
  dispatch: Dispatch<AppAction>,
  result: { savedAt: string } | { error: string },
) {
  if ('savedAt' in result) {
    dispatch({ type: 'PERSISTENCE_SAVE_SUCCESS', savedAt: result.savedAt })
  } else {
    dispatch({ type: 'PERSISTENCE_SAVE_ERROR', message: result.error })
  }
}

function App() {
  const stateRef = useRef(INITIAL_STATE)
  const sessionEditedRef = useRef(false)
  const [state, setState] = useState(INITIAL_STATE)
  const PhaseView = PHASE_VIEWS[state.phase]
  const forwardEnabled = canAdvance(state)
  const persistenceConsent = hasPersistenceConsent(state.persistence)
  const eraseFailed =
    state.persistence.kind === 'error' &&
    state.persistence.operation === 'erase'

  const dispatch = useCallback((action: AppAction) => {
    if (blocksDelayedHydrate(action)) {
      sessionEditedRef.current = true
    }
    const next = appReducer(stateRef.current, action)
    stateRef.current = next
    setState(next)
  }, [])

  useEffect(() => {
    let cancelled = false

    void bootstrapPersistence().then((result) => {
      if (cancelled) {
        return
      }
      dispatch(actionFromBootstrap(result, sessionEditedRef.current))
    })

    return () => {
      cancelled = true
    }
  }, [dispatch])

  useEffect(() => {
    const detected = detectModelContext(document)
    if (detected.kind === 'unavailable') {
      dispatch({
        type: 'SET_AGENT_AVAILABILITY',
        availability: { kind: 'unavailable', reason: detected.reason },
      })
      return
    }

    const controller = new AbortController()
    let cancelled = false
    void registerCatalog(
      detected.modelContext,
      {
        getState: () => stateRef.current,
        dispatch,
      },
      controller.signal,
    ).then(
      () => {
        if (cancelled) {
          return
        }
        dispatch({
          type: 'SET_AGENT_AVAILABILITY',
          availability: { kind: 'ready' },
        })
      },
      () => {
        if (cancelled) {
          return
        }
        controller.abort()
        dispatch({
          type: 'SET_AGENT_AVAILABILITY',
          availability: {
            kind: 'unavailable',
            reason: AGENT_REGISTER_FAILED_REASON,
          },
        })
      },
    )

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [dispatch])

  useEffect(() => {
    if (!persistenceConsent || eraseFailed) {
      return
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      dispatch({ type: 'PERSISTENCE_SAVE_START' })
      void saveSession({
        phase: state.phase,
        horizon: state.horizon,
        profile: state.profile,
        forecastsByHorizon: state.forecastsByHorizon,
        plansByHorizon: state.plansByHorizon,
      }).then((result) => {
        if (cancelled) {
          return
        }
        dispatchSaveResult(dispatch, result)
      })
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [
    dispatch,
    persistenceConsent,
    eraseFailed,
    state.phase,
    state.horizon,
    state.profile,
    state.forecastsByHorizon,
    state.plansByHorizon,
  ])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to the loop
      </a>
      <header className="app-header">
        <p className="eyebrow">Choice &amp; Cosmos · fixture preview</p>
        <h1>A reflective loop, not a verdict</h1>
        <p className="lede">
          Context, Cosmos, Contrast, Choice, Continuity. All data in this
          preview is local and made-up. Nothing ever leaves this device. Saving
          to this browser is optional and reversible. Agent tools, when this
          browser offers them, still wait for your confirmation before reading
          personal details, sharing, or saving a plan.
        </p>
      </header>

      <PersistenceBar
        persistence={state.persistence}
        onGrant={() => {
          dispatch({ type: 'GRANT_PERSISTENCE_CONSENT' })
          void grantConsentAndSave(stateRef.current).then((result) => {
            dispatchSaveResult(dispatch, result)
          })
        }}
        onDecline={() => {
          void declineConsent().then((result) => {
            if ('error' in result) {
              dispatch({
                type: 'PERSISTENCE_DECLINE_ERROR',
                message: result.error,
              })
              return
            }
            dispatch({ type: 'DECLINE_PERSISTENCE_CONSENT' })
          })
        }}
        onRetry={() => {
          dispatch({ type: 'PERSISTENCE_SAVE_START' })
          void saveSession(stateRef.current).then((result) => {
            dispatchSaveResult(dispatch, result)
          })
        }}
        onClear={() => {
          void clearSavedData().then((result) => {
            if ('error' in result) {
              dispatch({
                type: 'PERSISTENCE_ERASE_ERROR',
                message: result.error,
              })
              return
            }
            dispatch({ type: 'CLEAR_SAVED_DATA' })
          })
        }}
      />

      <AgentBar
        availability={state.agentAvailability}
        confirmation={state.confirmation}
        profile={state.profile}
        plan={currentPlan(state)}
        persistence={state.persistence}
        onApprove={(id, persistSession) => {
          const live = stateRef.current
          dispatch({ type: 'APPROVE_CONFIRMATION', id, persistSession })
          if (
            persistSession &&
            live.confirmation.status === 'pending' &&
            live.confirmation.id === id &&
            persistSessionOffered(live.confirmation, live.persistence)
          ) {
            void grantConsentAndSave(stateRef.current).then((result) => {
              dispatchSaveResult(dispatch, result)
            })
          }
        }}
        onDeny={(id) => dispatch({ type: 'DENY_CONFIRMATION', id })}
      />

      <PhaseStepper phase={state.phase} />
      <main id="main-content">
        <PhaseView state={state} dispatch={dispatch} />
      </main>

      <nav className="wizard-nav" aria-label="Phase controls">
        <button
          type="button"
          onClick={() => dispatch({ type: 'BACK' })}
          disabled={state.phase === 'context'}
        >
          Back
        </button>
        {state.phase === 'continuity' ? (
          <p className="nav-hint">
            Use Start a new reflection above if you want another pass.
          </p>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={() => dispatch({ type: 'ADVANCE' })}
            disabled={!forwardEnabled}
          >
            {CONTINUE_LABEL[state.phase]}
          </button>
        )}
      </nav>
      {state.phase === 'context' && !forwardEnabled ? (
        <p className="nav-hint" id="advance-hint">
          Write a focus intention to continue. The horizon is already chosen.
        </p>
      ) : null}
    </div>
  )
}

export default App
