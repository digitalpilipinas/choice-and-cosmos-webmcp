import { describe, expect, it } from 'vitest'
import type { DerivedProfile } from '../../src/domain/types.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'

const profile: DerivedProfile = {
  displayName: 'You',
  focusIntention: 'the same question twice',
  tone: 'grounded',
}

describe('generateForecast', () => {
  it('is deterministic for the same profile and horizon', () => {
    expect(generateForecast(profile, 'daily')).toEqual(
      generateForecast(profile, 'daily'),
    )
    expect(generateForecast(profile, 'weekly')).toEqual(
      generateForecast(profile, 'weekly'),
    )
    expect(generateForecast(profile, 'yearly')).toEqual(
      generateForecast(profile, 'yearly'),
    )
  })

  it('cites at least one evidence ID on every report section', () => {
    const forecast = generateForecast(profile, 'yearly')
    expect(forecast.sections).toHaveLength(11)
    expect(
      forecast.sections.every((section) => section.evidenceIds.length > 0),
    ).toBe(true)
  })

  it('tags every suggested step as fixture-origin', () => {
    const forecast = generateForecast(profile, 'daily')
    expect(forecast.suggestedSteps.length).toBeGreaterThan(0)
    expect(
      forecast.suggestedSteps.every((step) => step.origin === 'fixture'),
    ).toBe(true)
  })
})
