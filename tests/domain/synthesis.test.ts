import { describe, expect, it } from 'vitest'
import {
  LIVE_RESEARCH_MOUNTED,
  LIVE_RESEARCH_NOTICE,
} from '../../src/domain/synthesis.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'
import { REPORT_SECTION_ORDER } from '../../src/fixtures/reportSections.ts'
import generateSource from '../../src/fixtures/generateForecast.ts?raw'
import type { DerivedProfile } from '../../src/domain/types.ts'

const profile: DerivedProfile = {
  displayName: 'You',
  focusIntention: 'the same question twice',
  tone: 'grounded',
  cosmic: {},
}

describe('synthesis notices', () => {
  it('keeps fixture copy after the research route is unmounted', () => {
    expect(LIVE_RESEARCH_MOUNTED).toBe(false)
    expect(LIVE_RESEARCH_NOTICE).toMatch(/did not search the internet/i)
    expect(LIVE_RESEARCH_NOTICE).toMatch(/legacy, non-personalized/i)
  })

  it('cites every report section from the fixture pool', () => {
    const forecast = generateForecast(profile, 'weekly')
    expect(forecast.sections.map((section) => section.id)).toEqual([
      ...REPORT_SECTION_ORDER,
    ])
    for (const section of forecast.sections) {
      expect(section.evidenceIds.length).toBeGreaterThan(0)
    }
  })

  it('does not use Math.random in the fixture generator', () => {
    expect(generateSource).not.toMatch(/Math\.random/)
  })
})
