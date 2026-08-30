import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import { selectWesternSun } from './leaveContext.ts'
import { ContrastPhase } from '../../src/components/phases/ContrastPhase.tsx'
import { CosmosPhase } from '../../src/components/phases/CosmosPhase.tsx'
import { FREE_WILL_NOTE, INITIAL_STATE, fixtureDerivedProfile } from '../../src/domain/loop.ts'
import { LIVE_RESEARCH_NOTICE } from '../../src/domain/synthesis.ts'
import { frameworkKindLabel, studioView } from '../../src/domain/studioView.ts'
import type { AppState, ForecastFixture, HorizonId } from '../../src/domain/types.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'
import { HORIZON_BY_ID } from '../../src/fixtures/horizons.ts'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'

const FOCUS = 'finish the draft'
const PROFILE = {
  displayName: 'You',
  focusIntention: FOCUS,
  tone: 'grounded' as const,
  beliefs: {},
}

function noop(): void {}

function stateWithForecast(
  forecast: ForecastFixture | null,
  horizon: HorizonId,
  profile: typeof PROFILE = PROFILE,
): AppState {
  return {
    ...INITIAL_STATE,
    phase: 'cosmos',
    horizon,
    profile,
    forecastsByHorizon: {
      daily: horizon === 'daily' ? forecast : null,
      weekly: horizon === 'weekly' ? forecast : null,
      yearly: horizon === 'yearly' ? forecast : null,
    },
  }
}

describe('synthesis horizons', { timeout: 15_000 }, () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it.each([
    { id: 'daily' as const, radio: /daily/i, chart: 'Signal window map' },
    { id: 'weekly' as const, radio: /weekly/i, chart: 'Compass window map' },
    { id: 'yearly' as const, radio: /yearly/i, chart: 'Constellation window map' },
  ])(
    'walks $id through evidence, interpretation, uncertainty, and the choice plan',
    async ({ id, radio, chart }) => {
      const user = userEvent.setup()
      const filled = {
        ...INITIAL_STATE.profile,
        ...PROFILE,
        beliefs: { western: { sun: 'leo' as const } },
      }
      const forecast = generateForecast(fixtureDerivedProfile(filled), id)

      render(<App />)
      await user.click(screen.getByRole('radio', { name: radio }))
      await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
      await selectWesternSun(user)
      await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))

      await screen.findByRole('heading', { name: 'Cosmos' })
      expect(screen.getByText(FREE_WILL_NOTE)).toBeInTheDocument()
      expect(screen.getByText(LIVE_RESEARCH_NOTICE)).toBeInTheDocument()
      expect(screen.getByRole('img', { name: new RegExp(chart) })).toBeInTheDocument()
      expect(
        screen.getAllByText('Reflective interpretation').length,
      ).toBeGreaterThan(0)
      expect(screen.getAllByText('Grounded source notes').length).toBeGreaterThan(0)
      expect(
        screen.getAllByText(frameworkKindLabel('reflective')).length,
      ).toBeGreaterThan(0)
      expect(screen.getByRole('heading', { name: 'Skipped lenses' })).toBeInTheDocument()

      const reading = studioView(stateWithForecast(forecast, id, filled)).reading
      if (reading.status !== 'ready') {
        throw new Error('expected ready reading')
      }
      expect(reading.sections.length).toBeLessThan(forecast.sections.length)
      for (const section of reading.sections) {
        const block = screen.getByText(section.title).closest('details')
        expect(block).not.toBeNull()
        expect(section.evidence.length).toBeGreaterThan(0)
        for (const card of section.evidence) {
          expect(
            within(block as HTMLElement).getByText(card.id),
          ).toBeInTheDocument()
        }
      }
      const skippedList = screen.getByRole('heading', { name: 'Skipped lenses' })
        .closest('article')
      expect(skippedList).not.toBeNull()
      for (const skipped of reading.skippedLenses) {
        expect(
          within(skippedList as HTMLElement).getByText(skipped.lens, {
            exact: false,
          }),
        ).toBeInTheDocument()
      }

      await user.click(screen.getByRole('button', { name: 'See the contrast' }))
      await screen.findByRole('heading', { name: 'Contrast' })
      expect(screen.getByText(FREE_WILL_NOTE)).toBeInTheDocument()
      expect(screen.getByText(LIVE_RESEARCH_NOTICE)).toBeInTheDocument()
      expect(screen.getByRole('img', { name: new RegExp(chart) })).toBeInTheDocument()
      expect(screen.getAllByText('Uncertainty kind: ready').length).toBeGreaterThan(0)
      expect(
        screen.getAllByText(/not a confidence score/i).length,
      ).toBeGreaterThan(0)
      expect(screen.getAllByText('local_fixture').length).toBeGreaterThan(0)
      expect(
        screen.getAllByText('None. Fixture examples do not invent live links.')
          .length,
      ).toBeGreaterThan(0)

      await user.click(screen.getByRole('button', { name: 'Choose your steps' }))
      await screen.findByRole('heading', { name: 'Choice' })
      for (const step of forecast.suggestedSteps) {
        expect(screen.getByText(step.title)).toBeInTheDocument()
      }
      expect(screen.getByText(HORIZON_BY_ID[id].label)).toBeInTheDocument()
    },
    15_000,
  )

  it('shows unavailable synthesis when no forecast is in memory', () => {
    render(<CosmosPhase studio={studioView(stateWithForecast(null, 'daily'))} dispatch={noop} />)
    expect(
      screen.getByText(/no reading is in memory yet/i),
    ).toBeInTheDocument()
    expect(screen.getByText(LIVE_RESEARCH_NOTICE)).toBeInTheDocument()
    expect(screen.getByText('Uncertainty kind: unavailable')).toBeInTheDocument()

    cleanup()
    render(
      <ContrastPhase studio={studioView(stateWithForecast(null, 'daily'))} dispatch={noop} />,
    )
    expect(
      screen.getByText(/no reading is in memory yet/i),
    ).toBeInTheDocument()
    expect(screen.getByText(LIVE_RESEARCH_NOTICE)).toBeInTheDocument()
    expect(
      screen.getAllByText('Uncertainty kind: unavailable').length,
    ).toBeGreaterThan(0)
  })

  it('shows partial fallback when a forecast used no sources', () => {
    const ready = generateForecast(fixtureDerivedProfile(PROFILE), 'daily')
    const partial: ForecastFixture = {
      ...ready,
      evidence: [],
      coverage: { ...ready.coverage, sourcesUsed: 0 },
      sections: ready.sections.map((section) => ({
        ...section,
        evidenceIds: [],
      })),
    }

    render(
      <ContrastPhase
        studio={studioView(stateWithForecast(partial, 'daily'))}
        dispatch={noop}
      />,
    )
    expect(screen.getAllByText('Uncertainty kind: partial').length).toBeGreaterThan(0)
    expect(screen.getByText(LIVE_RESEARCH_NOTICE)).toBeInTheDocument()
    expect(screen.queryAllByText('No evidence IDs cited')).toHaveLength(0)

    cleanup()
    const cosmos = studioView(stateWithForecast(partial, 'daily'))
    if (cosmos.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    render(
      <CosmosPhase studio={cosmos} dispatch={noop} />,
    )
    expect(screen.getAllByText('No evidence IDs cited').length).toBe(
      cosmos.reading.sections.length,
    )
  })
})
