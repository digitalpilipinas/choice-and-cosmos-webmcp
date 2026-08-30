import { createMemoryQuotaStore } from '../../server/research/quotaMemory.ts'
import type { ResearchDeps, ResearchEnv } from '../../server/research/run.ts'
import type { PersonalizedRequest, ResearchBrief } from '../../src/research/contract.ts'
import { ALWAYS_LENSES } from '../../src/research/lenses.ts'

export const TEST_KEY = 'sk-test-gemini-not-real-xyz'
export const TEST_SECRET = 'quota-hash-secret-not-real'
export const TEST_IP = '203.0.113.10'

export function liveEnv(overrides: Partial<ResearchEnv> = {}): ResearchEnv {
  return {
    GEMINI_API_KEY: TEST_KEY,
    RESEARCH_ENABLED: 'true',
    QUOTA_HASH_SECRET: TEST_SECRET,
    ...overrides,
  }
}

export function liveDeps(overrides: Partial<ResearchDeps> = {}): ResearchDeps {
  return {
    env: liveEnv(),
    quota: createMemoryQuotaStore(),
    trustedVisitorIp: TEST_IP,
    ...overrides,
  }
}

export function sampleBrief(
  overrides: Partial<ResearchBrief> = {},
): ResearchBrief {
  return {
    schemaVersion: 2,
    horizon: 'daily',
    focus: 'stay with the draft',
    tone: 'grounded',
    cosmic: { sunSign: 'leo' },
    requestedLenses: [...ALWAYS_LENSES, 'westernAstrology', 'numerology'],
    ...overrides,
  }
}

export function samplePersonalized(
  overrides: Partial<PersonalizedRequest> = {},
): PersonalizedRequest {
  return {
    schemaVersion: 2,
    mode: 'auto',
    brief: sampleBrief(),
    manualUrls: [],
    ...overrides,
  }
}
