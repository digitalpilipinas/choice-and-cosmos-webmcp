import { StrictMode } from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.tsx'
import { getItem } from '../../src/persistence/db.ts'

type SessionStore = typeof import('../../src/persistence/sessionStore.ts')

const grantMock = vi.hoisted(() => {
  const state: {
    actual: SessionStore['grantConsentAndSave'] | null
    fn: ReturnType<typeof vi.fn<SessionStore['grantConsentAndSave']>>
  } = {
    actual: null,
    fn: vi.fn(),
  }
  return state
})

vi.mock('../../src/persistence/sessionStore.ts', async (importOriginal) => {
  const actual = await importOriginal<SessionStore>()
  grantMock.actual = actual.grantConsentAndSave
  grantMock.fn.mockImplementation(actual.grantConsentAndSave)
  return {
    ...actual,
    grantConsentAndSave: grantMock.fn,
  }
})

import {
  bootstrapPersistence,
  clearSavedData,
  grantConsentAndSave,
} from '../../src/persistence/sessionStore.ts'

const FOCUS = 'keep the draft honest overnight'

describe('persistence flow', () => {
  beforeEach(async () => {
    grantMock.fn.mockReset()
    if (grantMock.actual === null) {
      throw new Error('expected grantConsentAndSave implementation')
    }
    grantMock.fn.mockImplementation(grantMock.actual)
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it('grants consent, saves, and hydrates after a fresh mount', async () => {
    const user = userEvent.setup()
    const first = render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    await screen.findByRole('button', { name: 'Save on this device' })
    await user.type(
      screen.getByLabelText(/what's on your mind/i),
      FOCUS,
    )
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await screen.findByRole('heading', { name: 'Cosmos' })
    await user.click(screen.getByRole('button', { name: 'Save on this device' }))
    await screen.findByText(/Saved on this device/)

    first.unmount()

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    await screen.findByText(/Saved on this device/)
    expect(screen.getByRole('heading', { name: 'Cosmos' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Cosmos' }).parentElement,
    ).toHaveTextContent(FOCUS)
  })

  it('declines consent and keeps the preview working without saving', async () => {
    const user = userEvent.setup()
    const first = render(<App />)

    await screen.findByRole('button', { name: "Don't save" })
    await user.click(screen.getByRole('button', { name: "Don't save" }))

    const bar = screen.getByRole('region', { name: 'Local saving' })
    expect(
      await within(bar).findByText(/Nothing is being saved on this device/),
    ).toBeInTheDocument()
    expect(within(bar).queryByText(/^Saved on this device/)).not.toBeInTheDocument()

    await user.type(
      screen.getByLabelText(/what's on your mind/i),
      FOCUS,
    )
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    expect(screen.getByRole('heading', { name: 'Cosmos' })).toBeInTheDocument()

    first.unmount()
    render(<App />)

    await screen.findByRole('button', { name: 'Save on this device' })
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Cosmos' })).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText(/what's on your mind/i)).toHaveValue('')
  })

  it('keeps the stored session after Start a new reflection', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('button', { name: 'Save on this device' })
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await screen.findByRole('heading', { name: 'Cosmos' })
    await user.click(screen.getByRole('button', { name: 'Save on this device' }))
    await screen.findByText(/Saved on this device/)
    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await user.click(screen.getByRole('button', { name: 'Choose your steps' }))
    await user.click(screen.getByRole('button', { name: 'Review this session' }))
    await screen.findByRole('heading', { name: 'Continuity' })
    expect(
      screen.getByText(/clears this tab and leaves the stored copy in place/),
    ).toBeInTheDocument()

    await new Promise((resolve) => {
      window.setTimeout(resolve, 500)
    })
    const before = await getItem('session')
    expect(before).toMatchObject({
      profile: { focusIntention: FOCUS },
    })
    expect(before).toEqual(
      expect.objectContaining({
        forecastsByHorizon: expect.objectContaining({
          daily: expect.objectContaining({ horizon: 'daily' }),
        }),
      }),
    )

    await user.click(
      screen.getByRole('button', { name: 'Start a new reflection' }),
    )
    await screen.findByRole('heading', { name: 'Context' })
    expect(
      await screen.findByText(/not using that copy/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Saved on this device/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/what's on your mind/i)).toHaveValue('')

    await new Promise((resolve) => {
      window.setTimeout(resolve, 500)
    })

    await expect(getItem('session')).resolves.toEqual(before)
    await expect(bootstrapPersistence()).resolves.toEqual({
      kind: 'hydrated',
      session: before,
    })
  })

  it('keeps held and the stored session when grant finishes after restart', async () => {
    let releaseGrant: () => void = () => {}
    vi.mocked(grantConsentAndSave).mockImplementationOnce((state) => {
      return new Promise((resolve, reject) => {
        releaseGrant = () => {
          if (grantMock.actual === null) {
            reject(new Error('expected grantConsentAndSave implementation'))
            return
          }
          grantMock.actual(state).then(resolve, reject)
        }
      })
    })

    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('button', { name: 'Save on this device' })
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await screen.findByRole('heading', { name: 'Cosmos' })
    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await user.click(screen.getByRole('button', { name: 'Choose your steps' }))
    await user.click(screen.getByRole('button', { name: 'Review this session' }))
    await screen.findByRole('heading', { name: 'Continuity' })

    await user.click(screen.getByRole('button', { name: 'Save on this device' }))
    expect(await screen.findByText(/Saving to this device/)).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Start a new reflection' }),
    )
    await screen.findByRole('heading', { name: 'Context' })
    expect(
      await screen.findByText(/not using that copy/),
    ).toBeInTheDocument()

    releaseGrant()

    await new Promise((resolve) => {
      window.setTimeout(resolve, 500)
    })

    expect(
      await screen.findByText(/not using that copy/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Saved on this device/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/what's on your mind/i)).toHaveValue('')

    const stored = await getItem('session')
    expect(stored).toMatchObject({
      profile: { focusIntention: FOCUS },
      phase: 'continuity',
    })
    await expect(bootstrapPersistence()).resolves.toEqual({
      kind: 'hydrated',
      session: stored,
    })
  })
})
