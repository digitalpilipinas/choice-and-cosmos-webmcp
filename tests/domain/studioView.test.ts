import { describe, expect, it } from 'vitest'
import { mustInstant } from '../../src/domain/brand.ts'
import { INITIAL_STATE } from '../../src/domain/loop.ts'
import {
  applySetResonance,
  hasReadableCorpus,
  studioView,
} from '../../src/domain/studioView.ts'
import { packetDigest, skippedLensesFor } from '../../src/domain/trust.ts'
import type { AppState, ForecastFixture, ReportSection } from '../../src/domain/types.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'
import { parseReadingPacketV1, type ReadingPacketV1 } from '../../src/research/packet.ts'
import studioSource from '../../src/domain/studioView.ts?raw'

const PROFILE = {
  displayName: 'You',
  focusIntention: 'protect one block of attention',
  tone: 'grounded' as const,
  beliefs: {},
}

const WEEKLY_PACKET = {
  schemaVersion: 1 as const,
  horizon: 'weekly' as const,
  sources: [
    {
      id: 'ev_week_energy',
      title: 'Weekly energy note',
      url: 'https://example.com/weekly-energy',
      snippet: 'A current weekly energy note.',
      domain: 'example.com',
      provenance: {
        provider: 'agent' as const,
        method: 'untrusted_submission' as const,
        query: 'weekly energy',
      },
    },
    {
      id: 'ev_week_decision',
      title: 'Weekly decision note',
      url: 'https://example.com/weekly-decision',
      snippet: 'A current weekly decision note.',
      domain: 'example.com',
      provenance: {
        provider: 'agent' as const,
        method: 'untrusted_submission' as const,
        query: 'weekly decision',
      },
    },
  ],
  sections: [
    {
      id: 'energyOverview' as const,
      title: 'Energy',
      frameworkLabel: 'Reflective framework',
      reflection: 'Sit with the week.',
      evidenceIds: ['ev_week_energy'],
    },
    {
      id: 'decisionSupport' as const,
      title: 'Decision',
      frameworkLabel: 'Reflective framework',
      reflection: 'Choose one reversible move.',
      evidenceIds: ['ev_week_decision', 'ev_week_energy'],
    },
  ],
}

function parsedWeekly(): ReadingPacketV1 {
  const packet = parseReadingPacketV1(WEEKLY_PACKET)
  if (packet === null) {
    throw new Error('expected weekly packet')
  }
  return packet
}

function fixtureState(forecast: ForecastFixture, horizon: AppState['horizon'] = 'daily'): AppState {
  return {
    ...INITIAL_STATE,
    phase: 'cosmos',
    horizon,
    profile: PROFILE,
    forecastsByHorizon: {
      daily: horizon === 'daily' ? forecast : null,
      weekly: horizon === 'weekly' ? forecast : null,
      yearly: horizon === 'yearly' ? forecast : null,
    },
  }
}

function adoptedWeeklyState(input?: {
  elementCounts?: { wood?: number; fire?: number }
  resonance?: AppState['resonanceByHorizon']
  alsoFixture?: boolean
}): AppState {
  const packet = parsedWeekly()
  const beliefs = input?.elementCounts
    ? { bazi: { dayMaster: 'jia' as const, elementCounts: input.elementCounts } }
    : PROFILE.beliefs
  const adoptedAt = mustInstant(Date.parse('2026-08-29T12:00:00.000Z'))
  const fixture = input?.alsoFixture
    ? generateForecast(
        {
          displayName: 'You',
          focusIntention: PROFILE.focusIntention,
          tone: 'grounded',
          cosmic: {},
        },
        'weekly',
      )
    : null
  return {
    ...INITIAL_STATE,
    phase: 'cosmos',
    horizon: 'weekly',
    profile: { ...PROFILE, beliefs },
    forecastsByHorizon: {
      daily: null,
      weekly: fixture,
      yearly: null,
    },
    readingsByHorizon: {
      daily: null,
      weekly: {
        horizon: packet.horizon,
        adoptedAt,
        packetDigest: packetDigest(packet),
        sources: packet.sources,
        sections: packet.sections,
        coverage: {
          sourcesConsidered: packet.sources.length,
          sourcesUsed: packet.sources.length,
          timeWindowDescription: 'Adopted from a reviewed reading packet.',
          stoppingReason:
            'The person adopted this packet. It is not an exhaustive search.',
          mode: 'adopted',
          exhaustive: false,
        },
        skippedLenses: skippedLensesFor(packet, beliefs),
      },
      yearly: null,
    },
    resonanceByHorizon: input?.resonance ?? {
      daily: null,
      weekly: null,
      yearly: null,
    },
  }
}

