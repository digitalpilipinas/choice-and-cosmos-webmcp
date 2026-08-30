import {
  GLOBAL_DAILY_LIMIT,
  GLOBAL_QUOTA_HASH,
  QUOTA_RELEASE_FAILED_REASON,
  VISITOR_DAILY_LIMIT,
  type QuotaReleaseResult,
  type QuotaReserveResult,
  type QuotaRow,
  type QuotaStore,
} from './quota.ts'

function keyFor(day: string, bucket: QuotaRow['bucket'], hash: string): string {
  return `${day}\0${bucket}\0${hash}`
}

export function createMemoryQuotaStore(
  seed: readonly QuotaRow[] = [],
): QuotaStore {
  const rows = new Map<string, QuotaRow>()
  for (const row of seed) {
    rows.set(keyFor(row.day, row.bucket, row.hash), { ...row })
  }

  const release = async (
    day: string,
    visitorHash: string,
  ): Promise<QuotaReleaseResult> => {
    const visitorKey = keyFor(day, 'visitor', visitorHash)
    const globalKey = keyFor(day, 'global', GLOBAL_QUOTA_HASH)
    const visitor = rows.get(visitorKey)
    const global = rows.get(globalKey)
    if (
      visitor === undefined ||
      global === undefined ||
      visitor.counter < 1 ||
      global.counter < 1
    ) {
      return { kind: 'unavailable', reason: QUOTA_RELEASE_FAILED_REASON }
    }
    rows.set(visitorKey, { ...visitor, counter: visitor.counter - 1 })
    rows.set(globalKey, { ...global, counter: global.counter - 1 })
    return { kind: 'released' }
  }

  return {
    async reserve(day, visitorHash, signal): Promise<QuotaReserveResult> {
      const visitorKey = keyFor(day, 'visitor', visitorHash)
      const globalKey = keyFor(day, 'global', GLOBAL_QUOTA_HASH)
      if (signal?.aborted) {
        return { kind: 'aborted' }
      }
      const visitor = rows.get(visitorKey) ?? {
        day,
        bucket: 'visitor' as const,
        hash: visitorHash,
        counter: 0,
      }
      const global = rows.get(globalKey) ?? {
        day,
        bucket: 'global' as const,
        hash: GLOBAL_QUOTA_HASH,
        counter: 0,
      }
      if (visitor.counter >= VISITOR_DAILY_LIMIT) {
        return { kind: 'quota_exceeded', scope: 'visitor' }
      }
      if (global.counter >= GLOBAL_DAILY_LIMIT) {
        return { kind: 'quota_exceeded', scope: 'global' }
      }
      if (signal?.aborted) {
        return { kind: 'aborted' }
      }
      const nextVisitor = { ...visitor, counter: visitor.counter + 1 }
      const nextGlobal = { ...global, counter: global.counter + 1 }
      rows.set(visitorKey, nextVisitor)
      rows.set(globalKey, nextGlobal)
      if (signal?.aborted) {
        const released = await release(day, visitorHash)
        if (released.kind !== 'released') {
          return { kind: 'unavailable', reason: released.reason }
        }
        return { kind: 'aborted' }
      }
      return { kind: 'reserved', visitor: nextVisitor, global: nextGlobal }
    },
    release,
    async snapshot(): Promise<readonly QuotaRow[]> {
      return [...rows.values()].map((row) => ({ ...row }))
    },
  }
}
