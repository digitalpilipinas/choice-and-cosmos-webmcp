import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ChartFigure } from '../../src/components/ChartFigure.tsx'
import { studioView } from '../../src/domain/studioView.ts'
import { INITIAL_STATE } from '../../src/domain/loop.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'

const profile = {
  displayName: 'You',
  focusIntention: 'finish the draft',
  tone: 'grounded' as const,
  cosmic: {},
}

describe('chart HTML fallback', () => {
  afterEach(() => {
    cleanup()
  })
  it.each(['daily', 'weekly', 'yearly'] as const)(
    'shows every %s slot label and integer value in a visible table',
    (horizon) => {
      const forecast = generateForecast(profile, horizon)
      const view = studioView({
        ...INITIAL_STATE,
        horizon,
        profile: {
          displayName: 'You',
          focusIntention: 'finish the draft',
          tone: 'grounded',
          beliefs: {},
        },
        forecastsByHorizon: {
          daily: horizon === 'daily' ? forecast : null,
          weekly: horizon === 'weekly' ? forecast : null,
          yearly: horizon === 'yearly' ? forecast : null,
        },
      })
      if (view.reading.status !== 'ready') {
        throw new Error('expected ready reading')
      }
      const model = view.reading.charts[0]
      if (model === undefined) {
        throw new Error('expected a chart')
      }
      render(<ChartFigure model={model} />)

      const table = screen.getByRole('table')
      expect(within(table).getByText(/not probabilities/i)).toBeInTheDocument()
      for (const slot of model.slots) {
        expect(within(table).getByText(slot.label)).toBeInTheDocument()
        expect(
          within(table).getAllByText(String(slot.value)).length,
        ).toBeGreaterThan(0)
      }
      expect(model.slots.every((slot) => Number.isInteger(slot.value))).toBe(true)
    },
  )
})
