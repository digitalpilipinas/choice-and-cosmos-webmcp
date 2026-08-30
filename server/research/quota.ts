export const VISITOR_DAILY_LIMIT = 3
export const GLOBAL_DAILY_LIMIT = 100
export const GLOBAL_QUOTA_HASH = 'global'
export const QUOTA_RELEASE_ATTEMPTS = 3

export type QuotaBucket = 'visitor' | 'global'

export interface QuotaRow {
  day: string
  bucket: QuotaBucket
  hash: string
  counter: number
}

export type QuotaReserveResult =
  | { kind: 'reserved'; visitor: QuotaRow; global: QuotaRow }
  | { kind: 'quota_exceeded'; scope: QuotaBucket }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'aborted' }

export type QuotaReleaseResult =
  | { kind: 'released' }
  | { kind: 'unavailable'; reason: string }

export interface QuotaStore {
  reserve(
    day: string,
    visitorHash: string,
    signal?: AbortSignal,
  ): Promise<QuotaReserveResult>
  release(day: string, visitorHash: string): Promise<QuotaReleaseResult>
  snapshot(): Promise<readonly QuotaRow[]>
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export async function hashVisitorIdentity(
  identity: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(identity),
  )
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function quotaRowKeys(row: QuotaRow): string[] {
  return Object.keys(row)
}

export const QUOTA_RELEASE_FAILED_REASON =
  'Quota reservation could not be released. The held slot may remain consumed. No provider call was made.'
