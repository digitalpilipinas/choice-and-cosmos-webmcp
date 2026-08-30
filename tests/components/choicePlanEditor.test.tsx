import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import { selectWesternSun } from './leaveContext.ts'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'

const FOCUS = 'finish the draft'
const CUSTOM_TITLE = 'Walk around the block'
const FIXTURE_TITLES = [
  'Name the next honest hour',
  'Make one reversible move',
  'Close the window on purpose',
]

describe('choice plan editor', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it('adds a custom step with a Remove control and leaves fixture steps in place', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByLabelText(/what's on your mind/i),
      FOCUS,
    )
    await selectWesternSun(user)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await user.click(screen.getByRole('button', { name: 'Choose your steps' }))

    await screen.findByRole('heading', { name: 'Choice' })

    for (const title of FIXTURE_TITLES) {
      const heading = screen.getByRole('heading', { name: title })
      const step = heading.closest('li')
      expect(step).not.toBeNull()
      expect(within(step as HTMLElement).queryByRole('button', { name: 'Remove' })).toBeNull()
    }

    await user.type(screen.getByLabelText('Step title'), CUSTOM_TITLE)
    await user.type(screen.getByLabelText('Note (optional)'), 'if it still fits')
    await user.click(screen.getByRole('button', { name: 'Add step' }))

    const customHeading = await screen.findByRole('heading', { name: CUSTOM_TITLE })
    const customStep = customHeading.closest('li')
    expect(customStep).not.toBeNull()
    const remove = within(customStep as HTMLElement).getByRole('button', {
      name: 'Remove',
    })
    await user.click(remove)

    expect(screen.queryByRole('heading', { name: CUSTOM_TITLE })).toBeNull()
    for (const title of FIXTURE_TITLES) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('keeps an accepted fixture step and a custom step after leaving Daily and reopening it', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(
      screen.getByLabelText(/what's on your mind/i),
      FOCUS,
    )
    await selectWesternSun(user)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await user.click(screen.getByRole('button', { name: 'Choose your steps' }))

    const fixtureHeading = await screen.findByRole('heading', {
      name: 'Name the next honest hour',
    })
    const fixtureStep = fixtureHeading.closest('li')
    expect(fixtureStep).not.toBeNull()
    await user.click(
      within(fixtureStep as HTMLElement).getByRole('button', { name: 'Accept' }),
    )
    expect(
      within(fixtureStep as HTMLElement).getByText('Currently accepted'),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('Step title'), 'Review the opening')
    await user.click(screen.getByRole('button', { name: 'Add step' }))
    expect(
      await screen.findByRole('heading', { name: 'Review the opening' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))

    await user.click(screen.getByRole('radio', { name: /weekly/i }))
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('radio', { name: /daily/i }))
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await user.click(screen.getByRole('button', { name: 'Choose your steps' }))

    const reopenedHeading = await screen.findByRole('heading', {
      name: 'Name the next honest hour',
    })
    const reopenedStep = reopenedHeading.closest('li')
    expect(reopenedStep).not.toBeNull()
    expect(
      within(reopenedStep as HTMLElement).getByText('Currently accepted'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Review the opening' }),
    ).toBeInTheDocument()
  })

  it('does not describe choice notes as session-only after saving is on', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await selectWesternSun(user)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await user.click(screen.getByRole('button', { name: 'Choose your steps' }))
    await screen.findByRole('heading', { name: 'Choice' })

    expect(
      screen.getAllByPlaceholderText(/stays in this tab unless you choose to save/)
        .length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByPlaceholderText(/this session only/),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save on this device' }))
    await screen.findByText(/Saved on this device/)
    expect(
      screen.getAllByPlaceholderText(/stored with this session on this device/)
        .length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByPlaceholderText(/this session only/),
    ).not.toBeInTheDocument()
  })
})
