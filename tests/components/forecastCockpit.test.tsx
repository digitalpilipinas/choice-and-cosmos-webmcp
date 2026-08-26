import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'

const FOCUS = 'finish the draft'

describe('forecast cockpit', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it.each([
    { horizon: /daily/i, name: 'Signal' },
    { horizon: /weekly/i, name: 'Compass' },
    { horizon: /yearly/i, name: 'Constellation' },
  ])('shows $name in the cockpit for the matching horizon', async ({
    horizon,
    name,
  }) => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('radio', { name: horizon }))
    await user.type(
      screen.getByLabelText(/what's on your mind/i),
      FOCUS,
    )
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))

    const cockpit = await screen.findByRole('article', {
      name: 'Forecast cockpit',
    })
    expect(within(cockpit).getByText(name)).toBeInTheDocument()
    expect(within(cockpit).getByText(FOCUS)).toBeInTheDocument()
    expect(within(cockpit).queryByText('Not generated')).toBeNull()
  })
})
