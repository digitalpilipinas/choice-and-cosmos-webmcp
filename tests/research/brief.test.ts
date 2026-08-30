// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseResearchBody } from '../../server/research/input.ts'
import { sampleBrief, samplePersonalized } from './helpers.ts'

describe('ResearchBrief contract', () => {
  it('accepts an approved brief and rejects forbidden personal fields', () => {
    const parsed = parseResearchBody(samplePersonalized())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok || parsed.version !== 2) {
      throw new Error('expected v2')
    }
    expect(parsed.value.brief.cosmic.sunSign).toBe('leo')
    expect(parsed.value.brief).not.toHaveProperty('displayName')

    const blocked = parseResearchBody({
      ...samplePersonalized(),
      displayName: 'Ada',
    })
    expect(blocked.ok).toBe(false)
    if (blocked.ok) {
      throw new Error('expected rejection')
    }
    expect(blocked.reason).toMatch(/displayName/)

    const birth = parseResearchBody({
      schemaVersion: 2,
      mode: 'auto',
      brief: { ...sampleBrief(), birthPlace: 'Manila' },
      manualUrls: [],
    })
    expect(birth.ok).toBe(false)
  })

  it('requires a Sun sign for personalized auto research and never infers it', () => {
    const missing = parseResearchBody(
      samplePersonalized({
        brief: sampleBrief({ cosmic: { moonSign: 'cancer' } }),
      }),
    )
    expect(missing.ok).toBe(false)
    if (missing.ok) {
      throw new Error('expected rejection')
    }
    expect(missing.reason).toMatch(/Sun sign/)

    const fixture = parseResearchBody(
      samplePersonalized({
        mode: 'fixture',
        brief: sampleBrief({ cosmic: {} }),
      }),
    )
    expect(fixture.ok).toBe(true)
  })

  it('rejects unknown lenses, duplicate lenses, and unknown cosmic keys', () => {
    expect(
      parseResearchBody(
        samplePersonalized({
          brief: sampleBrief({ requestedLenses: ['energyOverview', 'energyOverview'] }),
        }),
      ).ok,
    ).toBe(false)
    expect(
      parseResearchBody(
        samplePersonalized({
          brief: sampleBrief({
            requestedLenses: ['energyOverview', 'not-a-lens' as never],
          }),
        }),
      ).ok,
    ).toBe(false)
    expect(
      parseResearchBody(
        samplePersonalized({
          brief: sampleBrief({ cosmic: { sunSign: 'leo', favoriteColor: 'gold' } as never }),
        }),
      ).ok,
    ).toBe(false)
  })

  it('keeps two same-focus briefs distinct when the cosmic profile differs', () => {
    const focus = 'protect one block of attention'
    const first = parseResearchBody(
      samplePersonalized({
        brief: sampleBrief({ focus, cosmic: { sunSign: 'leo' } }),
      }),
    )
    const second = parseResearchBody(
      samplePersonalized({
        brief: sampleBrief({
          focus,
          cosmic: { sunSign: 'virgo', humanDesignType: 'projector' },
        }),
      }),
    )
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || first.version !== 2 || !second.ok || second.version !== 2) {
      throw new Error('expected two briefs')
    }
    expect(first.value.brief.focus).toBe(second.value.brief.focus)
    expect(first.value.brief.cosmic).not.toEqual(second.value.brief.cosmic)
  })
})
