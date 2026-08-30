// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  GLOBAL_DAILY_LIMIT,
  GLOBAL_QUOTA_HASH,
  hashVisitorIdentity,
  QUOTA_RELEASE_FAILED_REASON,
  utcDay,
  VISITOR_DAILY_LIMIT,
  type QuotaRow,
} from '../../server/research/quota.ts'
import {
  createD1QuotaStore,
  QUOTA_ABORT_GLOBAL_SQL,
  QUOTA_ABORT_READBACK_SQL,
  QUOTA_ABORT_RELEASE_SQL,
  QUOTA_ABORT_VISITOR_SQL,
  QUOTA_DECREMENT_SQL,
  QUOTA_INCREMENT_SQL,
} from '../../server/research/quotaD1.ts'
import { createMemoryQuotaStore } from '../../server/research/quotaMemory.ts'
import { fakeD1, globalCounter, rowKey, visitorCounter } from './fakeD1.ts'
import { TEST_IP, TEST_SECRET } from './helpers.ts'

describe('anonymous quota counters', () => {
  it('hashes the trusted identity and never stores the raw IP', async () => {
    const hash = await hashVisitorIdentity(TEST_IP, TEST_SECRET)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain(TEST_IP)
    const store = createMemoryQuotaStore()
    const reserved = await store.reserve(utcDay(new Date('2026-08-28T01:00:00.000Z')), hash)
    expect(reserved.kind).toBe('reserved')
    if (reserved.kind !== 'reserved') {
      throw new Error('expected reserved')
    }
    expect(reserved.visitor.hash).toBe(hash)
    expect(JSON.stringify(reserved)).not.toContain(TEST_IP)
    for (const row of await store.snapshot()) {
      expect(Object.keys(row).sort()).toEqual(['bucket', 'counter', 'day', 'hash'])
      expect(JSON.stringify(row)).not.toContain(TEST_IP)
    }
  })

  it('enforces atomic 3 visitor and 100 global UTC-day limits', async () => {
    const store = createMemoryQuotaStore()
    const day = '2026-08-28'
    const visitor = 'abc'
    for (let i = 0; i < VISITOR_DAILY_LIMIT; i += 1) {
      const result = await store.reserve(day, visitor)
      expect(result.kind).toBe('reserved')
    }
    const fourth = await store.reserve(day, visitor)
    expect(fourth).toEqual({ kind: 'quota_exceeded', scope: 'visitor' })

    const globalSeed: QuotaRow[] = [
      { day, bucket: 'global', hash: GLOBAL_QUOTA_HASH, counter: GLOBAL_DAILY_LIMIT },
    ]
    const globalStore = createMemoryQuotaStore(globalSeed)
    expect(await globalStore.reserve(day, 'other-visitor')).toEqual({
      kind: 'quota_exceeded',
      scope: 'global',
    })
  })

  it('resets counters on UTC-day rollover', async () => {
    const store = createMemoryQuotaStore()
    const visitor = 'abc'
    for (let i = 0; i < VISITOR_DAILY_LIMIT; i += 1) {
      expect((await store.reserve('2026-08-28', visitor)).kind).toBe('reserved')
    }
    expect((await store.reserve('2026-08-28', visitor)).kind).toBe('quota_exceeded')
    expect((await store.reserve('2026-08-29', visitor)).kind).toBe('reserved')
  })

  it('reserves visitor and global rows through one D1 batch', async () => {
    const rows = new Map<string, QuotaRow>()
    const store = createD1QuotaStore(fakeD1(rows))
    const day = '2026-08-28'
    const first = await store.reserve(day, 'visitor-hash')
    expect(first.kind).toBe('reserved')
    const visitorRow = rows.get(`${day}|visitor|visitor-hash`)
    expect(visitorRow).toEqual({
      day,
      bucket: 'visitor',
      hash: 'visitor-hash',
      counter: 1,
    })
    expect(Object.keys(visitorRow ?? {}).sort()).toEqual([
      'bucket',
      'counter',
      'day',
      'hash',
    ])
    expect(globalCounter(rows, day)).toBe(1)
  })

  it('rolls the visitor increment back when the D1 global cap rejects the batch', async () => {
    const day = '2026-08-28'
    const visitor = 'visitor-hash'
    const rows = new Map<string, QuotaRow>([
      [rowKey(day, 'visitor', visitor), { day, bucket: 'visitor', hash: visitor, counter: 1 }],
      [
        rowKey(day, 'global', GLOBAL_QUOTA_HASH),
        { day, bucket: 'global', hash: GLOBAL_QUOTA_HASH, counter: GLOBAL_DAILY_LIMIT },
      ],
    ])
    const store = createD1QuotaStore(fakeD1(rows))
    expect(await store.reserve(day, visitor)).toEqual({
      kind: 'quota_exceeded',
      scope: 'global',
    })
    expect(visitorCounter(rows, day, visitor)).toBe(1)
    expect(globalCounter(rows, day)).toBe(GLOBAL_DAILY_LIMIT)
  })

  it('reports visitor scope when the visitor CAS takes no row', async () => {
    const day = '2026-08-28'
    const visitor = 'visitor-hash'
    const rows = new Map<string, QuotaRow>([
      [
        rowKey(day, 'visitor', visitor),
        { day, bucket: 'visitor', hash: visitor, counter: VISITOR_DAILY_LIMIT },
      ],
    ])
    const store = createD1QuotaStore(fakeD1(rows))
    expect(await store.reserve(day, visitor)).toEqual({
      kind: 'quota_exceeded',
      scope: 'visitor',
    })
    expect(visitorCounter(rows, day, visitor)).toBe(VISITOR_DAILY_LIMIT)
    expect(rows.has(rowKey(day, 'global', GLOBAL_QUOTA_HASH))).toBe(false)
  })

  it('rolls both increments back when a later D1 statement throws', async () => {
    const day = '2026-08-28'
    const visitor = 'visitor-hash'
    const rows = new Map<string, QuotaRow>()
    const store = createD1QuotaStore(fakeD1(rows, { throwOnSelect: true }))
    const result = await store.reserve(day, visitor)
    expect(result).toEqual({
      kind: 'unavailable',
      reason: 'The quota store could not complete a transactional reservation.',
    })
    expect(visitorCounter(rows, day, visitor)).toBe(0)
    expect(globalCounter(rows, day)).toBe(0)
  })

  it('releases both counters when D1 read-back returns empty after a committed batch', async () => {
    const day = '2026-08-28'
    const visitor = 'visitor-hash'
    const rows = new Map<string, QuotaRow>()
    const store = createD1QuotaStore(fakeD1(rows, { emptySelect: true }))
    const result = await store.reserve(day, visitor)
    expect(result).toEqual({
      kind: 'unavailable',
      reason: 'Quota counters could not be read after reservation.',
    })
    expect(visitorCounter(rows, day, visitor)).toBe(0)
    expect(globalCounter(rows, day)).toBe(0)
  })

  it('returns unavailable and leaves counters held when read-back is empty and release throws', async () => {
    const day = '2026-08-28'
    const visitor = 'visitor-hash'
    const rows = new Map<string, QuotaRow>()
    const store = createD1QuotaStore(
      fakeD1(rows, { emptySelect: true, throwOnDecrement: true }),
    )
    const result = await store.reserve(day, visitor)
    expect(result).toEqual({
      kind: 'unavailable',
      reason:
        'Quota counters could not be read after reservation, and release failed. A slot may still be held.',
    })
    expect(visitorCounter(rows, day, visitor)).toBe(1)
    expect(globalCounter(rows, day)).toBe(1)
  })

  it('returns unavailable when release reports zero changes', async () => {
    const day = '2026-08-28'
    const visitor = 'visitor-hash'
    const rows = new Map<string, QuotaRow>()
    const store = createD1QuotaStore(
      fakeD1(rows, { emptySelect: true, zeroChangesOnDecrement: true }),
    )
    const result = await store.reserve(day, visitor)
    expect(result.kind).toBe('unavailable')
    expect(visitorCounter(rows, day, visitor)).toBe(1)
    expect(globalCounter(rows, day)).toBe(1)
  })

  it('does not increment when the abort signal is already aborted', async () => {
    const rows = new Map<string, QuotaRow>()
    const store = createD1QuotaStore(fakeD1(rows))
    const signal = AbortSignal.abort()
    expect(await store.reserve('2026-08-28', 'visitor-hash', signal)).toEqual({
      kind: 'aborted',
    })
    expect(rows.size).toBe(0)
  })

  it('releases a committed batch when the signal aborts before reserve returns', async () => {
    const day = '2026-08-28'
    const visitor = 'visitor-hash'
    const rows = new Map<string, QuotaRow>()
    const controller = new AbortController()
    const store = createD1QuotaStore(
      fakeD1(rows, { afterSuccessfulBatch: () => controller.abort() }),
    )
    expect(await store.reserve(day, visitor, controller.signal)).toEqual({
      kind: 'aborted',
    })
    expect(visitorCounter(rows, day, visitor)).toBe(0)
    expect(globalCounter(rows, day)).toBe(0)
  })

  it('returns unavailable when abort-after-batch release throws', async () => {
    const day = '2026-08-28'
    const visitor = 'visitor-hash'
    const rows = new Map<string, QuotaRow>()
    const controller = new AbortController()
    const store = createD1QuotaStore(
      fakeD1(rows, {
        afterSuccessfulBatch: () => controller.abort(),
        throwOnDecrement: true,
      }),
    )
    const result = await store.reserve(day, visitor, controller.signal)
    expect(result).toEqual({
      kind: 'unavailable',
      reason: QUOTA_RELEASE_FAILED_REASON,
    })
    expect(visitorCounter(rows, day, visitor)).toBe(1)
    expect(globalCounter(rows, day)).toBe(1)
  })

  it('rejects top-level RAISE in the fake D1 instead of treating it as a quota guard', async () => {
    const rows = new Map<string, QuotaRow>()
    const db = fakeD1(rows)
    await expect(
      db.batch([
        db.prepare("SELECT RAISE(ABORT, 'visitor_quota_exceeded') WHERE changes() < 1"),
      ]),
    ).rejects.toThrow(/RAISE\(\) may only be used within a trigger-program/)
    expect(rows.size).toBe(0)
  })
})

