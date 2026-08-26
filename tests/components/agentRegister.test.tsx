import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import { TOOL_NAMES } from '../../src/webmcp/catalog.ts'
import type { ModelContextTool } from '../../src/webmcp/detect.ts'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'

describe('agent catalog registration', () => {
  beforeEach(async () => {
    await clearSavedData()
    delete (document as { modelContext?: unknown }).modelContext
  })

  afterEach(() => {
    delete (document as { modelContext?: unknown }).modelContext
    cleanup()
  })

  it('waits until all eight tools register before advertising ready', async () => {
    const registered = new Map<string, ModelContextTool>()
    let releaseLast: () => void = () => {}
    const lastGate = new Promise<void>((resolve) => {
      releaseLast = resolve
    })

    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: async (tool: ModelContextTool) => {
          registered.set(tool.name, tool)
          if (registered.size === TOOL_NAMES.length) {
            await lastGate
          }
        },
      },
    })

    render(<App />)
    expect(
      screen.getByText(/Checking whether this browser can offer agent tools/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Agent tools are available in this browser/),
    ).not.toBeInTheDocument()

    await waitFor(() => {
      expect(registered.size).toBe(TOOL_NAMES.length)
    })
    expect(
      screen.queryByText(/Agent tools are available in this browser/),
    ).not.toBeInTheDocument()

    releaseLast()
    expect(
      await screen.findByText(/Agent tools are available in this browser/),
    ).toBeInTheDocument()
  })

  it('falls back to the manual loop when registration fails', async () => {
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: async () => {
          throw new Error('register failed')
        },
      },
    })

    render(<App />)
    expect(
      await screen.findByText(/could not finish registering agent tools/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/what's on your mind/i)).toBeInTheDocument()
  })

  it('aborts already-registered tools when the eighth registration fails', async () => {
    const registered = new Map<string, ModelContextTool>()

    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: async (
          tool: ModelContextTool,
          options?: { signal?: AbortSignal },
        ) => {
          if (registered.size === TOOL_NAMES.length - 1) {
            throw new Error('eighth failed')
          }
          registered.set(tool.name, tool)
          options?.signal?.addEventListener('abort', () => {
            registered.delete(tool.name)
          })
        },
      },
    })

    render(<App />)
    expect(
      await screen.findByText(/could not finish registering agent tools/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Agent tools are available in this browser/),
    ).not.toBeInTheDocument()
    await waitFor(() => {
      expect(registered.size).toBe(0)
    })
    expect(screen.getByLabelText(/what's on your mind/i)).toBeInTheDocument()
  })
})
