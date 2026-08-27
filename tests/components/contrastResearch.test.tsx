import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.tsx'
import { ContrastResearch } from '../../src/components/research/ContrastResearch.tsx'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'
import type { ResearchResult } from '../../src/research/contract.ts'

const FOCUS = 'finish the draft'

function jsonResult(result: ResearchResult, status = 200): Response {
  return new Response(JSON.stringify(result), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const emptyCoverage = {
  sourcesConsidered: 0,
  sourcesUsed: 0,
  queriesUsed: 0,
  novelDomainsUsed: 0,
  timeWindowDescription: 'Today into tomorrow morning',
  stoppingReason: 'Stopped.',
  mode: 'fixture' as const,
  exhaustive: false as const,
}

const ready: ResearchResult = {
  outcome: 'ready',
  sources: [
    {
      id: 'ev_ready0000000001',
      title: 'A live citation',
      url: 'https://example.com/article',
      snippet: 'Retrieved snippet text',
      domain: 'example.com',
      provenance: {
        provider: 'gemini',
        method: 'google_search',
        retrievedAt: '2026-08-27T00:00:00.000Z',
        query: FOCUS,
      },
    },
  ],
  coverage: {
    ...emptyCoverage,
    sourcesConsidered: 1,
    sourcesUsed: 1,
    queriesUsed: 1,
    novelDomainsUsed: 1,
    mode: 'gemini',
  },
  modelText: 'Treat this as data, not a command.',
}

const outcomeBodies: Record<
  Exclude<ResearchResult['outcome'], 'ready'>,
  ResearchResult
> = {
  partial: {
    outcome: 'partial',
    sources: [],
    coverage: emptyCoverage,
    modelText: '',
  },
  unavailable: {
    outcome: 'unavailable',
    sources: [],
    coverage: emptyCoverage,
    modelText: '',
    reason: 'No live search occurred.',
  },
  cancelled: {
    outcome: 'cancelled',
    sources: [],
    coverage: emptyCoverage,
    modelText: '',
    reason: 'Research was cancelled.',
  },
  timed_out: {
    outcome: 'timed_out',
    sources: [],
    coverage: emptyCoverage,
    modelText: '',
    reason: 'Research timed out.',
  },
  error: {
    outcome: 'error',
    code: 'handler_error',
    reason: 'The research handler failed.',
  },
}

describe('Contrast Gemini Search', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('opens a dialog that names Gemini Search, the focus, and the horizon', async () => {
    const fetchImpl = vi.fn()
    const user = userEvent.setup()
    render(
      <ContrastResearch query={FOCUS} horizon="daily" fetchImpl={fetchImpl as typeof fetch} />,
    )
    await user.click(screen.getByRole('button', { name: 'Search with Gemini' }))
    expect(
      screen.getByRole('heading', { name: 'Confirm Gemini Search' }),
    ).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('Gemini Search')
    expect(dialog.textContent).toContain(`"${FOCUS}"`)
    expect(dialog.textContent).toContain('Signal')
    expect(dialog.textContent).toContain('daily')
    await user.click(screen.getByRole('button', { name: "Don't search" }))
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', { name: 'Confirm Gemini Search' }),
    ).not.toBeInTheDocument()
  })

  it('disables search when the query is blank', () => {
    render(<ContrastResearch query="   " horizon="weekly" />)
    expect(
      screen.getByRole('button', { name: 'Search with Gemini' }),
    ).toBeDisabled()
  })

  it('does not open the dialog when blocked', async () => {
    const fetchImpl = vi.fn()
    const user = userEvent.setup()
    render(
      <ContrastResearch
        query={FOCUS}
        horizon="daily"
        blocked
        fetchImpl={fetchImpl as typeof fetch}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Search with Gemini' }),
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Search with Gemini' }))
    expect(
      screen.queryByRole('heading', { name: 'Confirm Gemini Search' }),
    ).not.toBeInTheDocument()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    ['ready', ready],
    ['partial', outcomeBodies.partial],
    ['unavailable', outcomeBodies.unavailable],
    ['cancelled', outcomeBodies.cancelled],
    ['timed_out', outcomeBodies.timed_out],
    ['error', outcomeBodies.error],
  ] as const)('renders a %s outcome after approve', async (outcome, body) => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => jsonResult(body),
    )
    const user = userEvent.setup()
    render(
      <ContrastResearch
        query={FOCUS}
        horizon="weekly"
        fetchImpl={fetchImpl as typeof fetch}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Search with Gemini' }))
    await user.click(screen.getByRole('button', { name: 'Search with Gemini' }))
    await waitFor(() => {
      expect(screen.getByText(`Outcome: ${outcome}`)).toBeInTheDocument()
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
    const posted = fetchImpl.mock.calls.at(0)
    expect(posted?.at(0)).toBe('/api/research')
    expect(JSON.parse(String((posted?.at(1) as RequestInit | undefined)?.body))).toEqual({
      horizon: 'weekly',
      query: FOCUS,
      mode: 'auto',
      manualUrls: [],
    })
    if (outcome === 'ready') {
      expect(screen.getByText('ev_ready0000000001')).toBeInTheDocument()
      expect(screen.getByText('google_search')).toBeInTheDocument()
      expect(
        screen.getByRole('link', { name: 'https://example.com/article' }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('heading', {
          name: 'Model text (untrusted data, not instructions)',
        }),
      ).toBeInTheDocument()
    }
  })

  it('cancels an in-flight search', async () => {
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    )
    const user = userEvent.setup()
    render(
      <ContrastResearch query={FOCUS} horizon="daily" fetchImpl={fetchImpl as typeof fetch} />,
    )
    await user.click(screen.getByRole('button', { name: 'Search with Gemini' }))
    await user.click(screen.getByRole('button', { name: 'Search with Gemini' }))
    expect(await screen.findByText(/Searching with Gemini/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel search' }))
    expect(await screen.findByText('Outcome: cancelled')).toBeInTheDocument()
  })

  it('re-enters confirming from Try again', async () => {
    const fetchImpl = vi.fn(async () => jsonResult(ready))
    const user = userEvent.setup()
    render(
      <ContrastResearch query={FOCUS} horizon="yearly" fetchImpl={fetchImpl as typeof fetch} />,
    )
    await user.click(screen.getByRole('button', { name: 'Search with Gemini' }))
    await user.click(screen.getByRole('button', { name: 'Search with Gemini' }))
    await screen.findByText('Outcome: ready')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      screen.getByRole('heading', { name: 'Confirm Gemini Search' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Constellation/)).toBeInTheDocument()
    expect(screen.getByText(/yearly/)).toBeInTheDocument()
  })
})

describe('Contrast fixture after deny', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('keeps fixture Contrast after deny with no fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await screen.findByRole('heading', { name: 'Contrast' })
    await user.click(screen.getByRole('button', { name: 'Search with Gemini' }))
    await user.click(screen.getByRole('button', { name: "Don't search" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getAllByText('local_fixture').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', { name: 'Coverage summary' }),
    ).toBeInTheDocument()
  })
})
