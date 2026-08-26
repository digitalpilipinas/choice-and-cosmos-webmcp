import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ContrastPhase } from '../../src/components/phases/ContrastPhase.tsx'
import { CosmosPhase } from '../../src/components/phases/CosmosPhase.tsx'
import { FREE_WILL_NOTE, INITIAL_STATE } from '../../src/domain/loop.ts'
import { frameworkKind } from '../../src/domain/synthesis.ts'
import type { AppState, ForecastFixture, HorizonId } from '../../src/domain/types.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'

const PROFILE = {
  displayName: 'You',
  focusIntention: 'finish the draft',
  tone: 'grounded' as const,
}

function noop(): void {}

function stateWithForecast(
  forecast: ForecastFixture | null,
  horizon: HorizonId = 'daily',
): AppState {
  return {
    ...INITIAL_STATE,
    phase: 'cosmos',
    horizon,
    profile: PROFILE,
    forecastsByHorizon: {
      daily: horizon === 'daily' ? forecast : null,
      weekly: horizon === 'weekly' ? forecast : null,
      yearly: horizon === 'yearly' ? forecast : null,
    },
  }
}

describe('T006 review corrections', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps EvidenceCard heading ids unique when Cosmos cites the same evidence twice', () => {
    const forecast = generateForecast(PROFILE, 'daily')
    const duplicated = forecast.evidence.some((item) => {
      const citing = forecast.sections.filter((section) =>
        section.evidenceIds.includes(item.id),
      )
      return citing.length > 1
    })
    expect(duplicated).toBe(true)

    render(
      <CosmosPhase state={stateWithForecast(forecast)} dispatch={noop} />,
    )
    const ids = [...document.querySelectorAll('h4[id^="evidence-"]')].map(
      (node) => node.id,
    )
    expect(ids.length).toBeGreaterThan(1)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('opens the first report section by default and keeps native disclosure after rerender', async () => {
    const user = userEvent.setup()
    const forecast = generateForecast(PROFILE, 'daily')
    const view = render(
      <CosmosPhase state={stateWithForecast(forecast)} dispatch={noop} />,
    )
    const sections = () =>
      [...document.querySelectorAll('.report-section')] as HTMLDetailsElement[]

    expect(sections()[0]?.open).toBe(true)
    expect(sections()[1]?.open).toBe(false)

    await user.click(sections()[1]?.querySelector('summary') as HTMLElement)
    expect(sections()[1]?.open).toBe(true)

    view.rerender(
      <CosmosPhase state={stateWithForecast(forecast)} dispatch={noop} />,
    )
    expect(sections()[1]?.open).toBe(true)

    await user.click(sections()[0]?.querySelector('summary') as HTMLElement)
    expect(sections()[0]?.open).toBe(false)
    view.rerender(
      <CosmosPhase state={stateWithForecast(forecast)} dispatch={noop} />,
    )
    expect(sections()[0]?.open).toBe(false)
  })

  it('shows the free-will banner when Cosmos or Contrast has no forecast', () => {
    render(
      <CosmosPhase state={stateWithForecast(null)} dispatch={noop} />,
    )
    expect(screen.getByText(FREE_WILL_NOTE)).toBeInTheDocument()

    cleanup()
    render(
      <ContrastPhase state={stateWithForecast(null)} dispatch={noop} />,
    )
    expect(screen.getByText(FREE_WILL_NOTE)).toBeInTheDocument()
  })

  it('does not call the reflective energy overview an interpretive lens', () => {
    expect(frameworkKind('energyOverview')).toBe('reflective')
    const forecast = generateForecast(PROFILE, 'daily')
    const energy = forecast.sections.find(
      (section) => section.id === 'energyOverview',
    )
    expect(energy).toBeDefined()
    expect(energy?.frameworkLabel).toMatch(/reflective framework/i)
    expect(energy?.frameworkLabel).not.toMatch(/interpretive/i)
  })
})
