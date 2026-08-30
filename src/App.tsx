import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
} from 'react'
import { AgentBar } from './components/AgentBar.tsx'
import { PersistenceBar } from './components/PersistenceBar.tsx'
import { StudioShell } from './components/StudioShell.tsx'
import {
  INITIAL_STATE,
  appReducer,
  blocksDelayedHydrate,
  type AppAction,
} from './domain/loop.ts'
import {
  currentPlan,
  persistSessionOffered,
} from './domain/selectors.ts'
import {
  actionFromBootstrap,
  bootstrapPersistence,
  clearSavedData,
  declineConsent,
  grantConsentAndSave,
  saveSession,
  sessionFieldsOf,
} from './persistence/sessionStore.ts'
import {
  AGENT_REGISTER_FAILED_REASON,
  detectModelContext,
} from './webmcp/detect.ts'
import { registerCatalog } from './webmcp/host.ts'
import './App.css'

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

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to the loop
      </a>
      <header className="app-header">
        <p className="eyebrow">Choice &amp; Cosmos</p>
        <h1>A reflective loop, not a verdict</h1>
        <p className="lede">
          Context, Cosmos, Contrast, Choice, Continuity. An adopted packet is
          the canonical reading. Fixture output stays labeled legacy. Saving
          to this browser is optional and reversible. Agent tools, when this
          browser offers them, still wait for your confirmation before reading
          personal details, sharing, or saving a plan.
        </p>
      </header>

      <PersistenceBar
        persistence={state.persistence}
        session={sessionFieldsOf(state)}
        dispatch={dispatch}
        onGrant={() => {
          dispatch({ type: 'GRANT_PERSISTENCE_CONSENT' })
          void grantConsentAndSave(sessionFieldsOf(stateRef.current)).then(
            (result) => {
              dispatchSaveResult(dispatch, result)
            },
          )
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
          void saveSession(sessionFieldsOf(stateRef.current)).then((result) => {
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
            void grantConsentAndSave(sessionFieldsOf(stateRef.current)).then(
              (result) => {
                dispatchSaveResult(dispatch, result)
              },
            )
          }
        }}
        onDeny={(id) => dispatch({ type: 'DENY_CONFIRMATION', id })}
      />

      <StudioShell state={state} dispatch={dispatch} />
    </div>
  )
}

export default App
