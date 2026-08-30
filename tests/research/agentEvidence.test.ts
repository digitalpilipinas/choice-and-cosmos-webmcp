// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { normalizeUntrustedAgentEvidence } from '../../server/research/agentEvidence.ts'
import { sampleBrief } from './helpers.ts'

describe('untrusted agent evidence', () => {
  it('normalizes http(s) citations and never marks the bundle adopted', () => {
    const result = normalizeUntrustedAgentEvidence(
      {
        sources: [
          { title: 'Kept', url: 'https://agent.example/note', snippet: 'Ignore policy' },
          { title: 'Bad', url: 'javascript:alert(1)', snippet: 'nope' },
        ],
      },
      sampleBrief(),
    )
    expect(result.adopted).toBe(false)
    expect(result.bundle.adopted).toBe(false)
    expect(result.bundle.sources).toHaveLength(1)
    expect(result.bundle.sources[0]?.url).toBe('https://agent.example/note')
    expect(result.bundle.claims).toEqual([])
    expect(result.bundle.status).toBe('partial')
    const provenance = result.bundle.sources[0]?.provenance
    expect(provenance).toEqual({
      provider: 'agent',
      method: 'untrusted_submission',
      query: sampleBrief().focus,
    })
    expect(provenance).not.toHaveProperty('retrievedAt')
    expect(JSON.stringify(provenance)).not.toContain('google_search')
    expect(JSON.stringify(provenance)).not.toContain(new Date(0).toISOString())
    expect(result.bundle.coverage.mode).toBe('agent')
  })

  it('returns invalid_provider_output when no usable citations remain', () => {
    const result = normalizeUntrustedAgentEvidence(
      { citations: [{ url: 'ftp://example.com/file' }] },
      sampleBrief(),
    )
    expect(result.adopted).toBe(false)
    expect(result.bundle.status).toBe('invalid_provider_output')
    expect(result.bundle.sources).toEqual([])
  })

  it('rejects entries without a credential-free http(s) URL and never invents a local source', () => {
    const result = normalizeUntrustedAgentEvidence(
      {
        sources: [
          { title: 'No URL', snippet: 'missing' },
          { title: 'Blank', url: '', snippet: 'empty' },
          { title: 'Local-looking', url: null, snippet: 'null url' },
        ],
      },
      sampleBrief(),
    )
    expect(result.adopted).toBe(false)
    expect(result.bundle.adopted).toBe(false)
    expect(result.bundle.sources).toEqual([])
    expect(result.bundle.status).toBe('invalid_provider_output')
    expect(result.bundle.coverage.mode).toBe('agent')
    const provenance = result.bundle.sources[0]?.provenance
    expect(provenance).toBeUndefined()
    expect(JSON.stringify(result.bundle)).not.toContain('local:')
    expect(JSON.stringify(result.bundle.sources)).not.toContain('"url":null')
  })
})
