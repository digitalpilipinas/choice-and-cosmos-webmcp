import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import { selectWesternSun } from './leaveContext.ts'
import {
  COVERAGE_LEVEL_COPY,
  coverageLevel,
} from '../../src/domain/selectors.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'

const FOCUS = 'finish the draft'

describe('contrast uncertainty', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the coverage-level copy for the generated forecast', async () => {
    const user = userEvent.setup()
    const forecast = generateForecast(
      { displayName: 'You', focusIntention: FOCUS, tone: 'grounded', cosmic: {} },
      'daily',
    )
    const expected = COVERAGE_LEVEL_COPY[coverageLevel(forecast.coverage)]

    render(<App />)
    await user.type(
      screen.getByLabelText(/what's on your mind/i),
      FOCUS,
    )
    await selectWesternSun(user)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await user.click(screen.getByRole('button', { name: 'See the contrast' }))

    expect(await screen.findByText(expected)).toBeInTheDocument()
  })

  it('shows a first-class uncertainty kind, not only coverage-level copy', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(
      screen.getByLabelText(/what's on your mind/i),
      FOCUS,
    )
    await selectWesternSun(user)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await user.click(screen.getByRole('button', { name: 'See the contrast' }))

    const heading = await screen.findByRole('heading', {
      name: 'Uncertainty state',
    })
    const panel = heading.closest('article')
    expect(panel).not.toBeNull()
    expect(within(panel as HTMLElement).getByText('Uncertainty kind: ready')).toBeInTheDocument()
    expect(within(panel as HTMLElement).getByText('Source: fixture')).toBeInTheDocument()
    expect(
      within(panel as HTMLElement).getByText(/not live research/i),
    ).toBeInTheDocument()
    expect(
      within(panel as HTMLElement).getByText(/not a confidence score/i),
    ).toBeInTheDocument()
  })
})
