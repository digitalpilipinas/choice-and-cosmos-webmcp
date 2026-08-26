import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import {
  evidenceForSection,
  sectionsCitingEvidence,
} from '../../src/domain/selectors.ts'
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
      { displayName: 'You', focusIntention: FOCUS, tone: 'grounded' },
      'daily',
    )

    render(<App />)
    await user.type(
      screen.getByLabelText(/what's on your mind/i),
      FOCUS,
    )
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))

    await screen.findByRole('heading', { name: 'Cosmos' })

    for (const section of forecast.sections) {
      const cited = evidenceForSection(forecast, section)
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
      forecast.sections.length,
    )
    expect(screen.getAllByText('Reflective interpretation').length).toBe(
      forecast.sections.length,
    )

    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await screen.findByRole('heading', { name: 'Contrast' })

    for (const item of forecast.evidence) {
      expect(screen.getByText(item.id)).toBeInTheDocument()
      const citing = sectionsCitingEvidence(forecast, item.id)
      const list = screen.getByRole('list', {
        name: `Sections citing ${item.id}`,
      })
      for (const section of citing) {
        expect(within(list).getByText(section.title)).toBeInTheDocument()
      }
    }
  })
})
