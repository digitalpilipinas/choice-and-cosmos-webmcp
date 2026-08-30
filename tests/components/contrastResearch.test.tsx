import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.tsx'
import { selectWesternSun } from './leaveContext.ts'
import { ContrastResearch } from '../../src/components/research/ContrastResearch.tsx'
import { CONTRAST_RESEARCH_IDLE_NOTICE } from '../../src/domain/synthesis.ts'
import { INITIAL_STATE, type AppAction } from '../../src/domain/loop.ts'
import { studioView } from '../../src/domain/studioView.ts'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'

const FOCUS = 'finish the draft'

describe('Contrast reading packet panel', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('does not offer hosted search and never fetches', () => {
    const dispatch = (_action: AppAction) => undefined
    render(
      <ContrastResearch
        intake={studioView(INITIAL_STATE).intake}
        dispatch={dispatch}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Reading packet' })).toBeInTheDocument()
    expect(screen.getByText(CONTRAST_RESEARCH_IDLE_NOTICE)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /search/i }),
    ).not.toBeInTheDocument()
  })
})

describe('Contrast in the app', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps the fixture path without a Gemini dialog or fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)
    const focusField = await screen.findByLabelText(/what's on your mind right now/i)
    await user.type(focusField, FOCUS)
    await selectWesternSun(user)
    await user.click(
      await screen.findByRole('button', { name: 'Open the cosmos' }),
    )
    await screen.findByRole('heading', { name: 'Cosmos' })
    await user.click(
      await screen.findByRole('button', { name: 'See the contrast' }),
    )
    await screen.findByRole('heading', { name: 'Contrast' })
    expect(
      screen.getByRole('heading', { name: 'Reading packet' }),
    ).toBeInTheDocument()
    expect(screen.getByText(CONTRAST_RESEARCH_IDLE_NOTICE)).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Confirm Gemini Search' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Search with Gemini' }),
    ).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  }, 20_000)
})
