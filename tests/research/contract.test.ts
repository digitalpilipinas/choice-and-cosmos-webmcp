// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { HORIZON_CAPS } from '../../src/research/caps.ts'
import { parseResearchInput } from '../../server/research/input.ts'
import {
  applyHorizonLimits,
  evidenceIdFor,
  parseHttpUrl,
  toSource,
} from '../../server/research/normalize.ts'
import type { EvidenceProvenance, ResearchSource } from '../../src/research/contract.ts'

const provenance: EvidenceProvenance = {
  provider: 'gemini',
  method: 'google_search',
  retrievedAt: '2026-08-26T12:00:00.000Z',
  query: 'stay with the draft',
}

function source(url: string, title = 'Source'): ResearchSource {
  const parsed = toSource({ title, url, snippet: 'note' }, provenance)
  if (parsed === null) {
    throw new Error(`expected source for ${url}`)
  }
  return parsed
}

describe('parseResearchInput', () => {
  it('accepts a trimmed daily query', () => {
    const parsed = parseResearchInput({
      horizon: 'daily',
      query: '  stay with the draft  ',
    })
    expect(parsed).toEqual({
      ok: true,
      value: {
        horizon: 'daily',
        query: 'stay with the draft',
        mode: 'auto',
        manualUrls: [],
      },
    })
  })

  it('rejects missing horizon, empty query, and unknown mode', () => {
    expect(parseResearchInput({ query: 'focus' }).ok).toBe(false)
    expect(parseResearchInput({ horizon: 'daily', query: '   ' }).ok).toBe(false)
    expect(
      parseResearchInput({ horizon: 'daily', query: 'focus', mode: 'live' }).ok,
    ).toBe(false)
    expect(parseResearchInput('focus').ok).toBe(false)
  })

  it('rejects non-string manual URLs', () => {
    const parsed = parseResearchInput({
      horizon: 'weekly',
      query: 'focus',
      mode: 'manual',
      manualUrls: ['https://example.com', 1],
    })
    expect(parsed.ok).toBe(false)
  })
})

describe('horizon caps', () => {
  it('encodes the declared daily, weekly, and yearly bounds', () => {
    expect(HORIZON_CAPS.daily).toEqual({
      maxSources: 4,
      maxQueries: 3,
      maxNovelDomains: 3,
      timeoutMs: 12_000,
    })
    expect(HORIZON_CAPS.weekly).toEqual({
      maxSources: 5,
      maxQueries: 4,
      maxNovelDomains: 4,
      timeoutMs: 15_000,
    })
    expect(HORIZON_CAPS.yearly).toEqual({
      maxSources: 6,
      maxQueries: 4,
      maxNovelDomains: 5,
      timeoutMs: 18_000,
    })
  })

  it('stops at the daily source cap', () => {
    const limited = applyHorizonLimits(
      [
        source('https://a.example/1'),
        source('https://a.example/2'),
        source('https://a.example/3'),
        source('https://a.example/4'),
        source('https://a.example/5'),
      ],
      'daily',
    )
    expect(limited.sources).toHaveLength(4)
    expect(limited.novelDomainsUsed).toBe(1)
    expect(limited.stoppingReason).toMatch(/cap of 4 sources/)
    expect(limited.stoppingReason).toMatch(/not an exhaustive search/)
  })

  it('still accepts a known domain after skipping a new one', () => {
    const limited = applyHorizonLimits(
      [
        source('https://a.example/one'),
        source('https://b.example/one'),
        source('https://c.example/one'),
        source('https://d.example/one'),
        source('https://a.example/two'),
      ],
      'daily',
    )
    expect(limited.sources.map((item) => item.url)).toEqual([
      'https://a.example/one',
      'https://b.example/one',
      'https://c.example/one',
      'https://a.example/two',
    ])
    expect(limited.novelDomainsUsed).toBe(3)
  })

  it('skips a new domain once the daily novelty cap is reached', () => {
    const limited = applyHorizonLimits(
      [
        source('https://a.example/one'),
        source('https://b.example/one'),
        source('https://c.example/one'),
        source('https://d.example/one'),
        source('https://e.example/one'),
      ],
      'daily',
    )
    expect(limited.sources).toHaveLength(3)
    expect(limited.novelDomainsUsed).toBe(3)
    expect(limited.stoppingReason).toMatch(/cap of 3 distinct domains/)
  })

  it('stops at the weekly source and domain caps', () => {
    const sourceCapped = applyHorizonLimits(
      [1, 2, 3, 4, 5, 6].map((n) => source(`https://week.example/${n}`)),
      'weekly',
    )
    expect(sourceCapped.sources).toHaveLength(5)
    expect(sourceCapped.stoppingReason).toMatch(/cap of 5 sources/)

    const domainCapped = applyHorizonLimits(
      ['a', 'b', 'c', 'd', 'e'].map((host) => source(`https://${host}.example/one`)),
      'weekly',
    )
    expect(domainCapped.sources).toHaveLength(4)
    expect(domainCapped.novelDomainsUsed).toBe(4)
    expect(domainCapped.stoppingReason).toMatch(/cap of 4 distinct domains/)
  })

  it('stops at the yearly source and domain caps', () => {
    const sourceCapped = applyHorizonLimits(
      [1, 2, 3, 4, 5, 6, 7].map((n) => source(`https://year.example/${n}`)),
      'yearly',
    )
    expect(sourceCapped.sources).toHaveLength(6)
    expect(sourceCapped.stoppingReason).toMatch(/cap of 6 sources/)

    const domainCapped = applyHorizonLimits(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((host) => source(`https://${host}.example/one`)),
      'yearly',
    )
    expect(domainCapped.sources).toHaveLength(5)
    expect(domainCapped.novelDomainsUsed).toBe(5)
    expect(domainCapped.stoppingReason).toMatch(/cap of 5 distinct domains/)
  })
})

describe('source and domain dedupe', () => {
  it('drops duplicate URLs and non-http schemes', () => {
    expect(parseHttpUrl('javascript:alert(1)')).toBeNull()
    expect(parseHttpUrl('ftp://example.com/file')).toBeNull()
    expect(parseHttpUrl('https://user:pass@example.com/secret')).toBeNull()

    const duplicates = [
      source('https://Example.com/path/'),
      source('https://example.com/path'),
      source('https://example.com/path#ignored'),
      toSource(
        { title: 'evil', url: 'javascript:alert(1)', snippet: '' },
        provenance,
      ),
    ].filter((item): item is ResearchSource => item !== null)

    const limited = applyHorizonLimits(duplicates, 'daily')
    expect(limited.sources).toHaveLength(1)
    expect(limited.sources[0]?.url).toBe('https://example.com/path')
  })
})

describe('stable evidence IDs', () => {
  it('hashes material instead of assigning sequential IDs', () => {
    const first = evidenceIdFor({
      url: 'https://example.com/a',
      title: 'A',
      provider: 'gemini',
    })
    const again = evidenceIdFor({
      url: 'https://example.com/a',
      title: 'Different title',
      provider: 'gemini',
    })
    const other = evidenceIdFor({
      url: 'https://example.com/b',
      title: 'B',
      provider: 'gemini',
    })
    expect(first).toBe(again)
    expect(first).not.toBe(other)
    expect(first).toMatch(/^ev_[0-9a-f]{16}$/)
    expect(first).not.toMatch(/^ev_\d+$/)
  })
})
