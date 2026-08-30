import { describe, expect, it } from 'vitest'
import {
  agentPromptForBrief,
  buildExactBrief,
} from '../../src/research/brief.ts'

const FOCUS = 'protect one block of attention'

describe('exact research brief', () => {
  it('returns null without a focus or without a belief module', () => {
    expect(
      buildExactBrief({
        horizon: 'daily',
        focus: '   ',
        tone: 'grounded',
        beliefs: { western: { sun: 'leo' } },
      }),
    ).toBeNull()
    expect(
      buildExactBrief({
        horizon: 'daily',
        focus: FOCUS,
        tone: 'grounded',
        beliefs: {},
      }),
    ).toBeNull()
  })

  it('keeps two same-focus briefs distinct when the modular profile differs', () => {
    const first = buildExactBrief({
      horizon: 'daily',
      focus: FOCUS,
      tone: 'grounded',
      beliefs: { western: { sun: 'leo' } },
    })
    const second = buildExactBrief({
      horizon: 'daily',
      focus: FOCUS,
      tone: 'grounded',
      beliefs: {
        western: { sun: 'virgo' },
        humanDesign: { type: 'projector' },
      },
    })
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    if (first === null || second === null) {
      throw new Error('expected two briefs')
    }
    expect(first.focus).toBe(second.focus)
    expect(JSON.stringify(first)).not.toBe(JSON.stringify(second))
    expect(first.cosmic.sunSign).toBe('leo')
    expect(second.cosmic.sunSign).toBe('virgo')
    expect(second.cosmic.humanDesignType).toBe('projector')
    expect(first).not.toHaveProperty('displayName')
    expect(agentPromptForBrief(first)).toContain('sunSign=leo')
    expect(agentPromptForBrief(second)).toContain('humanDesignType=projector')
    expect(agentPromptForBrief(first)).not.toBe(agentPromptForBrief(second))
  })
})
