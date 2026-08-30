import type { ResearchEnv } from './run.ts'
import type { QuotaStore } from './quota.ts'

export type LiveGate =
  | { kind: 'ok'; apiKey: string; secret: string; quota: QuotaStore; visitorIp: string }
  | { kind: 'disabled'; reason: string }
  | { kind: 'unavailable'; reason: string }

export function isResearchEnabled(env: ResearchEnv): boolean {
  return env.RESEARCH_ENABLED === 'true'
}

export function liveGate(input: {
  env: ResearchEnv
  quota?: QuotaStore
  trustedVisitorIp?: string | null
}): LiveGate {
  if (!isResearchEnabled(input.env)) {
    return {
      kind: 'disabled',
      reason:
        'Personalized Gemini research is disabled. This is the default-off server path. Explicit fixture or manual mode still works and is not personalized.',
    }
  }

  const apiKey = input.env.GEMINI_API_KEY?.trim() ?? ''
  const secret = input.env.QUOTA_HASH_SECRET?.trim() ?? ''
  const visitorIp = input.trustedVisitorIp?.trim() ?? ''
  const missing: string[] = []
  if (apiKey.length === 0) {
    missing.push('Gemini key')
  }
  if (secret.length === 0) {
    missing.push('quota hash secret')
  }
  if (input.quota === undefined) {
    missing.push('D1 quota store')
  }
  if (visitorIp.length === 0) {
    missing.push('trusted visitor identity')
  }
  if (missing.length > 0 || input.quota === undefined) {
    return {
      kind: 'unavailable',
      reason: `Personalized Gemini research is unavailable because ${missing.join(', ')} is missing. No fixture fallback was used.`,
    }
  }

  return {
    kind: 'ok',
    apiKey,
    secret,
    quota: input.quota,
    visitorIp,
  }
}
