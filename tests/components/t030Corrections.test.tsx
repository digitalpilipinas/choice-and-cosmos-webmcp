import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentBar } from '../../src/components/AgentBar.tsx'
import { ChoicePhase } from '../../src/components/phases/ChoicePhase.tsx'
import { PLAN_BOUNDS } from '../../src/domain/bounds.ts'
import { asBriefDigest } from '../../src/domain/digest.ts'
import { appReducer, INITIAL_STATE } from '../../src/domain/loop.ts'
import { studioView } from '../../src/domain/studioView.ts'
import type { ConfirmationState, PersonProfile } from '../../src/domain/types.ts'

afterEach(() => {
  cleanup()
})

describe('T030 consent snapshot and plan input caps', () => {
  it('renders the digest-bound brief snapshot instead of live profile text', () => {
    const confirmation: ConfirmationState = {
      status: 'pending',
      id: 'c1.preview',
      kind: 'research_brief',
      summary: 'An agent wants the exact research brief.',
      payload: {
        kind: 'research_brief',
        horizon: 'daily',
        briefDigest: asBriefDigest('deadbeef'),
        fields: ['focusIntention', 'tone'],
        snapshot: {
          focus: 'frozen focus',
          tone: 'grounded',
          requestedLenses: ['energyOverview'],
          skippedLenses: ['numerology'],
        },
      },
    }
    const profile: PersonProfile = {
      displayName: 'You',
      focusIntention: 'live focus that should not appear',
      tone: 'bold',
      beliefs: { western: { sun: 'leo' } },
    }
    render(
      <AgentBar
        availability={{ kind: 'ready' }}
        confirmation={confirmation}
        profile={profile}
        plan={null}
        persistence={{ kind: 'undecided' }}
        onApprove={() => undefined}
        onDeny={() => undefined}
      />,
    )
    expect(screen.getByText('frozen focus')).toBeInTheDocument()
    expect(screen.getByText('grounded')).toBeInTheDocument()
    expect(screen.getByText('energyOverview')).toBeInTheDocument()
    expect(
      screen.queryByText('live focus that should not appear'),
    ).not.toBeInTheDocument()
  })

  it('caps custom step title and note fields at PLAN_BOUNDS', () => {
    const state = appReducer(
      appReducer(INITIAL_STATE, {
        type: 'SET_PROFILE_FIELD',
        field: 'focusIntention',
        value: 'finish the draft',
      }),
      { type: 'GENERATE_FORECAST' },
    )
    render(
      <ChoicePhase studio={studioView(state)} dispatch={() => undefined} />,
    )
    expect(screen.getByLabelText('Step title')).toHaveAttribute(
      'maxLength',
      String(PLAN_BOUNDS.maxTitleLength),
    )
    expect(screen.getByLabelText('Note (optional)')).toHaveAttribute(
      'maxLength',
      String(PLAN_BOUNDS.maxUserNoteLength),
    )
    const noteFields = screen.getAllByLabelText(/personal note/i)
    expect(noteFields[0]).toHaveAttribute(
      'maxLength',
      String(PLAN_BOUNDS.maxUserNoteLength),
    )
  })
})
