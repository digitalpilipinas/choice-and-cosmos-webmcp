import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import { LIVE_RESEARCH_NOTICE } from '../../src/domain/synthesis.ts'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'

const FOCUS = 'finish the draft'

describe('Context cosmic fields', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it('sets and clears sun sign behind the western lens, leaves omitted fields empty, and advances with focus plus a module', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      screen.getByText(/does not collect a birth date, birth time, or birth location/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/never infers optional signs or numbers/i),
    ).toBeInTheDocument()
    expect(document.querySelector('input[type="date"]')).toBeNull()
    expect(document.querySelector('input[type="time"]')).toBeNull()
    expect(
      screen.queryByRole('textbox', { name: /birth date|birth time|birth location/i }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText(/any self-supplied belief-system fields you entered/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/only in this browser profile/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Optional cosmic details')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Sun sign' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await user.click(screen.getByRole('checkbox', { name: /western astrology/i }))
    const sun = screen.getByRole('group', { name: 'Sun sign' })
    const sunNotProvided = within(sun).getByRole('radio', {
      name: 'Not provided',
    })
    expect(sunNotProvided).toBeChecked()
    expect(within(sun).getByRole('radio', { name: 'Leo' })).not.toBeChecked()

    await user.click(within(sun).getByRole('radio', { name: 'Leo' }))
    expect(within(sun).getByRole('radio', { name: 'Leo' })).toBeChecked()
    expect(sunNotProvided).not.toBeChecked()

    await user.click(sunNotProvided)
    expect(sunNotProvided).toBeChecked()
    expect(within(sun).getByRole('radio', { name: 'Leo' })).not.toBeChecked()

    const moon = screen.getByRole('group', { name: 'Moon sign' })
    expect(
      within(moon).getByRole('radio', { name: 'Not provided' }),
    ).toBeChecked()
    expect(within(moon).getByRole('radio', { name: 'Leo' })).not.toBeChecked()

    await user.click(within(sun).getByRole('radio', { name: 'Leo' }))
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await screen.findByRole('heading', { name: 'Cosmos' })
    expect(screen.getByText(LIVE_RESEARCH_NOTICE)).toBeInTheDocument()
    expect(LIVE_RESEARCH_NOTICE).toMatch(/legacy, non-personalized/)
    expect(LIVE_RESEARCH_NOTICE).toMatch(/did not search the internet/)
  })
})
