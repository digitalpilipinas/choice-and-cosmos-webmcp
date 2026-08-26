import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.tsx'

vi.mock('../../src/persistence/sessionStore.ts', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../src/persistence/sessionStore.ts')
  >()
  return {
    ...actual,
    declineConsent: vi.fn(actual.declineConsent),
    clearSavedData: vi.fn(actual.clearSavedData),
    saveSession: vi.fn(actual.saveSession),
  }
})

import {
  clearSavedData,
  declineConsent,
  saveSession,
} from '../../src/persistence/sessionStore.ts'

const FOCUS = 'keep the draft honest overnight'

describe('persistence decline and erase failures', () => {
  beforeEach(async () => {
    vi.mocked(declineConsent).mockClear()
    vi.mocked(clearSavedData).mockClear()
    vi.mocked(saveSession).mockClear()
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not claim decline succeeded when storage write fails', async () => {
    vi.mocked(declineConsent).mockResolvedValueOnce({ error: 'disk full' })
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('button', { name: "Don't save" })
    await user.click(screen.getByRole('button', { name: "Don't save" }))

    expect(await screen.findByText('disk full')).toBeInTheDocument()
    expect(
      screen.queryByText(/Nothing is being saved on this device/),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: "Don't save" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Try saving again' }),
    ).not.toBeInTheDocument()

    await new Promise((resolve) => {
      window.setTimeout(resolve, 500)
    })
    expect(saveSession).not.toHaveBeenCalled()
  })

  it('does not claim erase succeeded when storage delete fails', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('button', { name: 'Save on this device' })
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await user.click(screen.getByRole('button', { name: 'Save on this device' }))
    await screen.findByText(/Saved on this device/)

    vi.mocked(clearSavedData).mockResolvedValueOnce({
      error: 'Could not erase the local copy.',
    })
    await user.click(
      screen.getByRole('button', {
        name: "Stop saving & erase this device's copy",
      }),
    )

    expect(
      await screen.findByText('Could not erase the local copy.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Nothing is being saved on this device/),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: "Stop saving & erase this device's copy",
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Try saving again' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await user.click(screen.getByRole('button', { name: 'Choose your steps' }))
    await screen.findByRole('heading', { name: 'Choice' })
    expect(
      screen.getAllByPlaceholderText(/stays in this tab unless you choose to save/)
        .length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByPlaceholderText(/stored with this session on this device/),
    ).not.toBeInTheDocument()
  })
})
