import { timeWindowFor } from './caps.ts'
import {
  type ResearchCoverage,
  type ResearchRequestInput,
  type ResearchResult,
} from './contract.ts'

export interface ResearchClientDeps {
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

export async function postResearch(
  input: ResearchRequestInput,
  _deps?: ResearchClientDeps,
): Promise<ResearchResult> {
  return researchRouteUnavailable(
    'Hosted research is not available in this preview. No live search occurred.',
    input,
  )
}

export function researchRouteUnavailable(
  reason: string,
  input?: Pick<ResearchRequestInput, 'horizon'>,
): Extract<ResearchResult, { outcome: 'unavailable' }> {
  return {
    outcome: 'unavailable',
    reason,
    sources: [],
    coverage: emptyCoverage(reason, input?.horizon),
    modelText: '',
  }
}

export function researchClientCancelled(
  reason: string,
  input?: Pick<ResearchRequestInput, 'horizon'>,
): Extract<ResearchResult, { outcome: 'cancelled' }> {
  return {
    outcome: 'cancelled',
    reason,
    sources: [],
    coverage: emptyCoverage(reason, input?.horizon),
    modelText: '',
  }
}

function emptyCoverage(
  reason: string,
  horizon?: ResearchRequestInput['horizon'],
): ResearchCoverage {
  return {
    sourcesConsidered: 0,
    sourcesUsed: 0,
    queriesUsed: 0,
    novelDomainsUsed: 0,
    timeWindowDescription:
      horizon === undefined ? 'No search window was used.' : timeWindowFor(horizon),
    stoppingReason: reason,
    mode: 'fixture',
    exhaustive: false,
  }
}
