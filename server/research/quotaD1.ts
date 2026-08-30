import {
  GLOBAL_DAILY_LIMIT,
  GLOBAL_QUOTA_HASH,
  QUOTA_RELEASE_ATTEMPTS,
  QUOTA_RELEASE_FAILED_REASON,
  VISITOR_DAILY_LIMIT,
  type QuotaReleaseResult,
  type QuotaReserveResult,
  type QuotaRow,
  type QuotaStore,
} from './quota.ts'

export interface D1Meta {
  changes: number
}

export interface D1StatementResult<T = unknown> {
  meta: D1Meta
  results: T[]
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  run<T = unknown>(): Promise<D1StatementResult<T>>
  all<T = unknown>(): Promise<D1StatementResult<T>>
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(
    statements: D1PreparedStatement[],
  ): Promise<Array<D1StatementResult<T>>>
}

export const QUOTA_INCREMENT_SQL = `
INSERT INTO quota_counters (day, bucket, hash, counter)
VALUES (?1, ?2, ?3, 1)
ON CONFLICT(day, bucket, hash) DO UPDATE
SET counter = counter + 1
WHERE quota_counters.counter < ?4
`.trim()

export const QUOTA_DECREMENT_SQL = `
UPDATE quota_counters
SET counter = counter - 1
WHERE day = ?1 AND bucket = ?2 AND hash = ?3 AND counter > 0
`.trim()

export const QUOTA_SELECT_SQL = `
SELECT day, bucket, hash, counter
FROM quota_counters
WHERE day = ?1 AND bucket = ?2 AND hash = ?3
`.trim()

const SNAPSHOT_SQL = `
SELECT day, bucket, hash, counter FROM quota_counters
`.trim()

export const QUOTA_ABORT_VISITOR_SQL = `
INSERT INTO quota_counters (day, bucket, hash, counter)
SELECT NULL, 'visitor', 'visitor_quota_exceeded', 0
WHERE changes() < 1
`.trim()

export const QUOTA_ABORT_GLOBAL_SQL = `
INSERT INTO quota_counters (day, bucket, hash, counter)
SELECT 'global_quota_exceeded', NULL, 'global_quota_exceeded', 0
WHERE changes() < 1
`.trim()

export const QUOTA_ABORT_READBACK_SQL = `
INSERT INTO quota_counters (day, bucket, hash, counter)
SELECT 'quota_readback_failed', 'visitor', NULL, 0
WHERE (
  SELECT COUNT(*) FROM quota_counters WHERE day = ?1 AND bucket = 'visitor' AND hash = ?2
) = 0
OR (
  SELECT COUNT(*) FROM quota_counters WHERE day = ?1 AND bucket = 'global' AND hash = ?3
) = 0
`.trim()

export const QUOTA_ABORT_RELEASE_SQL = `
INSERT INTO quota_counters (day, bucket, hash, counter)
SELECT 'quota_release_failed', 'visitor', 'quota_release_failed', -1
WHERE changes() < 1
`.trim()

export function createD1QuotaStore(db: D1Database): QuotaStore {
  const releaseOnce = async (
    day: string,
    visitorHash: string,
  ): Promise<QuotaReleaseResult> => {
    try {
      await db.batch([
        db.prepare(QUOTA_DECREMENT_SQL).bind(day, 'visitor', visitorHash),
        db.prepare(QUOTA_ABORT_RELEASE_SQL),
        db.prepare(QUOTA_DECREMENT_SQL).bind(day, 'global', GLOBAL_QUOTA_HASH),
        db.prepare(QUOTA_ABORT_RELEASE_SQL),
      ])
      return { kind: 'released' }
    } catch {
      return { kind: 'unavailable', reason: QUOTA_RELEASE_FAILED_REASON }
    }
  }

  const release = async (
    day: string,
    visitorHash: string,
  ): Promise<QuotaReleaseResult> => {
    let last: QuotaReleaseResult = {
      kind: 'unavailable',
      reason: QUOTA_RELEASE_FAILED_REASON,
    }
    for (let attempt = 0; attempt < QUOTA_RELEASE_ATTEMPTS; attempt += 1) {
      last = await releaseOnce(day, visitorHash)
      if (last.kind === 'released') {
        return last
      }
    }
    return last
  }

  return {
    async reserve(day, visitorHash, signal): Promise<QuotaReserveResult> {
      if (signal?.aborted) {
        return { kind: 'aborted' }
      }
      let results: Array<D1StatementResult>
      try {
        results = await db.batch([
          db
            .prepare(QUOTA_INCREMENT_SQL)
            .bind(day, 'visitor', visitorHash, VISITOR_DAILY_LIMIT),
          db.prepare(QUOTA_ABORT_VISITOR_SQL),
          db
            .prepare(QUOTA_INCREMENT_SQL)
            .bind(day, 'global', GLOBAL_QUOTA_HASH, GLOBAL_DAILY_LIMIT),
          db.prepare(QUOTA_ABORT_GLOBAL_SQL),
          db.prepare(QUOTA_SELECT_SQL).bind(day, 'visitor', visitorHash),
          db.prepare(QUOTA_SELECT_SQL).bind(day, 'global', GLOBAL_QUOTA_HASH),
          db
            .prepare(QUOTA_ABORT_READBACK_SQL)
            .bind(day, visitorHash, GLOBAL_QUOTA_HASH),
        ])
      } catch (error) {
        const capped = quotaExceededFromBatch(error)
        if (capped !== null) {
          return capped
        }
        return {
          kind: 'unavailable',
          reason: 'The quota store could not complete a transactional reservation.',
        }
      }

      const visitor = asQuotaRow(results[4]?.results[0])
      const global = asQuotaRow(results[5]?.results[0])
      if (visitor === null || global === null) {
        const released = await release(day, visitorHash)
        if (released.kind !== 'released') {
          return {
            kind: 'unavailable',
            reason:
              'Quota counters could not be read after reservation, and release failed. A slot may still be held.',
          }
        }
        return {
          kind: 'unavailable',
          reason: 'Quota counters could not be read after reservation.',
        }
      }
      if (signal?.aborted) {
        const released = await release(day, visitorHash)
        if (released.kind !== 'released') {
          return { kind: 'unavailable', reason: released.reason }
        }
        return { kind: 'aborted' }
      }
      return { kind: 'reserved', visitor, global }
    },
    release,
    async snapshot(): Promise<readonly QuotaRow[]> {
      const result = await db.prepare(SNAPSHOT_SQL).all<QuotaRow>()
      return result.results.map(asQuotaRow).filter((row) => row !== null)
    },
  }
}

function quotaExceededFromBatch(
  error: unknown,
): Extract<QuotaReserveResult, { kind: 'quota_exceeded' }> | null {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('quota_counters.day')) {
    return { kind: 'quota_exceeded', scope: 'visitor' }
  }
  if (message.includes('quota_counters.bucket')) {
    return { kind: 'quota_exceeded', scope: 'global' }
  }
  return null
}

function asQuotaRow(value: unknown): QuotaRow | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (
    keys.length !== 4 ||
    !keys.includes('day') ||
    !keys.includes('bucket') ||
    !keys.includes('hash') ||
    !keys.includes('counter')
  ) {
    return null
  }
  if (typeof record.day !== 'string' || typeof record.hash !== 'string') {
    return null
  }
  if (record.bucket !== 'visitor' && record.bucket !== 'global') {
    return null
  }
  if (typeof record.counter !== 'number' || !Number.isInteger(record.counter)) {
    return null
  }
  return {
    day: record.day,
    bucket: record.bucket,
    hash: record.hash,
    counter: record.counter,
  }
}
