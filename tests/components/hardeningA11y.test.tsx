import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import { FREE_WILL_NOTE } from '../../src/domain/loop.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'

const FOCUS = 'finish the draft'

describe('P5 hardening a11y', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it('exposes a skip link and a main landmark', async () => {
    render(<App />)
    expect(
      screen.getByRole('link', { name: 'Skip to the loop' }),
    ).toHaveAttribute('href', '#main-content')
    expect(document.getElementById('main-content')?.tagName).toBe('MAIN')
  })

  it('keeps unique evidence heading ids and free-will copy on Cosmos', async () => {
    const user = userEvent.setup()
    const forecast = generateForecast(
      { displayName: 'You', focusIntention: FOCUS, tone: 'grounded' },
      'daily',
    )
    render(<App />)
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await screen.findByRole('heading', { name: 'Cosmos' })

    expect(screen.getByText(FREE_WILL_NOTE)).toBeInTheDocument()
    const ids = [...document.querySelectorAll('h4[id^="evidence-"]')].map(
      (node) => node.id,
    )
    expect(ids.length).toBeGreaterThan(1)
    expect(new Set(ids).size).toBe(ids.length)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(forecast.sections).toHaveLength(11)
  })

  it('focuses a report summary and toggles native disclosure', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await screen.findByRole('heading', { name: 'Cosmos' })

    const second = [...document.querySelectorAll('.report-section')][1] as
      | HTMLDetailsElement
      | undefined
    expect(second).toBeDefined()
    expect(second?.open).toBe(false)
    const summary = second?.querySelector('summary')
    expect(summary).toBeInstanceOf(HTMLElement)
    summary?.focus()
    expect(summary).toHaveFocus()
    await user.click(summary as HTMLElement)
    expect(second?.open).toBe(true)
  })
})
