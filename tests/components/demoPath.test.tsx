import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import { selectWesternSun } from './leaveContext.ts'
import { FREE_WILL_NOTE } from '../../src/domain/loop.ts'
import { LIVE_RESEARCH_NOTICE } from '../../src/domain/synthesis.ts'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'

const FOCUS = 'finish the draft'

describe('documented demo path', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it('walks Context through Continuity with the expected on-page states', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      await screen.findByText(/does not expose document.modelContext.registerTool/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Context' })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /weekly/i }))
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await selectWesternSun(user)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))

    await screen.findByRole('heading', { name: 'Cosmos' })
    expect(screen.getByText(FREE_WILL_NOTE)).toBeInTheDocument()
    expect(screen.getByText(LIVE_RESEARCH_NOTICE)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Compass window map/ })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByText('Grounded source notes').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Reflective interpretation').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await screen.findByRole('heading', { name: 'Contrast' })
    expect(screen.getAllByText('Uncertainty kind: ready').length).toBeGreaterThan(0)
    expect(screen.getAllByText('local_fixture').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Choose your steps' }))
    await screen.findByRole('heading', { name: 'Choice' })
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Review this session' }))
    await screen.findByRole('heading', { name: 'Continuity' })
    expect(screen.getByRole('heading', { name: 'Continuity' })).toBeInTheDocument()
  })
})
