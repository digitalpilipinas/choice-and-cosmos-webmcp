import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HorizonChart } from '../../src/components/HorizonChart.tsx'
import { horizonChart } from '../../src/domain/synthesis.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'

const profile = {
  displayName: 'You',
  focusIntention: 'finish the draft',
  tone: 'grounded' as const,
}

describe('horizon chart HTML fallback', () => {
  afterEach(() => {
    cleanup()
  })
  it.each(['daily', 'weekly', 'yearly'] as const)(
    'shows every %s slot label and integer weight in a visible table',
    (horizon) => {
      const forecast = generateForecast(profile, horizon)
      const model = horizonChart(forecast)
      render(<HorizonChart model={model} />)

      const table = screen.getByRole('table')
      expect(within(table).getByText(/not probabilities/i)).toBeInTheDocument()
      for (const slot of model.slots) {
        expect(within(table).getByText(slot.label)).toBeInTheDocument()
        expect(
          within(table).getAllByText(String(slot.catalogWeight)).length,
        ).toBeGreaterThan(0)
      }
      expect(model.slots.every((slot) => Number.isInteger(slot.catalogWeight))).toBe(
        true,
      )
    },
  )
})
