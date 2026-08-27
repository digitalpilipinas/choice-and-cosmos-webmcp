import { useCallback, useEffect, useRef, useState } from 'react'
import {
  postResearch,
  researchClientCancelled,
  type ResearchClientDeps,
} from '../../research/client.ts'
import {
  RESEARCH_IDLE,
  beginConfirm,
  beginFlight,
  completeFlight,
  denyConfirm,
  researchRequestFromSession,
  type ContrastResearchSession,
} from '../../research/session.ts'
import type { HorizonId } from '../../domain/types.ts'

export interface ContrastResearchInput {
  query: string
  horizon: HorizonId
}

export interface ContrastResearchApi {
  session: ContrastResearchSession
  requestSearch: () => void
  approve: () => void
  deny: () => void
  cancel: () => void
}

export function useContrastResearch(
  input: ContrastResearchInput,
  deps?: ResearchClientDeps,
): ContrastResearchApi {
  const identity = `${input.query}\0${input.horizon}`
  const [seenIdentity, setSeenIdentity] = useState(identity)
  const [session, setSession] = useState<ContrastResearchSession>(RESEARCH_IDLE)
  const abortRef = useRef<AbortController | null>(null)
  const fetchImpl = deps?.fetchImpl

  if (seenIdentity !== identity) {
    setSeenIdentity(identity)
    setSession(RESEARCH_IDLE)
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [identity])

  const requestSearch = useCallback(() => {
    setSession((current) => beginConfirm(current, input.query, input.horizon))
  }, [input.query, input.horizon])

  const deny = useCallback(() => {
    setSession(denyConfirm)
  }, [])

  const approve = useCallback(() => {
    if (session.status !== 'confirming') {
      return
    }
    const request = researchRequestFromSession(session)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSession(beginFlight(session))
    void postResearch(request, { fetchImpl, signal: controller.signal }).then(
      (result) => {
        setSession((latest) => completeFlight(latest, result))
      },
    )
  }, [session, fetchImpl])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setSession((current) => {
      if (current.status !== 'in_flight') {
        return current
      }
      return completeFlight(
        current,
        researchClientCancelled('Research was cancelled. No live search completed.'),
      )
    })
  }, [])

  return { session, requestSearch, approve, deny, cancel }
}
