import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import {
  evidenceForSection,
  sectionsCitingEvidence,
} from '../../src/domain/selectors.ts'
import { INITIAL_STATE } from '../../src/domain/loop.ts'
import { studioView } from '../../src/domain/studioView.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'

const FOCUS = 'finish the draft'

describe('evidence mapping', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows cited evidence IDs in Cosmos and citing section titles in Contrast', async () => {
    const user = userEvent.setup()
    const forecast = generateForecast(
      { displayName: 'You', focusIntention: FOCUS, tone: 'grounded', cosmic: {} },
      'daily',
    )

    render(<App />)
    await user.type(
      screen.getByLabelText(/what's on your mind/i),
      FOCUS,
    )
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))

    await screen.findByRole('heading', { name: 'Cosmos' })

    const view = studioView({
      ...INITIAL_STATE,
      phase: 'cosmos',
      horizon: 'daily',
      profile: {
        displayName: 'You',
        focusIntention: FOCUS,
        tone: 'grounded',
        beliefs: {},
      },
      forecastsByHorizon: {
        daily: forecast,
        weekly: null,
        yearly: null,
      },
    })
    if (view.reading.status !== 'ready') {
      throw new Error('expected ready reading')
    }
    const reading = view.reading

    for (const section of reading.sections) {
      const fixtureSection = forecast.sections.find((item) => item.id === section.id)
      if (fixtureSection === undefined) {
        throw new Error(`missing fixture section ${section.id}`)
      }
      const cited = evidenceForSection(forecast, fixtureSection)
      if (cited.length === 0) {
        continue
      }
      const block = screen.getByText(section.title).closest('details')
      expect(block).not.toBeNull()
      for (const item of cited) {
        expect(within(block as HTMLElement).getByText(item.id)).toBeInTheDocument()
        expect(within(block as HTMLElement).getByText(item.label)).toBeInTheDocument()
      }
    }
    expect(screen.queryByText('No evidence IDs cited')).toBeNull()
    expect(screen.getAllByText('Grounded source notes').length).toBe(
      reading.sections.length,
    )
    expect(screen.getAllByText('Reflective interpretation').length).toBe(
      reading.sections.length,
    )

    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await screen.findByRole('heading', { name: 'Contrast' })

    for (const item of forecast.evidence) {
      expect(screen.getByText(item.id)).toBeInTheDocument()
      const citing = sectionsCitingEvidence(forecast, item.id).filter((section) =>
        reading.sections.some((visible) => visible.id === section.id),
      )
      if (citing.length === 0) {
        continue
      }
      const list = screen.getByRole('list', {
        name: `Sections citing ${item.id}`,
      })
      for (const section of citing) {
        expect(within(list).getByText(section.title)).toBeInTheDocument()
      }
    }
  })
})
