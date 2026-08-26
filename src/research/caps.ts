import { HORIZON_BY_ID } from '../fixtures/horizons.ts'
import type { HorizonId } from '../domain/types.ts'
import type { HorizonCaps } from './contract.ts'

export const HORIZON_CAPS: Record<HorizonId, HorizonCaps> = {
  daily: {
    maxSources: 4,
    maxQueries: 3,
    maxNovelDomains: 3,
    timeoutMs: 12_000,
  },
  weekly: {
    maxSources: 5,
    maxQueries: 4,
    maxNovelDomains: 4,
    timeoutMs: 15_000,
  },
  yearly: {
    maxSources: 6,
    maxQueries: 4,
    maxNovelDomains: 5,
    timeoutMs: 18_000,
  },
}

export const NON_EXHAUSTIVE =
  'This is not an exhaustive search of the internet.'

export function timeWindowFor(horizon: HorizonId): string {
  return HORIZON_BY_ID[horizon].windowDescription
}

export function timeoutSeconds(horizon: HorizonId): number {
  return HORIZON_CAPS[horizon].timeoutMs / 1000
}
