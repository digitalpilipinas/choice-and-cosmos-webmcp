import type {
  ChoiceStep,
  CoverageSummary,
  DerivedProfile,
  ForecastFixture,
  HorizonId,
} from '../domain/types.ts'
import { EVIDENCE_BY_HORIZON } from './evidence.ts'
import { HORIZON_BY_ID } from './horizons.ts'
import {
  REPORT_SECTION_ORDER,
  buildReportSection,
} from './reportSections.ts'

const STEP_TEMPLATES: Record<
  HorizonId,
  readonly [
    { title: string; rationale: string },
    { title: string; rationale: string },
    { title: string; rationale: string },
  ]
> = {
  daily: [
    {
      title: 'Name the next honest hour',
      rationale:
        'Sit with "{focus}" before noon and write one sentence about what would count as enough for this Signal window ({window}). No more than that sentence is required.',
    },
    {
      title: 'Make one reversible move',
      rationale:
        'Pick a step toward "{focus}" that you can undo by tomorrow morning. The point is to act without trapping yourself.',
    },
    {
      title: 'Close the window on purpose',
      rationale:
        'Tonight, mark whether "{focus}" still wants the same next step. If it does not, that change is allowed. This preview does not keep the mark.',
    },
  ],
  weekly: [
    {
      title: 'Set a midweek hinge',
      rationale:
        'Choose a day this week to look at "{focus}" again. {window} is the whole frame. The hinge is a check-in, not a performance review.',
    },
    {
      title: 'Protect one block of attention',
      rationale:
        'Put a single protected block on the week for "{focus}". If it slips, you may move it. You are not required to keep it.',
    },
    {
      title: 'Weekend distillation',
      rationale:
        'Before the week ends, write three words about "{focus}" and one thing you will not carry forward. That refusal is a choice, not a failure.',
    },
  ],
  yearly: [
    {
      title: 'Name the season you are in',
      rationale:
        'For "{focus}", say whether this part of the year feels like planting, tending, harvesting, or lying fallow. {window}. The name is a handle, not a destiny.',
    },
    {
      title: 'Pick a monthly review date',
      rationale:
        'Choose one date each month to reread "{focus}". If a month misses, skip it. The loop works without streaks.',
    },
    {
      title: 'Draft a letter you might never send',
      rationale:
        'Write to yourself about "{focus}" as if the year were already kind. Keep it, burn it, or ignore the prompt. Nothing here files it away.',
    },
  ],
}

export function generateForecast(
  profile: DerivedProfile,
  horizon: HorizonId,
): ForecastFixture {
  const focus = canonicalizeFocus(profile.focusIntention)
  const seed = fixtureHash(`${focus}${horizon}${profile.tone}`)
  const pool = EVIDENCE_BY_HORIZON[horizon]
  const sourcesConsidered = pool.length
  const sourcesUsed = Math.min(2 + ((seed >>> 4) % 3), pool.length)
  const evidence = pickEvidence(pool, sourcesUsed, seed)
  const usedIds = evidence.map((item) => item.id)
  const variant: 0 | 1 = seed % 2 === 0 ? 0 : 1
  const window = HORIZON_BY_ID[horizon].windowDescription

  const sections = REPORT_SECTION_ORDER.map((id, index) =>
    buildReportSection({
      id,
      horizon,
      tone: profile.tone,
      focus,
      variant,
      evidenceIds: evidenceIdsFor(usedIds, index),
    }),
  )

  const coverage: CoverageSummary = {
    sourcesConsidered,
    sourcesUsed: evidence.length,
    timeWindowDescription: window,
    stoppingReason: buildStoppingReason(sourcesConsidered),
    mode: 'fixture',
  }

  const suggestedSteps: ChoiceStep[] = STEP_TEMPLATES[horizon].map(
    (template, index) => ({
      id: `step-${horizon}-${index + 1}`,
      title: template.title,
      rationale: fillStep(template.rationale, { focus: clip(focus), window }),
      status: 'proposed',
      userNote: '',
      origin: 'fixture',
    }),
  )

  return {
    horizon,
    generatedAt: stampFromSeed(seed),
    sections,
    evidence,
    coverage,
    suggestedSteps,
  }
}

function canonicalizeFocus(focus: string): string {
  return focus.trim().replace(/\s+/g, ' ')
}

function buildStoppingReason(sourcesConsidered: number): string {
  return `Stopped after considering all ${sourcesConsidered} sources cataloged for this horizon; fixture mode does not run live research.`
}

export function fixtureHash(input: string): number {
  let hash = 2166136261
  for (const char of input) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickEvidence<T>(pool: readonly T[], count: number, seed: number): T[] {
  const offset = seed % pool.length
  const picked: T[] = []
  for (let i = 0; i < count; i += 1) {
    const item = pool[(offset + i) % pool.length]
    if (item !== undefined) {
      picked.push(item)
    }
  }
  return picked
}

function evidenceIdsFor(
  usedIds: readonly string[],
  index: number,
): string[] {
  if (usedIds.length === 0) {
    return []
  }
  const chosen = usedIds[index % usedIds.length]
  return chosen === undefined ? [] : [chosen]
}

function stampFromSeed(seed: number): string {
  const hour = seed % 24
  const minute = (seed >>> 8) % 60
  const second = (seed >>> 16) % 60
  return `2026-08-26T${pad(hour)}:${pad(minute)}:${pad(second)}.000Z`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function clip(focus: string): string {
  if (focus.length <= 120) {
    return focus
  }
  return `${focus.slice(0, 117)}...`
}

function fillStep(
  template: string,
  values: { focus: string; window: string },
): string {
  return template.replace(/\{(focus|window)\}/g, (_, key: string) => {
    if (key === 'focus' || key === 'window') {
      return values[key]
    }
    return ''
  })
}
