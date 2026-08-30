import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import { ContextPhase } from '../../src/components/phases/ContextPhase.tsx'
import { INITIAL_STATE } from '../../src/domain/loop.ts'
import { studioView } from '../../src/domain/studioView.ts'
import type { PersonProfile } from '../../src/domain/types.ts'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'
import { selectWesternSun } from './leaveContext.ts'

const FOCUS = 'finish the draft'

function renderContext(profile: Partial<PersonProfile>) {
  const state = {
    ...INITIAL_STATE,
    profile: { ...INITIAL_STATE.profile, ...profile },
  }
  return render(
    <ContextPhase studio={studioView(state)} dispatch={() => undefined} />,
  )
}

describe('Context lens intake', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows first-use welcome copy for value, WebMCP bounds, and free will', async () => {
    render(<App />)
    expect(
      await screen.findByRole('heading', { name: 'How this workspace works' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/consented personal-guidance workspace/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/researches the open web with its own subscription/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/researcher and navigator, not the source of truth/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /discover tools, request approved context, research independently, and submit a bounded cited packet/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /may not approve profile access, adopt a packet, accept resonance, save a plan, export, or read browser storage/i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/You retain free will/i)).toBeInTheDocument()
    expect(
      screen.getByText(/reflective lenses, not predictions or objective facts/i),
    ).toBeInTheDocument()
    expect(document.querySelector('input[type="date"]')).toBeNull()
    expect(document.querySelector('input[type="time"]')).toBeNull()
    expect(
      screen.queryByRole('textbox', { name: /birth date|birth time|birth location/i }),
    ).not.toBeInTheDocument()
  })

  it('compacts onboarding when a belief module already exists', () => {
    renderContext({
      focusIntention: FOCUS,
      beliefs: { western: { sun: 'leo' } },
    })
    expect(
      screen.queryByRole('heading', { name: 'How this workspace works' }),
    ).not.toBeInTheDocument()
    const summary = screen.getByText('How this workspace works')
    const details = summary.closest('details')
    expect(details).not.toBeNull()
    expect(details?.open).toBe(false)
    expect(
      screen.getByRole('checkbox', { name: /western astrology/i }),
    ).toBeChecked()
    expect(screen.getByRole('group', { name: 'Sun sign' })).toBeInTheDocument()
  })

  it('reveals fields for selected lenses, supports multi-select, and removes unselected fields from the document', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Context' })

    expect(screen.queryByRole('group', { name: 'Sun sign' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Life Path' })).not.toBeInTheDocument()
    expect(screen.getByText('No lenses selected.')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /western astrology/i }))
    expect(screen.getByRole('group', { name: 'Sun sign' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Moon sign' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Rising sign' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Life Path' })).not.toBeInTheDocument()
    expect(screen.getByText(/Selected lenses: Western Astrology/i)).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /numerology/i }))
    expect(screen.getByRole('group', { name: 'Sun sign' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Life Path' })).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Birthday number' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /western astrology/i }))
    expect(screen.queryByRole('group', { name: 'Sun sign' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Life Path' })).toBeInTheDocument()
  })

  it('requires focus and a supplied module, keeps tone optional, and does not require sun when another value supplies a module', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Context' })

    const continueButton = screen.getByRole('button', { name: 'Open the cosmos' })
    expect(continueButton).toBeDisabled()
    const context = screen.getByRole('region', { name: 'Context' })
    expect(within(context).getByRole('status')).toHaveTextContent(
      /focus intention and select a lens with at least one self-supplied value/i,
    )
    expect(screen.getByRole('group', { name: 'Horizon (required)' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Tone (optional)' })).toBeInTheDocument()
    expect(
      screen.getByLabelText(/what's on your mind right now\? \(required\)/i),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    expect(
      screen.getByRole('heading', { name: 'How this workspace works' }),
    ).toBeInTheDocument()
    expect(continueButton).toBeDisabled()
    expect(within(context).getByRole('status')).toHaveTextContent(
      /select a lens and enter at least one self-supplied value/i,
    )

    await user.click(screen.getByRole('checkbox', { name: /western astrology/i }))
    expect(continueButton).toBeDisabled()

    const moon = screen.getByRole('group', { name: 'Moon sign' })
    await user.click(within(moon).getByRole('radio', { name: 'Leo' }))
    expect(continueButton).toBeEnabled()
    expect(within(context).queryByRole('status')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /western astrology/i }))
    expect(continueButton).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /numerology/i }))
    const lifePath = screen.getByRole('group', { name: 'Life Path' })
    await user.click(within(lifePath).getByRole('radio', { name: '7' }))
    expect(continueButton).toBeEnabled()
    expect(screen.queryByRole('group', { name: 'Sun sign' })).not.toBeInTheDocument()
  })

  it('lets keyboard users operate lens checkboxes and radios, then enables continue', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Context' })

    const continueButton = screen.getByRole('button', { name: 'Open the cosmos' })
    expect(continueButton).toBeDisabled()

    const western = screen.getByRole('checkbox', { name: /western astrology/i })
    western.focus()
    await user.keyboard(' ')
    expect(western).toBeChecked()

    const sun = screen.getByRole('group', { name: 'Sun sign' })
    const leo = within(sun).getByRole('radio', { name: 'Leo' })
    leo.focus()
    await user.keyboard(' ')
    expect(leo).toBeChecked()

    const weekly = screen.getByRole('radio', { name: /weekly/i })
    weekly.focus()
    await user.keyboard(' ')
    expect(weekly).toBeChecked()

    expect(continueButton).toBeDisabled()
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    expect(continueButton).toBeEnabled()
    await user.click(continueButton)
    await screen.findByRole('heading', { name: 'Cosmos' })
  })

  it('clears a filled module when its lens is unchecked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Context' })
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await selectWesternSun(user)
    expect(screen.getByRole('button', { name: 'Open the cosmos' })).toBeEnabled()

    await user.click(screen.getByRole('checkbox', { name: /western astrology/i }))
    expect(screen.queryByRole('group', { name: 'Sun sign' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open the cosmos' })).toBeDisabled()
    expect(screen.getByText('No lenses selected.')).toBeInTheDocument()
  })
})
