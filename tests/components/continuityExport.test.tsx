import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ContinuityPhase } from '../../src/components/phases/ContinuityPhase.tsx'
import { mustInstant } from '../../src/domain/brand.ts'
import { FREE_WILL_NOTE, INITIAL_STATE } from '../../src/domain/loop.ts'
import { studioView } from '../../src/domain/studioView.ts'
import { packetDigest, skippedLensesFor } from '../../src/domain/trust.ts'
import type { AppState } from '../../src/domain/types.ts'
import { generateForecast } from '../../src/fixtures/generateForecast.ts'
import { parseReadingPacketV1, type ReadingPacketV1 } from '../../src/research/packet.ts'
import { SAMPLE_PACKET } from '../research/samplePacket.ts'

const PROFILE = {
  displayName: 'You',
  focusIntention: 'protect one block of attention',
  tone: 'grounded' as const,
  beliefs: {},
}

function parsedSample(): ReadingPacketV1 {
  const packet = parseReadingPacketV1(SAMPLE_PACKET)
  if (packet === null) {
    throw new Error('expected sample packet')
  }
  return packet
}

function fixtureState(): AppState {
  const forecast = generateForecast(
    {
      displayName: 'You',
      focusIntention: PROFILE.focusIntention,
      tone: 'grounded',
      cosmic: {},
    },
    'daily',
  )
  return {
    ...INITIAL_STATE,
    phase: 'continuity',
    profile: PROFILE,
    forecastsByHorizon: {
      daily: forecast,
      weekly: null,
      yearly: null,
    },
  }
}

function adoptedState(input?: { accept?: boolean }): AppState {
  const packet = parsedSample()
  const adoptedAt = mustInstant(Date.parse('2026-08-29T12:00:00.000Z'))
  return {
    ...INITIAL_STATE,
    phase: 'continuity',
    profile: PROFILE,
    readingsByHorizon: {
      daily: {
        horizon: packet.horizon,
        adoptedAt,
        packetDigest: packetDigest(packet),
        sources: packet.sources,
        sections: packet.sections,
        coverage: {
          sourcesConsidered: packet.sources.length,
          sourcesUsed: packet.sources.length,
          timeWindowDescription: 'Adopted from a reviewed reading packet.',
          stoppingReason:
            'The person adopted this packet. It is not an exhaustive search.',
          mode: 'adopted',
          exhaustive: false,
        },
        skippedLenses: skippedLensesFor(packet, PROFILE.beliefs),
      },
      weekly: null,
      yearly: null,
    },
    plansByHorizon: {
      daily: {
        horizon: 'daily',
        createdAt: '2026-08-29T12:00:00.000Z',
        steps: [
          {
            id: 'walk',
            title: 'Walk around the block',
            rationale: 'A reversible move.',
            status: input?.accept === false ? 'proposed' : 'accepted',
            userNote: '',
            origin: 'custom',
          },
        ],
        freeWillNote: FREE_WILL_NOTE,
      },
      weekly: null,
      yearly: null,
    },
  }
}

function renderContinuity(state: AppState) {
  return render(
    <ContinuityPhase studio={studioView(state)} dispatch={() => undefined} />,
  )
}

describe('Continuity print and calendar export', () => {
  afterEach(() => {
    cleanup()
  })

  it('does not render print or calendar buttons on a fixture session', () => {
    renderContinuity(fixtureState())
    expect(screen.queryByRole('button', { name: 'Print this reading' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download calendar' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Calendar download' })).toBeNull()
  })

  it('renders print and calendar controls after adoption with an accepted step', () => {
    renderContinuity(adoptedState())
    expect(screen.getByRole('button', { name: 'Print this reading' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download calendar' })).toBeInTheDocument()
  })

  it('keeps print and hides calendar download when no step is accepted', () => {
    renderContinuity(adoptedState({ accept: false }))
    expect(screen.getByRole('button', { name: 'Print this reading' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download calendar' })).toBeNull()
  })

  it('puts digest, a source URL, skipped copy, limitations, and free-will text on the print sheet', () => {
    const state = adoptedState()
    renderContinuity(state)
    const sheet = document.querySelector('.print-sheet')
    expect(sheet).not.toBeNull()
    const text = sheet?.textContent ?? ''
    expect(text).toContain(studioView(state).continuity.adoptedDigest)
    expect(text).toContain('https://example.com/sun')
    expect(sheet?.querySelector('a[href="https://example.com/sun"]')).not.toBeNull()
    expect(text).toMatch(/skipped/i)
    expect(text).toContain(
      'This reading is an adopted packet you reviewed. Coverage counts describe this packet only.',
    )
    expect(text).toContain(FREE_WILL_NOTE)
  })
})
