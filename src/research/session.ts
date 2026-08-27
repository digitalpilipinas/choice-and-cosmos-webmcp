import type { HorizonId } from '../domain/types.ts'
import type { ResearchRequestInput, ResearchResult } from './contract.ts'

export type ContrastResearchSession =
  | { status: 'idle' }
  | { status: 'confirming'; query: string; horizon: HorizonId }
  | { status: 'in_flight'; query: string; horizon: HorizonId }
  | {
      status: 'complete'
      query: string
      horizon: HorizonId
      result: ResearchResult
    }

export const RESEARCH_IDLE: ContrastResearchSession = { status: 'idle' }

export function beginConfirm(
  session: ContrastResearchSession,
  query: string,
  horizon: HorizonId,
): ContrastResearchSession {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return session
  }
  if (session.status === 'in_flight' || session.status === 'confirming') {
    return session
  }
  return { status: 'confirming', query: trimmed, horizon }
}

export function denyConfirm(
  session: ContrastResearchSession,
): ContrastResearchSession {
  if (session.status !== 'confirming') {
    return session
  }
  return RESEARCH_IDLE
}

export function beginFlight(
  session: ContrastResearchSession,
): ContrastResearchSession {
  if (session.status !== 'confirming') {
    return session
  }
  return {
    status: 'in_flight',
    query: session.query,
    horizon: session.horizon,
  }
}

export function completeFlight(
  session: ContrastResearchSession,
  result: ResearchResult,
): ContrastResearchSession {
  if (session.status !== 'in_flight') {
    return session
  }
  return {
    status: 'complete',
    query: session.query,
    horizon: session.horizon,
    result,
  }
}

export function researchRequestFromSession(
  session: Extract<
    ContrastResearchSession,
    { status: 'confirming' | 'in_flight' }
  >,
): ResearchRequestInput {
  return {
    horizon: session.horizon,
    query: session.query,
    mode: 'auto',
    manualUrls: [],
  }
}
