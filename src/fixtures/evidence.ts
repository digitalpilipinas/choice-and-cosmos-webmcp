import type { EvidenceItem, HorizonId } from '../domain/types.ts'

const FIXTURE_DISCLAIMER =
  'Fixture example provenance only. This is not a live search result, and it was not fetched from the internet.'

export const EVIDENCE_BY_HORIZON: Record<HorizonId, readonly EvidenceItem[]> = {
  daily: [
    {
      id: 'daily-circadian',
      label: 'Sample circadian-rhythm notes (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a short-window energy article.`,
    },
    {
      id: 'daily-attention',
      label: 'Sample attention-budget excerpt (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a focus-and-fatigue briefing.`,
    },
    {
      id: 'daily-weather-mood',
      label: 'Sample weather-and-mood pairing (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a local-atmosphere color note, with no location collected.`,
    },
    {
      id: 'daily-decision-hygiene',
      label: 'Sample decision-hygiene checklist (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a same-day choice hygiene card.`,
    },
  ],
  weekly: [
    {
      id: 'weekly-cadence',
      label: 'Sample weekly cadence sketch (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a seven-day planning essay.`,
    },
    {
      id: 'weekly-social-load',
      label: 'Sample social-load map (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a midweek energy accounting note.`,
    },
    {
      id: 'weekly-review-form',
      label: 'Sample Friday review form (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a weekend hinge prompt.`,
    },
    {
      id: 'weekly-elemental',
      label: 'Sample elemental-week pairing (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a five-phase seasonal metaphor, not a climate record.`,
    },
    {
      id: 'weekly-tarot-spread',
      label: 'Sample three-card spread notes (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for an oracle workbook page.`,
    },
  ],
  yearly: [
    {
      id: 'yearly-arc',
      label: 'Sample yearly-arc essay (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a long-horizon reflection pamphlet.`,
    },
    {
      id: 'yearly-season-wheel',
      label: 'Sample season-wheel diagram (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a four-season metaphor sheet.`,
    },
    {
      id: 'yearly-values',
      label: 'Sample values-and-tradeoffs list (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a yearly values inventory.`,
    },
    {
      id: 'yearly-letter-form',
      label: 'Sample letter-to-self form (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a higher-self correspondence prompt.`,
    },
    {
      id: 'yearly-cycle-notes',
      label: 'Sample cycle-and-return notes (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a long-cycle essay, used only as metaphor.`,
    },
    {
      id: 'yearly-constellation',
      label: 'Sample constellation-as-map notes (fixture)',
      sourceType: 'fixture',
      note: `${FIXTURE_DISCLAIMER} Invented as a stand-in for a sky-chart caption. No sky was observed.`,
    },
  ],
}
