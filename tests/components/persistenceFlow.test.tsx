import { StrictMode } from 'react'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.tsx'
import { getItem } from '../../src/persistence/db.ts'

type SessionStore = typeof import('../../src/persistence/sessionStore.ts')
type DbModule = typeof import('../../src/persistence/db.ts')

const dbMock = vi.hoisted(() => {
  const state: {
    actualSetItem: DbModule['setItem'] | null
    setItem: ReturnType<typeof vi.fn<DbModule['setItem']>>
  } = {
    actualSetItem: null,
    setItem: vi.fn(),
  }
  return state
})

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

vi.mock('../../src/persistence/db.ts', async (importOriginal) => {
  const actual = await importOriginal<DbModule>()
  dbMock.actualSetItem = actual.setItem
  dbMock.setItem.mockImplementation(actual.setItem)
  return {
    ...actual,
    setItem: dbMock.setItem,
  }
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
  declineConsent,
  grantConsentAndSave,
  saveSession,
} from '../../src/persistence/sessionStore.ts'

const FOCUS = 'keep the draft honest overnight'

import type { SessionFields } from '../../src/persistence/sessionStore.ts'

const sampleFields: SessionFields = {
  phase: 'contrast',
  horizon: 'yearly',
  profile: {
    displayName: 'You',
    focusIntention: FOCUS,
    tone: 'bold',
    beliefs: {},
  },
  forecastsByHorizon: { daily: null, weekly: null, yearly: null },
  readingsByHorizon: { daily: null, weekly: null, yearly: null },
  resonanceByHorizon: { daily: null, weekly: null, yearly: null },
  plansByHorizon: { daily: null, weekly: null, yearly: null },
}

async function startHeldSessionSave(state: SessionFields) {
  if (dbMock.actualSetItem === null) {
    throw new Error('expected setItem implementation')
  }
  const actualSetItem = dbMock.actualSetItem
  let release = () => {}
  const hold = new Promise<void>((resolve) => {
    release = resolve
  })
  let entered = false
  dbMock.setItem.mockImplementation(async (key, value) => {
    if (key === 'session') {
      entered = true
      await hold
    }
    return actualSetItem(key, value)
  })
  const saving = saveSession(state)
  await waitFor(() => {
    expect(entered).toBe(true)
  })
  return { saving, release }
}

describe('persistence flow', { timeout: 25_000 }, () => {
  beforeEach(async () => {
    grantMock.fn.mockReset()
    if (grantMock.actual === null) {
      throw new Error('expected grantConsentAndSave implementation')
    }
    grantMock.fn.mockImplementation(grantMock.actual)
    if (dbMock.actualSetItem === null) {
      throw new Error('expected setItem implementation')
    }
    dbMock.setItem.mockReset()
    dbMock.setItem.mockImplementation(dbMock.actualSetItem)
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it('grants consent, saves, and hydrates after a fresh mount', { timeout: 25_000 }, async () => {
    const user = userEvent.setup()
    const first = render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    await screen.findByRole('button', { name: 'Save on this device' }, { timeout: 4000 })
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

  it('declines consent and keeps the preview working without saving', { timeout: 25_000 }, async () => {
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

    await screen.findByRole('button', { name: 'Save on this device' }, { timeout: 4000 })
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Cosmos' })).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText(/what's on your mind/i)).toHaveValue('')
  })

  it('keeps the stored session after Start a new reflection', { timeout: 25_000 }, async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('button', { name: 'Save on this device' }, { timeout: 4000 })
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

  it('keeps held and the stored session when grant finishes after restart', { timeout: 25_000 }, async () => {
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

    await screen.findByRole('button', { name: 'Save on this device' }, { timeout: 4000 })
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

  it('does not let a held session write restore data after clear', async () => {
    await grantConsentAndSave(sampleFields)
    const { saving, release } = await startHeldSessionSave({
      ...sampleFields,
      phase: 'choice',
    })
    const clearing = clearSavedData()
    release()
    await Promise.all([saving, clearing])

    await expect(getItem('session')).resolves.toBeUndefined()
    await expect(getItem('consent')).resolves.toBeUndefined()
    await expect(bootstrapPersistence()).resolves.toEqual({ kind: 'undecided' })
  })

  it('does not hydrate a held session write after decline', async () => {
    await grantConsentAndSave(sampleFields)
    const { saving, release } = await startHeldSessionSave({
      ...sampleFields,
      phase: 'choice',
    })
    const declining = declineConsent()
    release()
    await Promise.all([saving, declining])

    await expect(getItem('consent')).resolves.toBe('declined')
    await expect(bootstrapPersistence()).resolves.toEqual({ kind: 'declined' })
  })
})
