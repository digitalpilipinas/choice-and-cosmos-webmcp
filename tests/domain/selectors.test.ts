import { describe, expect, it } from 'vitest'
import {
  COVERAGE_LEVEL_COPY,
  coverageLevel,
  evidenceForSection,
  forecastCockpit,
  hasPersistenceConsent,
  persistSessionOffered,
  profileUpdateDiff,
  sectionsCitingEvidence,
  uncertaintyFor,
} from '../../src/domain/selectors.ts'
import { HORIZON_BY_ID } from '../../src/fixtures/horizons.ts'
import type {
  CoverageSummary,
  DerivedProfile,
  EvidenceItem,
  ForecastFixture,
  ForecastSource,
  PersistenceStatus,
  ReportSection,
} from '../../src/domain/types.ts'

const profile: DerivedProfile = {
  displayName: 'You',
  focusIntention: 'finish the draft',
  tone: 'grounded',
}

function coverage(
  used: number,
  considered: number,
  mode: ForecastSource = 'fixture',
): CoverageSummary {
  return {
    sourcesConsidered: considered,
    sourcesUsed: used,
    timeWindowDescription: 'fixture window',
    stoppingReason: 'fixture stop',
    mode,
  }
}

function section(
  id: ReportSection['id'],
  title: string,
  evidenceIds: string[],
): ReportSection {
  return {
    id,
    title,
    frameworkLabel: 'lens',
    reflection: 'note',
    evidenceIds,
  }
}

function evidenceItem(id: string, label: string): EvidenceItem {
  return {
    id,
    label,
    sourceType: 'fixture',
    note: 'fixture note',
  }
}

function forecast(partial: Partial<ForecastFixture> = {}): ForecastFixture {
  return {
    horizon: 'daily',
    generatedAt: '2026-08-26T00:00:00.000Z',
    sections: [],
    evidence: [],
    coverage: coverage(2, 4),
    suggestedSteps: [],
    ...partial,
  }
}

describe('profileUpdateDiff', () => {
  it('names the exact from and to values for the human gate', () => {
    expect(
      profileUpdateDiff(
        {
          displayName: 'You',
          focusIntention: 'keep this private',
          tone: 'grounded',
        },
        { tone: 'bold', focusIntention: 'a slower question' },
      ),
    ).toEqual([
      {
        field: 'focusIntention',
        label: 'Focus intention',
        from: 'keep this private',
        to: 'a slower question',
      },
      {
        field: 'tone',
        label: 'Tone',
        from: 'grounded',
        to: 'bold',
      },
    ])
  })
})

describe('persistSessionOffered', () => {
  const pendingPlan = {
    status: 'pending' as const,
    id: 'confirm-plan_save',
    kind: 'plan_save' as const,
    summary: 'approve the plan',
    payload: { kind: 'plan_save' as const, horizon: 'daily' as const },
  }

  it('is true only for a pending plan save without persistence consent', () => {
    expect(persistSessionOffered(pendingPlan, { kind: 'undecided' })).toBe(true)
    expect(persistSessionOffered(pendingPlan, { kind: 'declined' })).toBe(true)
    expect(
      persistSessionOffered(pendingPlan, {
        kind: 'held',
        savedAt: '2026-08-26T00:00:00.000Z',
      }),
    ).toBe(true)
    expect(persistSessionOffered(pendingPlan, { kind: 'checking' })).toBe(false)
    expect(persistSessionOffered(pendingPlan, { kind: 'saved', savedAt: 't' })).toBe(
      false,
    )
    expect(
      persistSessionOffered(pendingPlan, { kind: 'unavailable', reason: 'no idb' }),
    ).toBe(false)
    expect(persistSessionOffered({ status: 'idle' }, { kind: 'undecided' })).toBe(
      false,
    )
  })
})

describe('hasPersistenceConsent', () => {
  it.each<[PersistenceStatus, boolean]>([
    [{ kind: 'checking' }, false],
    [{ kind: 'unavailable', reason: 'no idb' }, false],
    [{ kind: 'undecided' }, false],
    [{ kind: 'declined' }, false],
    [{ kind: 'saving' }, true],
    [{ kind: 'saved', savedAt: '2026-08-26T00:00:00.000Z' }, true],
    [{ kind: 'held', savedAt: '2026-08-26T00:00:00.000Z' }, false],
    [
      { kind: 'error', operation: 'save', message: 'write failed' },
      true,
    ],
    [
      { kind: 'error', operation: 'decline', message: 'disk full' },
      false,
    ],
    [
      { kind: 'error', operation: 'erase', message: 'could not erase' },
      true,
    ],
  ])('is $1 for $0.kind', (status, expected) => {
    expect(hasPersistenceConsent(status)).toBe(expected)
  })
})

