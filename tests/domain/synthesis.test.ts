import { describe, expect, it } from 'vitest'
import {
  LIVE_RESEARCH_MOUNTED,
  LIVE_RESEARCH_NOTICE,
  cardsForSection,
  evidenceCards,
  frameworkKind,
  horizonChart,
} from '../../src/domain/synthesis.ts'
import type {
  DerivedProfile,
  ForecastFixture,
  ReportSection,
} from '../../src/domain/types.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'
import { REPORT_SECTION_ORDER } from '../../src/fixtures/reportSections.ts'
import synthesisSource from '../../src/domain/synthesis.ts?raw'
import generateSource from '../../src/fixtures/generateForecast.ts?raw'

const profile: DerivedProfile = {
  displayName: 'You',
  focusIntention: 'the same question twice',
  tone: 'grounded',
}

describe('synthesis', () => {
  it('keeps fixture cards without live URLs after the research route is mounted', () => {
    expect(LIVE_RESEARCH_MOUNTED).toBe(true)
    expect(LIVE_RESEARCH_NOTICE).toMatch(/did not search the internet/i)
    const forecast = generateForecast(profile, 'daily')
    for (const card of evidenceCards(forecast)) {
      expect(card.url).toBeNull()
      expect(card.method).toBe('local_fixture')
      expect(card.provider).toBe('fixture')
      expect(card.id.length).toBeGreaterThan(0)
    }
  })

  it('cites every report section from the fixture pool', () => {
    const forecast = generateForecast(profile, 'weekly')
    expect(forecast.sections.map((section) => section.id)).toEqual([
      ...REPORT_SECTION_ORDER,
    ])
    for (const section of forecast.sections) {
      expect(section.evidenceIds.length).toBeGreaterThan(0)
      expect(cardsForSection(forecast, section).length).toBeGreaterThan(0)
    }
  })

  it('labels interpretive frameworks from a table, not ad hoc branches', () => {
    expect(frameworkKind('numerology')).toBe('interpretive')
    expect(frameworkKind('humanDesign')).toBe('interpretive')
    expect(frameworkKind('westernAstrology')).toBe('interpretive')
    expect(frameworkKind('chineseElemental')).toBe('interpretive')
    expect(frameworkKind('tarotOracle')).toBe('interpretive')
    expect(frameworkKind('symbolicCodes')).toBe('interpretive')
    expect(frameworkKind('energyOverview')).toBe('reflective')
    expect(frameworkKind('decisionSupport')).toBe('reflective')
  })

  it('builds a deterministic chart with horizon-specific slots', () => {
    const daily = generateForecast(profile, 'daily')
    const weekly = generateForecast(profile, 'weekly')
    const yearly = generateForecast(profile, 'yearly')

    expect(horizonChart(daily)).toEqual(horizonChart(generateForecast(profile, 'daily')))
    expect(horizonChart(daily).slots).toHaveLength(4)
    expect(horizonChart(weekly).slots).toHaveLength(7)
    expect(horizonChart(yearly).slots).toHaveLength(4)
    expect(horizonChart(daily).title).toBe('Signal window map')
    expect(horizonChart(weekly).title).toBe('Compass window map')
    expect(horizonChart(yearly).title).toBe('Constellation window map')
    expect(horizonChart(daily).caption).toMatch(/not probabilities/i)
    expect(horizonChart(daily).caption).toMatch(/not a prediction/i)

    expect(daily.generatedAt).toMatch(/^2026-08-27T/)
    expect(weekly.generatedAt).toMatch(/^2026-08-27T/)
    expect(yearly.generatedAt).toMatch(/^2026-08-27T/)

    const dailyWeights = horizonChart(daily).slots.map((slot) => slot.catalogWeight)
    expect(dailyWeights.every((weight) => Number.isInteger(weight))).toBe(true)
    expect(dailyWeights.reduce((sum, weight) => sum + weight, 0)).toBe(
      daily.evidence.length,
    )
  })

  it('does not use Math.random in synthesis or the fixture generator', () => {
    expect(synthesisSource).not.toMatch(/Math\.random/)
    expect(generateSource).not.toMatch(/Math\.random/)
  })

  it('returns no grounded cards when a section cites nothing', () => {
    const emptySection: ReportSection = {
      id: 'energyOverview',
      title: 'Energy overview',
      frameworkLabel: 'lens',
      reflection: 'note',
      evidenceIds: [],
    }
    const forecast: ForecastFixture = {
      ...generateForecast(profile, 'daily'),
      sections: [emptySection],
    }
    expect(cardsForSection(forecast, emptySection)).toEqual([])
  })
})
