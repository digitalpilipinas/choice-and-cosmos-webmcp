import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.tsx'
import { selectWesternSun } from './leaveContext.ts'
import { FREE_WILL_NOTE, fixtureDerivedProfile } from '../../src/domain/loop.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'
import { getItem } from '../../src/persistence/db.ts'
import type { BootstrapResult } from '../../src/persistence/sessionStore.ts'
import { TOOL_NAMES } from '../../src/webmcp/catalog.ts'
import type { ModelContextTool } from '../../src/webmcp/detect.ts'

vi.mock('../../src/persistence/sessionStore.ts', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../src/persistence/sessionStore.ts')
  >()
  return {
    ...actual,
    bootstrapPersistence: vi.fn(actual.bootstrapPersistence),
  }
})

import {
  bootstrapPersistence,
  clearSavedData,
  grantConsentAndSave,
} from '../../src/persistence/sessionStore.ts'

const EMPTY_HORIZONS = { daily: null, weekly: null, yearly: null }

const FOCUS = 'typed before hydrate'
const STORED_FOCUS = 'stored from another tab'

describe('delayed persistence hydrate', () => {
  beforeEach(async () => {
    vi.mocked(bootstrapPersistence).mockReset()
    await clearSavedData()
    delete (document as { modelContext?: unknown }).modelContext
  })

  afterEach(() => {
    delete (document as { modelContext?: unknown }).modelContext
    cleanup()
  })

  it('does not replace in-progress focus with a late stored session', async () => {
    let resolveBootstrap: (result: BootstrapResult) => void = () => {}
    vi.mocked(bootstrapPersistence).mockReturnValue(
      new Promise((resolve) => {
        resolveBootstrap = resolve
      }),
    )

    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)

    resolveBootstrap({
      kind: 'hydrated',
      session: {
        schemaVersion: 3,
        savedAt: '2026-08-26T12:00:00.000Z',
        phase: 'cosmos',
        horizon: 'yearly',
        profile: {
          displayName: 'You',
          focusIntention: STORED_FOCUS,
          tone: 'bold',
          beliefs: {},
        },
        forecastsByHorizon: EMPTY_HORIZONS,
        readingsByHorizon: EMPTY_HORIZONS,
        resonanceByHorizon: EMPTY_HORIZONS,
        plansByHorizon: EMPTY_HORIZONS,
      },
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/what's on your mind/i)).toHaveValue(FOCUS)
    })
    expect(screen.queryByRole('heading', { name: 'Cosmos' })).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue(STORED_FOCUS)).not.toBeInTheDocument()
  })

  it('does not overwrite a stored forecast after edits during checking', async () => {
    const profile = {
      displayName: 'You',
      focusIntention: STORED_FOCUS,
      tone: 'bold' as const,
      beliefs: {},
    }
    const forecast = generateForecast(fixtureDerivedProfile(profile), 'yearly')
    const plan = {
      horizon: 'yearly' as const,
      createdAt: forecast.generatedAt,
      steps: forecast.suggestedSteps,
      freeWillNote: FREE_WILL_NOTE,
    }
    const stored = {
      phase: 'cosmos' as const,
      horizon: 'yearly' as const,
      profile,
      forecastsByHorizon: { daily: null, weekly: null, yearly: forecast },
      readingsByHorizon: EMPTY_HORIZONS,
      resonanceByHorizon: EMPTY_HORIZONS,
      plansByHorizon: { daily: null, weekly: null, yearly: plan },
    }
    const saved = await grantConsentAndSave(stored)
    if (!('savedAt' in saved)) {
      throw new Error('expected a granted stored session')
    }
    const before = await getItem('session')

    let resolveBootstrap: (result: BootstrapResult) => void = () => {}
    vi.mocked(bootstrapPersistence).mockReturnValue(
      new Promise((resolve) => {
        resolveBootstrap = resolve
      }),
    )

    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await user.click(screen.getByRole('radio', { name: /Compass/ }))

    resolveBootstrap({
      kind: 'hydrated',
      session: {
        schemaVersion: 3,
        savedAt: saved.savedAt,
        ...stored,
      },
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/what's on your mind/i)).toHaveValue(FOCUS)
    })
    expect(screen.getByRole('radio', { name: /Compass/ })).toBeChecked()
    expect(
      screen.queryByRole('heading', { name: 'Cosmos' }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText(/not using that copy/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Saved on this device/)).not.toBeInTheDocument()

    await new Promise((resolve) => {
      window.setTimeout(resolve, 500)
    })

    await expect(getItem('session')).resolves.toEqual(before)
  })

  it('does not offer or grant plan-save persistence while bootstrap is still checking', async () => {
    const profile = {
      displayName: 'You',
      focusIntention: STORED_FOCUS,
      tone: 'bold' as const,
      beliefs: {},
    }
    const forecast = generateForecast(fixtureDerivedProfile(profile), 'yearly')
    const plan = {
      horizon: 'yearly' as const,
      createdAt: forecast.generatedAt,
      steps: forecast.suggestedSteps,
      freeWillNote: FREE_WILL_NOTE,
    }
    const stored = {
      phase: 'cosmos' as const,
      horizon: 'yearly' as const,
      profile,
      forecastsByHorizon: { daily: null, weekly: null, yearly: forecast },
      readingsByHorizon: EMPTY_HORIZONS,
      resonanceByHorizon: EMPTY_HORIZONS,
      plansByHorizon: { daily: null, weekly: null, yearly: plan },
    }
    const saved = await grantConsentAndSave(stored)
    if (!('savedAt' in saved)) {
      throw new Error('expected a granted stored session')
    }
    const before = await getItem('session')

    let resolveBootstrap: (result: BootstrapResult) => void = () => {}
    vi.mocked(bootstrapPersistence).mockReturnValue(
      new Promise((resolve) => {
        resolveBootstrap = resolve
      }),
    )

    const registered = new Map<string, ModelContextTool>()
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: async (tool: ModelContextTool) => {
          registered.set(tool.name, tool)
        },
      },
    })

    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await waitFor(() => {
      expect(registered.size).toBe(TOOL_NAMES.length)
    })
    await selectWesternSun(user)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    expect(await screen.findByRole('heading', { name: 'Cosmos' })).toBeInTheDocument()

    const save = registered.get('request_plan_save')
    if (save === undefined) {
      throw new Error('expected request_plan_save')
    }
    await save.execute({})

    const dialog = await screen.findByRole('dialog', {
      name: 'Confirm this agent request',
    })
    expect(
      screen.queryByLabelText(/Also save this session in this browser/),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Approve this request' }),
    )
    expect(dialog).not.toHaveTextContent(/Also save this session/)

    resolveBootstrap({
      kind: 'hydrated',
      session: {
        schemaVersion: 3,
        savedAt: saved.savedAt,
        ...stored,
      },
    })

    expect(
      await screen.findByText(/not using that copy/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Saved on this device/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Saving to this device/)).not.toBeInTheDocument()

    await new Promise((resolve) => {
      window.setTimeout(resolve, 500)
    })

    await expect(getItem('session')).resolves.toEqual(before)
  })
})
