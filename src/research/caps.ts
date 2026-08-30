import { HORIZON_BY_ID } from '../fixtures/horizons.ts'
import type { HorizonId } from '../domain/types.ts'
import type { HorizonCaps } from './contract.ts'

export const HORIZON_CAPS: Record<HorizonId, HorizonCaps> = {
  daily: {
    maxSources: 12,
    maxQueries: 4,
    maxNovelDomains: 4,
    timeoutMs: 20_000,
  },
  weekly: {
    maxSources: 24,
    maxQueries: 6,
    maxNovelDomains: 8,
    timeoutMs: 30_000,
  },
  yearly: {
    maxSources: 36,
    maxQueries: 8,
    maxNovelDomains: 12,
    timeoutMs: 45_000,
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
