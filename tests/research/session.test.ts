import { describe, expect, it } from 'vitest'
import type { ResearchResult } from '../../src/research/contract.ts'
import {
  RESEARCH_IDLE,
  beginConfirm,
  beginFlight,
  completeFlight,
  denyConfirm,
  researchRequestFromSession,
} from '../../src/research/session.ts'

const ready: ResearchResult = {
  outcome: 'ready',
  sources: [],
  coverage: {
    sourcesConsidered: 0,
    sourcesUsed: 0,
    queriesUsed: 0,
    novelDomainsUsed: 0,
    timeWindowDescription: 'Today into tomorrow morning',
    stoppingReason: 'none',
    mode: 'fixture',
    exhaustive: false,
  },
  modelText: '',
}

describe('contrast research session', () => {
  it('returns idle when denyConfirm runs from confirming', () => {
    const confirming = beginConfirm(RESEARCH_IDLE, 'finish the draft', 'daily')
    expect(denyConfirm(confirming)).toEqual({ status: 'idle' })
  })

  it('leaves idle unchanged when completeFlight runs', () => {
    expect(completeFlight(RESEARCH_IDLE, ready)).toEqual({ status: 'idle' })
  })

  it('leaves the session unchanged when beginConfirm gets an empty query', () => {
    expect(beginConfirm(RESEARCH_IDLE, '   ', 'weekly')).toEqual({
      status: 'idle',
    })
  })

  it('starts a flight only from confirming', () => {
    expect(beginFlight(RESEARCH_IDLE)).toEqual({ status: 'idle' })
    const confirming = beginConfirm(RESEARCH_IDLE, 'finish the draft', 'yearly')
    expect(beginFlight(confirming)).toEqual({
      status: 'in_flight',
      query: 'finish the draft',
      horizon: 'yearly',
    })
    const inFlight = beginFlight(confirming)
    expect(beginFlight(inFlight)).toEqual(inFlight)
  })

  it('builds an auto request with empty manual URLs', () => {
    const confirming = beginConfirm(RESEARCH_IDLE, 'finish the draft', 'daily')
    if (confirming.status !== 'confirming') {
      throw new Error('expected confirming')
    }
    expect(researchRequestFromSession(confirming)).toEqual({
      horizon: 'daily',
      query: 'finish the draft',
      mode: 'auto',
      manualUrls: [],
    })
    const inFlight = beginFlight(confirming)
    if (inFlight.status !== 'in_flight') {
      throw new Error('expected in_flight')
    }
    expect(researchRequestFromSession(inFlight)).toEqual({
      horizon: 'daily',
      query: 'finish the draft',
      mode: 'auto',
      manualUrls: [],
    })
  })
})
