import { fixtureHash } from '../fixtures/generateForecast.ts'
import { HORIZON_BY_ID } from '../fixtures/horizons.ts'
import { sectionsCitingEvidence } from './selectors.ts'
import type {
  ForecastFixture,
  ForecastSource,
  HorizonId,
  ReportSection,
  ReportSectionId,
} from './types.ts'

export const LIVE_RESEARCH_MOUNTED = false

export const LIVE_RESEARCH_NOTICE =
  'Live research is not mounted in this preview. Source cards are local fixture or manual examples. This app did not search the internet.'

export type FrameworkKind = 'interpretive' | 'reflective'

export type ClaimKind = 'grounded' | 'reflective'

export const CLAIM_KIND_LABEL: Record<ClaimKind, string> = {
  grounded: 'Grounded source notes',
  reflective: 'Reflective interpretation',
}

const INTERPRETIVE_IDS: readonly ReportSectionId[] = [
  'numerology',
  'humanDesign',
  'westernAstrology',
  'chineseElemental',
  'tarotOracle',
  'symbolicCodes',
]

export function frameworkKind(id: ReportSectionId): FrameworkKind {
  return INTERPRETIVE_IDS.includes(id) ? 'interpretive' : 'reflective'
}

export function frameworkKindLabel(kind: FrameworkKind): string {
  return kind === 'interpretive'
    ? 'Interpretive guide, not an objective prediction'
    : 'Reflective framework, not a command'
}

export interface EvidenceCardView {
  id: string
  label: string
  sourceType: ForecastSource
  groundedNote: string
  url: string | null
  provider: 'fixture' | 'manual'
  method: 'local_fixture' | 'user_supplied_link'
  retrievedAt: string
  citingTitles: string[]
}

export function evidenceCards(forecast: ForecastFixture): EvidenceCardView[] {
  return forecast.evidence.map((item) => ({
    id: item.id,
    label: item.label,
    sourceType: forecast.coverage.mode,
    groundedNote: item.note,
    url: null,
    provider: forecast.coverage.mode,
    method:
      forecast.coverage.mode === 'manual'
        ? 'user_supplied_link'
        : 'local_fixture',
    retrievedAt: forecast.generatedAt,
    citingTitles: sectionsCitingEvidence(forecast, item.id).map(
      (section) => section.title,
    ),
  }))
}

export function cardsForSection(
  forecast: ForecastFixture,
  section: ReportSection,
): EvidenceCardView[] {
  const cards = evidenceCards(forecast)
  return section.evidenceIds.flatMap((id) => {
    const card = cards.find((entry) => entry.id === id)
    return card === undefined ? [] : [card]
  })
}

export interface ChartSlot {
  id: string
  label: string
  catalogWeight: number
}

export interface HorizonChartModel {
  horizon: HorizonId
  name: string
  title: string
  caption: string
  slots: ChartSlot[]
}

const WINDOW_SLOTS: Record<
  HorizonId,
  readonly { id: string; label: string }[]
> = {
  daily: [
    { id: 'morning', label: 'Today morning' },
    { id: 'afternoon', label: 'Today afternoon' },
    { id: 'evening', label: 'Tonight' },
    { id: 'next-morning', label: 'Tomorrow morning' },
  ],
  weekly: [
    { id: 'd1', label: 'Day 1' },
    { id: 'd2', label: 'Day 2' },
    { id: 'd3', label: 'Day 3' },
    { id: 'd4', label: 'Day 4' },
    { id: 'd5', label: 'Day 5' },
    { id: 'd6', label: 'Day 6' },
    { id: 'd7', label: 'Day 7' },
  ],
  yearly: [
    { id: 'winter', label: 'Winter' },
    { id: 'spring', label: 'Spring' },
    { id: 'summer', label: 'Summer' },
    { id: 'autumn', label: 'Autumn' },
  ],
}

export function horizonChart(forecast: ForecastFixture): HorizonChartModel {
  const definition = HORIZON_BY_ID[forecast.horizon]
  const templates = WINDOW_SLOTS[forecast.horizon]
  const seed = fixtureHash(
    `${forecast.horizon}${forecast.generatedAt}${forecast.coverage.sourcesUsed}`,
  )
  const weights = distribute(forecast.evidence.length, templates.length, seed)
  return {
    horizon: forecast.horizon,
    name: definition.label,
    title: `${definition.label} window map`,
    caption:
      'Catalog weight per part of this horizon window. These are integer counts of fixture examples, not probabilities, and not a prediction.',
    slots: templates.map((slot, index) => ({
      id: slot.id,
      label: slot.label,
      catalogWeight: weights[index] ?? 0,
    })),
  }
}

function distribute(total: number, buckets: number, seed: number): number[] {
  const weights = Array.from({ length: buckets }, () => 0)
  for (let i = 0; i < total; i += 1) {
    const index = (seed + i * 17) % buckets
    const current = weights[index]
    if (current !== undefined) {
      weights[index] = current + 1
    }
  }
  return weights
}
