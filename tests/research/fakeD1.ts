import type {
  D1Database,
  D1PreparedStatement,
  D1StatementResult,
} from '../../server/research/quotaD1.ts'
import { GLOBAL_QUOTA_HASH, type QuotaRow } from '../../server/research/quota.ts'

export function rowKey(day: string, bucket: QuotaRow['bucket'], hash: string): string {
  return `${day}|${bucket}|${hash}`
}

function unquoteSqlLiteral(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function constraintErrorForAbortInsert(query: string): Error {
  const select = query.match(/SELECT\s+([\s\S]+?)\s+WHERE/i)
  if (select === null || select[1] === undefined) {
    throw new Error('unsupported quota abort SQL')
  }
  const parts = select[1].split(',').map((part) => part.trim())
  const [day, bucket, hash, counter] = parts
  if (day === undefined || bucket === undefined || hash === undefined || counter === undefined) {
    throw new Error('unsupported quota abort SQL')
  }
  if (day.toUpperCase() === 'NULL') {
    return new Error('NOT NULL constraint failed: quota_counters.day')
  }
  if (bucket.toUpperCase() === 'NULL') {
    return new Error('NOT NULL constraint failed: quota_counters.bucket')
  }
  if (hash.toUpperCase() === 'NULL') {
    return new Error('NOT NULL constraint failed: quota_counters.hash')
  }
  if (counter.toUpperCase() === 'NULL') {
    return new Error('NOT NULL constraint failed: quota_counters.counter')
  }
  const bucketValue = unquoteSqlLiteral(bucket)
  if (bucketValue !== 'visitor' && bucketValue !== 'global') {
    return new Error("CHECK constraint failed: bucket IN ('visitor', 'global')")
  }
  const counterValue = Number(counter)
  if (!Number.isInteger(counterValue) || counterValue < 0) {
    return new Error('CHECK constraint failed: counter >= 0')
  }
  throw new Error('quota abort insert would persist a row; refusing fake success')
}

export interface FakeD1Options {
  emptySelect?: boolean
  throwOnIncrement?: 'visitor' | 'global' | 'any'
  throwOnSelect?: boolean
  throwOnDecrement?: boolean
  zeroChangesOnDecrement?: boolean
  afterSuccessfulBatch?: () => void
}

export function fakeD1(
  rows: Map<string, QuotaRow>,
  options: FakeD1Options = {},
): D1Database {
  const state = { lastChanges: 0 }
  const executors = new WeakMap<D1PreparedStatement, () => Promise<D1StatementResult>>()

  const restore = (snapshot: Array<[string, QuotaRow]>): void => {
    rows.clear()
    for (const [key, row] of snapshot) {
      rows.set(key, { ...row })
    }
  }

  const execute = async (
    query: string,
    bound: unknown[],
  ): Promise<D1StatementResult> => {
    if (/\bRAISE\s*\(/i.test(query)) {
      throw new Error('RAISE() may only be used within a trigger-program')
    }
    if (
      query.includes('INSERT INTO quota_counters') &&
      query.includes('ON CONFLICT')
    ) {
      const day = String(bound[0])
      const bucket = String(bound[1]) as QuotaRow['bucket']
      const hash = String(bound[2])
      const limit = Number(bound[3])
      if (
        options.throwOnIncrement === 'any' ||
        options.throwOnIncrement === bucket
      ) {
        throw new Error(`quota increment failed for ${bucket}`)
      }
      const key = rowKey(day, bucket, hash)
      const existing = rows.get(key)
      if (existing === undefined) {
        rows.set(key, { day, bucket, hash, counter: 1 })
        state.lastChanges = 1
        return { meta: { changes: 1 }, results: [] }
      }
      if (existing.counter >= limit) {
        state.lastChanges = 0
        return { meta: { changes: 0 }, results: [] }
      }
      existing.counter += 1
      state.lastChanges = 1
      return { meta: { changes: 1 }, results: [] }
    }
    if (query.includes('INSERT INTO quota_counters')) {
      if (query.includes('changes() < 1') && state.lastChanges >= 1) {
        return { meta: { changes: 0 }, results: [] }
      }
      if (query.includes('SELECT COUNT(*)')) {
        const day = String(bound[0])
        const visitorHash = String(bound[1])
        const globalHash = String(bound[2])
        const visitor = rows.get(rowKey(day, 'visitor', visitorHash))
        const global = rows.get(rowKey(day, 'global', globalHash))
        if (visitor !== undefined && global !== undefined) {
          return { meta: { changes: 0 }, results: [] }
        }
      }
      throw constraintErrorForAbortInsert(query)
    }
    if (query.includes('counter = counter - 1')) {
      if (options.throwOnDecrement === true) {
        throw new Error('quota decrement failed')
      }
      const day = String(bound[0])
      const bucket = String(bound[1]) as QuotaRow['bucket']
      const hash = String(bound[2])
      const existing = rows.get(rowKey(day, bucket, hash))
      if (
        options.zeroChangesOnDecrement === true ||
        existing === undefined ||
        existing.counter <= 0
      ) {
        state.lastChanges = 0
        return { meta: { changes: 0 }, results: [] }
      }
      existing.counter -= 1
      state.lastChanges = 1
      return { meta: { changes: 1 }, results: [] }
    }
    if (query.includes('WHERE day =') && query.includes('SELECT day, bucket, hash, counter')) {
      if (options.throwOnSelect === true) {
        throw new Error('quota select failed')
      }
      const day = String(bound[0])
      const bucket = bound[1] === 'global' ? 'global' : 'visitor'
      const hash = String(bound[2])
      const row = rows.get(rowKey(day, bucket, hash))
      if (options.emptySelect === true) {
        return { meta: { changes: 0 }, results: [] }
      }
      return {
        meta: { changes: 0 },
        results: row === undefined ? [] : [row],
      }
    }
    if (query.includes('SELECT day, bucket, hash, counter')) {
      return { meta: { changes: 0 }, results: [...rows.values()] }
    }
    return { meta: { changes: 0 }, results: [] }
  }

  return {
    prepare(query: string): D1PreparedStatement {
      const bound: unknown[] = []
      const statement: D1PreparedStatement = {
        bind(...values: unknown[]) {
          bound.push(...values)
          return statement
        },
        async run<T = unknown>() {
          const result = await execute(query, bound)
          return { meta: result.meta, results: result.results as T[] }
        },
        async all<T = unknown>() {
          const result = await execute(query, bound)
          return { meta: result.meta, results: result.results as T[] }
        },
      }
      executors.set(statement, () => execute(query, bound))
      return statement
    },
    async batch<T = unknown>(
      statements: D1PreparedStatement[],
    ): Promise<Array<D1StatementResult<T>>> {
      const snapshot = [...rows.entries()].map(
        ([key, row]): [string, QuotaRow] => [key, { ...row }],
      )
      try {
        const results: Array<D1StatementResult<T>> = []
        for (const statement of statements) {
          const run = executors.get(statement)
          if (run === undefined) {
            throw new Error('unknown D1 statement')
          }
          const result = await run()
          results.push({ meta: result.meta, results: result.results as T[] })
        }
        options.afterSuccessfulBatch?.()
        return results
      } catch (error) {
        restore(snapshot)
        throw error
      }
    },
  }
}

export function visitorCounter(
  rows: Map<string, QuotaRow>,
  day: string,
  visitor: string,
): number {
  return rows.get(rowKey(day, 'visitor', visitor))?.counter ?? 0
}

export function globalCounter(rows: Map<string, QuotaRow>, day: string): number {
  return rows.get(rowKey(day, 'global', GLOBAL_QUOTA_HASH))?.counter ?? 0
}
