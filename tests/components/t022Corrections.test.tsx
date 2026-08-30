import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.tsx'
import { ResearchBriefPanel } from '../../src/components/research/ResearchBriefPanel.tsx'
import { buildExactBrief } from '../../src/research/brief.ts'
import { clearSavedData } from '../../src/persistence/sessionStore.ts'
import { selectWesternSun } from './leaveContext.ts'

const appCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../src/App.css'),
  'utf8',
)

const FOCUS = 'protect one block of attention'

describe('T022 evidence integrity and brief overflow', () => {
  beforeEach(async () => {
    await clearSavedData()
  })

  afterEach(() => {
    cleanup()
  })

  it('wraps the exact research-brief preview and keeps it keyboard-reachable', async () => {
    const user = userEvent.setup()
    const brief = buildExactBrief({
      horizon: 'daily',
      focus: FOCUS,
      tone: 'grounded',
      beliefs: { western: { sun: 'virgo' } },
    })
    expect(brief).not.toBeNull()
    if (brief === null) {
      throw new Error('expected a western-only brief')
    }

    render(<ResearchBriefPanel brief={brief} />)
    const preview = document.querySelector('pre.research-model-text')
    expect(preview).toBeInstanceOf(HTMLElement)
    if (!(preview instanceof HTMLElement)) {
      throw new Error('expected a research-brief preview')
    }
    expect(preview.tabIndex).toBe(0)
    expect(preview.textContent).toContain('\n')
    expect(preview.textContent).toContain('"skippedLenses"')
    await user.tab()
    expect(preview).toHaveFocus()

    expect(appCss).toMatch(/\.research-panel\s*\{[^}]*min-width:\s*0/)
    expect(appCss).toMatch(
      /\.research-model-text\s*\{[^}]*white-space:\s*pre-wrap/,
    )
    expect(appCss).toMatch(
      /\.research-model-text\s*\{[^}]*overflow-wrap:\s*anywhere/,
    )
    expect(appCss).toMatch(
      /\.app-shell \.studio-grid \.phase-stepper ol[\s\S]*grid-template-columns:\s*1fr/,
    )
  })

  it('lets a Virgo-only fixture resonate only on eligible lenses', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByLabelText(/what's on your mind/i), FOCUS)
    await selectWesternSun(user, 'Virgo')
    await user.click(screen.getByRole('button', { name: 'Open the cosmos' }))
    await screen.findByRole('heading', { name: 'Cosmos' })

    expect(screen.getByText('legacy')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Skipped lenses' })).toBeInTheDocument()
    expect(screen.getByText(/numerology:/i)).toBeInTheDocument()
    expect(screen.getByText(/humanDesign:/i)).toBeInTheDocument()
    expect(screen.queryByText('Numerology')).not.toBeInTheDocument()
    expect(screen.queryByText('Human design')).not.toBeInTheDocument()
    expect(screen.getByText('Western astrology')).toBeInTheDocument()

    const preview = document.querySelector('pre.research-model-text')
    expect(preview).toBeInstanceOf(HTMLElement)
    expect(preview?.textContent).toContain('\n')

    await user.click(screen.getByRole('button', { name: 'See the contrast' }))
    await screen.findByRole('heading', { name: 'Contrast' })
    await user.click(screen.getByRole('button', { name: 'Choose your steps' }))
    await screen.findByRole('heading', { name: 'Choice' })

    const groups = screen.getAllByRole('group', { name: /resonance$/ })
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Energy overview resonance',
      'Western astrology resonance',
      'Decision support resonance',
      'Focus action plan resonance',
    ])
    expect(
      screen.queryByRole('group', { name: 'Numerology resonance' }),
    ).not.toBeInTheDocument()
  })
})
