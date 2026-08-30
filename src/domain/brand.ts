declare const persistable: unique symbol
declare const memoryOnly: unique symbol

export type Persistable<T> = T & { readonly [persistable]?: true }
export type MemoryOnly<T> = T & { readonly [memoryOnly]?: true }

export type Instant = number & { readonly __brand: 'Instant' }
export type ConfirmationId = string & { readonly __brand: 'ConfirmationId' }
export type PacketDigest = string & { readonly __brand: 'PacketDigest' }
export type BriefDigest = string & { readonly __brand: 'BriefDigest' }
export type EvidenceId = string & { readonly __brand: 'EvidenceId' }
export type SafeHttpsUrl = string & { readonly __brand: 'SafeHttpsUrl' }

export const STAGED_TTL_MS = 30 * 60 * 1000

export function asInstant(ms: number): Instant | null {
  if (!Number.isFinite(ms)) {
    return null
  }
  return ms as Instant
}

export function mustInstant(ms: number): Instant {
  const instant = asInstant(ms)
  if (instant === null) {
    throw new Error('Instant must be a finite epoch millisecond.')
  }
  return instant
}
