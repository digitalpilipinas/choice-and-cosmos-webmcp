// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('D1 quota migration artifact', () => {
  it('defines only day, bucket, hash, and counter columns and is not wired in wrangler', () => {
    const sql = readFileSync(
      join(process.cwd(), 'db', '0001_quota_counters.sql'),
      'utf8',
    )
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS quota_counters/)
    expect(sql).toMatch(/\bday TEXT NOT NULL/)
    expect(sql).toMatch(/\bbucket TEXT NOT NULL/)
    expect(sql).toMatch(/\bhash TEXT NOT NULL/)
    expect(sql).toMatch(/\bcounter INTEGER NOT NULL/)
    expect(sql).not.toMatch(/ip/i)
    expect(sql).not.toMatch(/profile/i)
    expect(sql).not.toMatch(/focus/i)
    expect(sql).not.toMatch(/url/i)
    const wrangler = readFileSync(join(process.cwd(), 'wrangler.jsonc'), 'utf8')
    expect(wrangler).not.toMatch(/d1_databases/)
    expect(wrangler).not.toMatch(/QUOTA_HASH_SECRET/)
    expect(wrangler).not.toMatch(/RESEARCH_ENABLED/)
  })
})