describe('SQLite-valid quota abort SQL', () => {
  const abortSql = [
    QUOTA_ABORT_VISITOR_SQL,
    QUOTA_ABORT_GLOBAL_SQL,
    QUOTA_ABORT_READBACK_SQL,
    QUOTA_ABORT_RELEASE_SQL,
  ]

  it('does not use RAISE, and top-level RAISE is invalid outside a trigger', () => {
    for (const sql of abortSql) {
      expect(sql).not.toMatch(/\bRAISE\s*\(/i)
    }
    const db = new DatabaseSync(':memory:')
    expect(() =>
      db.exec("SELECT RAISE(ABORT, 'visitor_quota_exceeded') WHERE changes() < 1"),
    ).toThrow(/RAISE\(\) may only be used within a trigger-program/)
  })

  it('rolls visitor increment back on a global cap without mutating counters', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(
      readFileSync(join(process.cwd(), 'db', '0001_quota_counters.sql'), 'utf8'),
    )
    db.exec(`
      INSERT INTO quota_counters (day, bucket, hash, counter)
      VALUES ('2026-08-28', 'visitor', 'v', 1),
             ('2026-08-28', 'global', 'global', 100)
    `)
    db.exec('BEGIN')
    try {
      db.prepare(QUOTA_INCREMENT_SQL).run('2026-08-28', 'visitor', 'v', VISITOR_DAILY_LIMIT)
      db.exec(QUOTA_ABORT_VISITOR_SQL)
      db.prepare(QUOTA_INCREMENT_SQL).run(
        '2026-08-28',
        'global',
        GLOBAL_QUOTA_HASH,
        GLOBAL_DAILY_LIMIT,
      )
      db.exec(QUOTA_ABORT_GLOBAL_SQL)
      db.exec('COMMIT')
      throw new Error('expected global-cap abort')
    } catch (error) {
      db.exec('ROLLBACK')
      expect(String(error)).toMatch(/quota_counters\.bucket/)
    }
    expect(
      db.prepare('SELECT day, bucket, hash, counter FROM quota_counters ORDER BY bucket').all(),
    ).toEqual([
      { day: '2026-08-28', bucket: 'global', hash: 'global', counter: 100 },
      { day: '2026-08-28', bucket: 'visitor', hash: 'v', counter: 1 },
    ])
  })

  it('leaves a visitor-capped row unchanged and does not create a global row', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(
      readFileSync(join(process.cwd(), 'db', '0001_quota_counters.sql'), 'utf8'),
    )
    db.exec(`
      INSERT INTO quota_counters (day, bucket, hash, counter)
      VALUES ('2026-08-28', 'visitor', 'v', 3)
    `)
    db.exec('BEGIN')
    try {
      db.prepare(QUOTA_INCREMENT_SQL).run('2026-08-28', 'visitor', 'v', VISITOR_DAILY_LIMIT)
      db.exec(QUOTA_ABORT_VISITOR_SQL)
      db.exec('COMMIT')
      throw new Error('expected visitor-cap abort')
    } catch (error) {
      db.exec('ROLLBACK')
      expect(String(error)).toMatch(/quota_counters\.day/)
    }
    expect(db.prepare('SELECT * FROM quota_counters').all()).toEqual([
      { day: '2026-08-28', bucket: 'visitor', hash: 'v', counter: 3 },
    ])
  })

  it('treats abort inserts as no-ops after a successful CAS and releases both counters', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(
      readFileSync(join(process.cwd(), 'db', '0001_quota_counters.sql'), 'utf8'),
    )
    db.exec('BEGIN')
    db.prepare(QUOTA_INCREMENT_SQL).run('2026-08-28', 'visitor', 'v', VISITOR_DAILY_LIMIT)
    db.exec(QUOTA_ABORT_VISITOR_SQL)
    db.prepare(QUOTA_INCREMENT_SQL).run(
      '2026-08-28',
      'global',
      GLOBAL_QUOTA_HASH,
      GLOBAL_DAILY_LIMIT,
    )
    db.exec(QUOTA_ABORT_GLOBAL_SQL)
    db.exec('COMMIT')
    db.exec('BEGIN')
    db.prepare(QUOTA_DECREMENT_SQL).run('2026-08-28', 'visitor', 'v')
    db.exec(QUOTA_ABORT_RELEASE_SQL)
    db.prepare(QUOTA_DECREMENT_SQL).run('2026-08-28', 'global', GLOBAL_QUOTA_HASH)
    db.exec(QUOTA_ABORT_RELEASE_SQL)
    db.exec('COMMIT')
    expect(
      db.prepare('SELECT bucket, counter FROM quota_counters ORDER BY bucket').all(),
    ).toEqual([
      { bucket: 'global', counter: 0 },
      { bucket: 'visitor', counter: 0 },
    ])
  })
})
