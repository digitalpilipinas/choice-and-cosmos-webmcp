import { describe, expect, it } from 'vitest'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'
import { LIVE_RESEARCH_MOUNTED, LIVE_RESEARCH_NOTICE } from '../../src/domain/synthesis.ts'
import { isPersonalized } from '../../src/domain/trust.ts'

describe('legacy fixture cannot satisfy personalization', () => {
  it('labels the on-page reading as a non-personalized fixture', () => {
    expect(LIVE_RESEARCH_MOUNTED).toBe(false)
    expect(LIVE_RESEARCH_NOTICE).toMatch(/legacy, non-personalized/)
    expect(LIVE_RESEARCH_NOTICE).toMatch(/did not search the internet/)
    const forecast = generateForecast(
      {
        displayName: 'You',
        focusIntention: 'finish the draft',
        tone: 'grounded',
        cosmic: {},
      },
      'daily',
    )
    expect(forecast.coverage.mode).toBe('fixture')
    expect(isPersonalized(null)).toBe(false)
  })
})