describe('studioView', () => {
  it('prefers an adopted reading over a fixture on the same horizon', () => {
    const state = adoptedWeeklyState({ alsoFixture: true })
    const view = studioView(state)
    expect(view.reading.status).toBe('ready')
    if (view.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    expect(view.reading.legacyBadge).toBeNull()
    expect(view.reading.sections).toHaveLength(2)
    expect(view.reading.sections.map((section) => section.id)).toEqual([
      'energyOverview',
      'decisionSupport',
    ])
    expect(view.reading.charts.some((chart) => chart.id === 'window')).toBe(false)
    expect(hasReadableCorpus(state)).toBe(true)
  })

  it('renders an adopted weekly two-section packet with no weekly fixture', () => {
    const state = adoptedWeeklyState()
    expect(state.forecastsByHorizon.weekly).toBeNull()
    const view = studioView(state)
    expect(hasReadableCorpus(state)).toBe(true)
    expect(view.reading.status).toBe('ready')
    if (view.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    expect(view.reading.sections).toHaveLength(2)
    expect(view.reading.legacyBadge).toBeNull()
    expect(view.cockpit.generatedAt).toBe('2026-08-29T12:00:00.000Z')
    expect(view.coverage).toBe(view.reading.coverage)
    expect(view.coverage?.exhaustive).toBe(false)
  })

  it('exposes skipped-lens copy from the adopted artifact', () => {
    const state = adoptedWeeklyState()
    const view = studioView(state)
    if (view.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    expect(view.reading.skippedLenses.length).toBeGreaterThan(0)
    expect(
      view.reading.skippedLenses.some((item) => item.lens === 'westernAstrology'),
    ).toBe(true)
    expect(
      view.reading.skippedLenses.every(
        (item) => item.reason.trim().length > 0 && item.lens !== 'energyOverview',
      ),
    ).toBe(true)
  })

  it('keeps https URLs on adopted evidence cards', () => {
    const state = adoptedWeeklyState()
    const view = studioView(state)
    if (view.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    expect(view.reading.evidence).toHaveLength(2)
    for (const card of view.reading.evidence) {
      expect(card.url).toMatch(/^https:\/\//)
      expect(card.urlLabel).toBe(card.url)
      expect(card.retrievedAt).toBeNull()
    }
  })

  it('leaves fixture evidence URLs null', () => {
    const forecast = generateForecast(
      {
        displayName: 'You',
        focusIntention: PROFILE.focusIntention,
        tone: 'grounded',
        cosmic: {},
      },
      'daily',
    )
    const view = studioView(fixtureState(forecast))
    if (view.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    expect(view.reading.legacyBadge).toBe('legacy')
    for (const card of view.reading.evidence) {
      expect(card.url).toBeNull()
      expect(card.urlLabel).toMatch(/do not invent live links/i)
    }
  })

  it('builds a citation chart from adopted section evidence ids', () => {
    const state = adoptedWeeklyState()
    const view = studioView(state)
    if (view.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    const citation = view.reading.charts.find((chart) => chart.id === 'citations')
    expect(citation).toBeDefined()
    expect(citation?.slots).toEqual([
      { id: 'energyOverview', label: 'Energy', value: 1 },
      { id: 'decisionSupport', label: 'Decision', value: 2 },
    ])
    expect(citation?.caption).toMatch(/not probabilities/i)
    expect(view.reading.charts.some((chart) => chart.id === 'elements')).toBe(
      false,
    )
  })

  it('adds a BaZi chart only when elementCounts are present', () => {
    const without = studioView(adoptedWeeklyState())
    if (without.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    expect(without.reading.charts.map((chart) => chart.id)).toEqual(['citations'])

    const withCounts = studioView(
      adoptedWeeklyState({ elementCounts: { wood: 3, fire: 1 } }),
    )
    if (withCounts.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    const elements = withCounts.reading.charts.find((chart) => chart.id === 'elements')
    expect(elements?.slots).toEqual([
      { id: 'wood', label: 'Wood', value: 3 },
      { id: 'fire', label: 'Fire', value: 1 },
    ])
    expect(elements?.slots.some((slot) => slot.id === 'earth')).toBe(false)
  })

  it('clips resonance marks to visible section ids without deleting stored keys', () => {
    const state = adoptedWeeklyState({
      resonance: {
        daily: null,
        weekly: {
          energyOverview: 'resonates',
          numerology: 'not-for-me',
        },
        yearly: null,
      },
    })
    const view = studioView(state)
    if (view.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    expect(view.reading.sections.map((section) => section.id)).toEqual([
      'energyOverview',
      'decisionSupport',
    ])
    expect(
      view.reading.sections.find((section) => section.id === 'energyOverview')
        ?.resonanceMark,
    ).toBe('resonates')
    expect(
      view.reading.sections.find((section) => section.id === 'decisionSupport')
        ?.resonanceMark,
    ).toBeNull()
    expect(state.resonanceByHorizon.weekly?.numerology).toBe('not-for-me')

    const hidden = applySetResonance(state, {
      type: 'SET_RESONANCE',
      sectionId: 'numerology',
      mark: 'unsure',
    })
    expect(hidden).toBe(state)

    const marked = applySetResonance(state, {
      type: 'SET_RESONANCE',
      sectionId: 'decisionSupport',
      mark: 'unsure',
    })
    expect(marked.resonanceByHorizon.weekly?.decisionSupport).toBe('unsure')
    expect(marked.resonanceByHorizon.weekly?.numerology).toBe('not-for-me')

    const again = applySetResonance(marked, {
      type: 'SET_RESONANCE',
      sectionId: 'decisionSupport',
      mark: 'unsure',
    })
    expect(again).toBe(marked)
  })

  it('builds deterministic fixture window charts with integer values', () => {
    const profile = {
      displayName: 'You',
      focusIntention: 'the same question twice',
      tone: 'grounded' as const,
      cosmic: {},
    }
    const daily = generateForecast(profile, 'daily')
    const weekly = generateForecast(profile, 'weekly')
    const yearly = generateForecast(profile, 'yearly')
    const dailyView = studioView(fixtureState(daily, 'daily'))
    const weeklyView = studioView(fixtureState(weekly, 'weekly'))
    const yearlyView = studioView(fixtureState(yearly, 'yearly'))
    if (
      dailyView.reading.status !== 'ready' ||
      weeklyView.reading.status !== 'ready' ||
      yearlyView.reading.status !== 'ready'
    ) {
      throw new Error('expected ready readings')
    }
    expect(dailyView.reading.charts[0]?.title).toBe('Signal window map')
    expect(weeklyView.reading.charts[0]?.title).toBe('Compass window map')
    expect(yearlyView.reading.charts[0]?.title).toBe('Constellation window map')
    expect(dailyView.reading.charts[0]?.slots).toHaveLength(4)
    expect(weeklyView.reading.charts[0]?.slots).toHaveLength(7)
    expect(yearlyView.reading.charts[0]?.slots).toHaveLength(4)
    const values = dailyView.reading.charts[0]?.slots.map((slot) => slot.value) ?? []
    expect(values.every((value) => Number.isInteger(value))).toBe(true)
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(daily.evidence.length)
    expect(studioView(fixtureState(daily, 'daily')).reading).toEqual(dailyView.reading)
  })

  it('returns no grounded cards when a fixture section cites nothing', () => {
    const emptySection: ReportSection = {
      id: 'energyOverview',
      title: 'Energy overview',
      frameworkLabel: 'lens',
      reflection: 'note',
      evidenceIds: [],
    }
    const forecast: ForecastFixture = {
      ...generateForecast(
        {
          displayName: 'You',
          focusIntention: PROFILE.focusIntention,
          tone: 'grounded',
          cosmic: {},
        },
        'daily',
      ),
      sections: [emptySection],
    }
    const view = studioView(fixtureState(forecast))
    if (view.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    expect(view.reading.sections[0]?.evidence).toEqual([])
  })

  it('does not use Math.random', () => {
    expect(studioSource).not.toMatch(/Math\.random/)
  })

  it('offers fixture resonance only for lenses the same brief plan would request', () => {
    const forecast = generateForecast(
      {
        displayName: 'You',
        focusIntention: PROFILE.focusIntention,
        tone: 'grounded',
        cosmic: { sunSign: 'virgo' },
      },
      'daily',
    )
    expect(forecast.sections.map((section) => section.id)).toHaveLength(11)
    const state: AppState = {
      ...fixtureState(forecast),
      profile: {
        ...PROFILE,
        beliefs: { western: { sun: 'virgo' } },
      },
    }
    const view = studioView(state)
    if (view.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    expect(view.brief?.requestedLenses).toEqual([
      'energyOverview',
      'westernAstrology',
      'decisionSupport',
      'focusActionPlan',
    ])
    expect(view.reading.legacyBadge).toBe('legacy')
    expect(view.reading.sections.map((section) => section.id)).toEqual(
      view.brief?.requestedLenses,
    )
    expect(view.reading.skippedLenses.map((item) => item.lens)).toEqual(
      view.brief?.skippedLenses.map((item) => item.lens),
    )
    expect(
      view.reading.skippedLenses.some((item) => item.lens === 'numerology'),
    ).toBe(true)
    expect(
      view.reading.sections.some((section) => section.id === 'numerology'),
    ).toBe(false)
    expect(
      applySetResonance(state, {
        type: 'SET_RESONANCE',
        sectionId: 'numerology',
        mark: 'resonates',
      }),
    ).toBe(state)
    const marked = applySetResonance(state, {
      type: 'SET_RESONANCE',
      sectionId: 'westernAstrology',
      mark: 'resonates',
    })
    expect(marked.resonanceByHorizon.daily?.westernAstrology).toBe('resonates')
  })

  it('sets print and calendar unavailable when the corpus is a fixture', () => {
    const forecast = generateForecast(
      {
        displayName: 'You',
        focusIntention: PROFILE.focusIntention,
        tone: 'grounded',
        cosmic: {},
      },
      'daily',
    )
    const view = studioView(fixtureState(forecast))
    expect(view.continuity.print.kind).toBe('unavailable')
    expect(view.continuity.calendar.kind).toBe('unavailable')
    if (
      view.continuity.print.kind !== 'unavailable' ||
      view.continuity.calendar.kind !== 'unavailable'
    ) {
      throw new Error('expected unavailable export slices')
    }
    expect(view.continuity.print.reason).toMatch(/fixture/i)
    expect(view.continuity.calendar.reason).toMatch(/fixture/i)
  })
})
