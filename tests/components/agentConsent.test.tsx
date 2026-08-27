import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import { confirmationIdFor } from '../../src/domain/loop.ts'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'
import type { ModelContextTool } from '../../src/webmcp/detect.ts'
import { TOOL_NAMES } from '../../src/webmcp/catalog.ts'
import { runTool } from '../../src/webmcp/tools.ts'
import { appReducer, INITIAL_STATE } from '../../src/domain/loop.ts'

const FOCUS = 'keep the draft honest overnight'

describe('agent fallback and confirmation UI', () => {
  beforeEach(async () => {
    await clearSavedData()
    delete (document as { modelContext?: unknown }).modelContext
  })

  afterEach(() => {
    delete (document as { modelContext?: unknown }).modelContext
    cleanup()
  })

  it('keeps the manual loop when modelContext is missing', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(
      await screen.findByText(/does not expose document.modelContext.registerTool/i),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    expect(screen.getByRole('heading', { name: 'Cosmos' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Approve this request' }),
    ).not.toBeInTheDocument()
  })

  it('opens the personal-data confirmation gate, verifies the human-facing diff, and then denies the request', async () => {
    const registered = new Map<string, ModelContextTool>()
    const modelContext = {
      registerTool: async (tool: ModelContextTool) => {
        registered.set(tool.name, tool)
      },
    }
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: modelContext,
    })

    const user = userEvent.setup()
    render(<App />)

    await screen.findByText(/Agent tools are available in this browser/)
    await waitFor(() => {
      expect([...registered.keys()]).toEqual([...TOOL_NAMES])
    })

    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)

    const access = registered.get('request_profile_access')
    if (access === undefined) {
      throw new Error('expected request_profile_access')
    }

    const deniedFirst = await access.execute({})
    expect(deniedFirst).toMatchObject({
      ok: false,
      code: 'needs_confirmation',
      confirmationId: confirmationIdFor('personal_data_access'),
    })
    expect(JSON.stringify(deniedFirst)).not.toContain(FOCUS)

    await screen.findByRole('button', { name: 'Approve this request' })
    const agentBar = screen.getByRole('region', { name: 'Agent tools' })
    expect(
      within(agentBar).getByText(/read your display name, focus intention, and tone/i),
    ).toBeInTheDocument()
    expect(within(agentBar).getByText(FOCUS)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Deny' }))
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Approve this request' }),
      ).not.toBeInTheDocument()
    })
  })

  it('shows the profile diff only in the human gate, not in the agent result', async () => {
    const registered = new Map<string, ModelContextTool>()
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: async (tool: ModelContextTool) => {
          registered.set(tool.name, tool)
        },
      },
    })

    render(<App />)
    await screen.findByText(/Agent tools are available in this browser/)
    await waitFor(() => {
      expect(registered.has('propose_profile_update')).toBe(true)
    })

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)

    const propose = registered.get('propose_profile_update')
    if (propose === undefined) {
      throw new Error('expected propose_profile_update')
    }

    const first = await propose.execute({
      tone: 'bold',
      focusIntention: 'a slower question',
    })
    const dumped = JSON.stringify(first)
    expect(dumped).not.toContain(FOCUS)
    expect(dumped).not.toContain('grounded')

    await screen.findByRole('button', { name: 'Approve this request' })
    const agentBar = screen.getByRole('region', { name: 'Agent tools' })
    expect(within(agentBar).getByText(`${FOCUS} to a slower question`)).toBeInTheDocument()
    expect(within(agentBar).getByText('grounded to bold')).toBeInTheDocument()
  })

  it('moves focus into an accessible confirmation dialog and denies on Escape', async () => {
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
    await screen.findByText(/Agent tools are available in this browser/)
    await waitFor(() => {
      expect(registered.has('request_profile_access')).toBe(true)
    })
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)

    const access = registered.get('request_profile_access')
    if (access === undefined) {
      throw new Error('expected request_profile_access')
    }
    await access.execute({})

    const dialog = await screen.findByRole('dialog', {
      name: 'Confirm this agent request',
    })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription(
      /read your display name, focus intention, and tone/i,
    )
    expect(screen.getByRole('button', { name: 'Approve this request' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Deny' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Approve this request' })).toHaveFocus()

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText(/what's on your mind/i)).toHaveFocus()
  })

  it('keeps Deny focused when persistence status updates behind the dialog', async () => {
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
    await screen.findByText(/Agent tools are available in this browser/)
    await waitFor(() => {
      expect(registered.has('request_profile_access')).toBe(true)
    })
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await user.click(screen.getByRole('button', { name: 'Save on this device' }))
    await screen.findByText(/Saved on this device/)

    const access = registered.get('request_profile_access')
    if (access === undefined) {
      throw new Error('expected request_profile_access')
    }
    await access.execute({})

    const dialog = await screen.findByRole('dialog', {
      name: 'Confirm this agent request',
    })
    expect(screen.getByRole('button', { name: 'Approve this request' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Deny' })).toHaveFocus()

    await new Promise((resolve) => {
      window.setTimeout(resolve, 500)
    })

    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deny' })).toHaveFocus()
  })

  it('blocks pointer activation outside a native modal confirmation', async () => {
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
    await screen.findByText(/Agent tools are available in this browser/)
    await waitFor(() => {
      expect(registered.has('request_profile_access')).toBe(true)
    })
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)

    const access = registered.get('request_profile_access')
    if (access === undefined) {
      throw new Error('expected request_profile_access')
    }
    await access.execute({})

    const dialog = await screen.findByRole('dialog', {
      name: 'Confirm this agent request',
    })
    expect(dialog.tagName).toBe('DIALOG')
    expect(dialog).toHaveProperty('open', true)
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    const save = screen.getByRole('button', {
      name: 'Save on this device',
      hidden: true,
    })
    expect(save.closest('[inert]')).not.toBeNull()
    await user.click(save)

    expect(screen.queryByText(/Saved on this device/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Saving to this device/)).not.toBeInTheDocument()
    expect(dialog).toBeInTheDocument()

    const focusField = screen.getByRole('textbox', {
      name: /what's on your mind/i,
      hidden: true,
    })
    expect(focusField.closest('[inert]')).not.toBeNull()
    expect(focusField).toHaveValue(FOCUS)
    expect(screen.getByRole('button', { name: 'Approve this request' })).toHaveFocus()
  })

  it('wraps Shift+Tab through the plan-save persist checkbox', async () => {
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
    await screen.findByText(/Agent tools are available in this browser/)
    await waitFor(() => {
      expect(registered.has('generate_forecast')).toBe(true)
    })
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)

    const generate = registered.get('generate_forecast')
    const save = registered.get('request_plan_save')
    if (generate === undefined || save === undefined) {
      throw new Error('expected generate_forecast and request_plan_save')
    }

    await generate.execute({})
    await save.execute({})

    const dialog = await screen.findByRole('dialog', {
      name: 'Confirm this agent request',
    })
    expect(
      within(dialog).getByLabelText(/Also save this session in this browser/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve this request' })).toHaveFocus()

    await user.tab({ shift: true })
    expect(
      within(dialog).getByLabelText(/Also save this session in this browser/),
    ).toHaveFocus()

    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Deny' })).toHaveFocus()
  })

  it('lists current plan steps in the plan-save confirmation', async () => {
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
    await screen.findByText(/Agent tools are available in this browser/)
    await waitFor(() => {
      expect(registered.has('generate_forecast')).toBe(true)
    })
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)

    const generate = registered.get('generate_forecast')
    const save = registered.get('request_plan_save')
    if (generate === undefined || save === undefined) {
      throw new Error('expected generate_forecast and request_plan_save')
    }

    await generate.execute({})
    await save.execute({})

    const dialog = await screen.findByRole('dialog', {
      name: 'Confirm this agent request',
    })
    const steps = within(dialog).getByRole('list', {
      name: 'Plan steps to approve',
    })
    expect(within(steps).getByText(/Name the next honest hour \(proposed\)/)).toBeInTheDocument()
    expect(within(steps).getByText(/Make one reversible move \(proposed\)/)).toBeInTheDocument()
    expect(within(steps).getByText(/Close the window on purpose \(proposed\)/)).toBeInTheDocument()
  })
})

describe('manual fallback still saves without agent tools', () => {
  beforeEach(async () => {
    await clearSavedData()
    delete (document as { modelContext?: unknown }).modelContext
  })

  afterEach(() => {
    cleanup()
  })

  it('still reaches Choice by hand', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await user.click(screen.getByRole('button', { name: 'Choose your steps' }))
    expect(screen.getByRole('heading', { name: 'Choice' })).toBeInTheDocument()
  })
})

describe('approve path for profile access through the reducer', () => {
  it('returns the profile only after APPROVE_CONFIRMATION', () => {
    let state = appReducer(INITIAL_STATE, {
      type: 'SET_PROFILE_FIELD',
      field: 'focusIntention',
      value: FOCUS,
    })
    const first = runTool(state, 'request_profile_access', {})
    state = first.actions.reduce(appReducer, state)
    state = appReducer(state, {
      type: 'APPROVE_CONFIRMATION',
      id: confirmationIdFor('personal_data_access'),
    })
    const second = runTool(state, 'request_profile_access', {
      confirmationId: confirmationIdFor('personal_data_access'),
    })
    expect(second.result).toEqual({
      ok: true,
      data: {
        displayName: 'You',
        focusIntention: FOCUS,
        tone: 'grounded',
      },
    })
  })
})