describe('coverageLevel', () => {
  it('treats zero sourcesConsidered as light', () => {
    expect(coverageLevel(coverage(0, 0))).toBe('light')
    expect(COVERAGE_LEVEL_COPY.light).toMatch(/Light coverage/)
  })

  it('returns light below the 0.4 boundary', () => {
    expect(coverageLevel(coverage(1, 3))).toBe('light')
  })

  it('returns typical from 0.4 inclusive up to 0.75 exclusive', () => {
    expect(coverageLevel(coverage(2, 5))).toBe('typical')
    expect(coverageLevel(coverage(2, 4))).toBe('typical')
    expect(COVERAGE_LEVEL_COPY.typical).toMatch(/Typical coverage/)
  })

  it('returns broad from 0.75 inclusive', () => {
    expect(coverageLevel(coverage(3, 4))).toBe('broad')
    expect(coverageLevel(coverage(4, 4))).toBe('broad')
    expect(COVERAGE_LEVEL_COPY.broad).toMatch(/Broad coverage/)
  })
})

describe('forecastCockpit', () => {
  it.each([
    ['daily', 'Signal'] as const,
    ['weekly', 'Compass'] as const,
    ['yearly', 'Constellation'] as const,
  ])('names %s from the horizon label as %s', (horizon, name) => {
    const cockpit = forecastCockpit(horizon, profile, null)
    const definition = HORIZON_BY_ID[horizon]
    expect(cockpit.name).toBe(name)
    expect(cockpit.name).toBe(definition.label)
    expect(cockpit.horizon).toBe(horizon)
    expect(cockpit.tagline).toBe(definition.tagline)
    expect(cockpit.windowDescription).toBe(definition.windowDescription)
    expect(cockpit.focusIntention).toBe(profile.focusIntention)
    expect(cockpit.generatedAt).toBeNull()
  })

  it('copies generatedAt from the forecast when one exists', () => {
    const existing = forecast({ generatedAt: '2026-08-26T12:00:00.000Z' })
    expect(forecastCockpit('daily', profile, existing).generatedAt).toBe(
      existing.generatedAt,
    )
  })
})

describe('uncertaintyFor', () => {
  it('is unavailable when no forecast exists', () => {
    const state = uncertaintyFor(null)
    expect(state.kind).toBe('unavailable')
    if (state.kind !== 'unavailable') {
      return
    }
    expect(state.reason).toMatch(/no forecast/i)
  })

  it('is partial when sourcesUsed is zero', () => {
    const state = uncertaintyFor(forecast({ coverage: coverage(0, 4) }))
    expect(state.kind).toBe('partial')
    if (state.kind !== 'partial') {
      return
    }
    expect(state.source).toBe('fixture')
    expect(state.coverage.sourcesUsed).toBe(0)
    expect(state.limitations).toMatch(/fixture/)
    expect(state.limitations).toMatch(/not live research/)
    expect(state.limitations).not.toMatch(/confidence score of/)
    expect(state.limitations).toMatch(/not a confidence score/)
    expect(state.limitations).toMatch(/free will/)
  })

  it('is ready when sourcesUsed is above zero', () => {
    const state = uncertaintyFor(forecast({ coverage: coverage(2, 4) }))
    expect(state.kind).toBe('ready')
    if (state.kind !== 'ready') {
      return
    }
    expect(state.source).toBe('fixture')
    expect(state.coverage.sourcesUsed).toBe(2)
    expect(state.limitations).toMatch(/not live research/)
    expect(state.limitations).toMatch(/not a confidence score/)
  })

  it('takes source from coverage.mode for a manual run', () => {
    const state = uncertaintyFor(
      forecast({ coverage: coverage(1, 3, 'manual') }),
    )
    expect(state.kind).toBe('ready')
    if (state.kind === 'unavailable') {
      return
    }
    expect(state.source).toBe('manual')
    expect(state.limitations).toMatch(/manual/)
    expect(state.limitations).toMatch(/not live research/)
  })
})

describe('evidence mapping', () => {
  const energy = section('energyOverview', 'Energy overview', ['e1'])
  const numerology = section('numerology', 'Numerology', [])
  const astrology = section('westernAstrology', 'Western astrology', ['e1', 'missing'])
  const items = [evidenceItem('e1', 'First'), evidenceItem('e2', 'Second')]
  const mapped = forecast({
    sections: [energy, numerology, astrology],
    evidence: items,
  })

  it('resolves cited evidence IDs onto catalog items', () => {
    expect(evidenceForSection(mapped, energy)).toEqual([items[0]])
    expect(evidenceForSection(mapped, numerology)).toEqual([])
    expect(evidenceForSection(mapped, astrology)).toEqual([items[0]])
  })

  it('lists the sections that cite an evidence ID', () => {
    expect(sectionsCitingEvidence(mapped, 'e1').map((entry) => entry.title)).toEqual([
      'Energy overview',
      'Western astrology',
    ])
    expect(sectionsCitingEvidence(mapped, 'e2')).toEqual([])
    expect(sectionsCitingEvidence(mapped, 'missing').map((entry) => entry.id)).toEqual([
      'westernAstrology',
    ])
    expect(sectionsCitingEvidence(mapped, 'uncited')).toEqual([])
  })
})
