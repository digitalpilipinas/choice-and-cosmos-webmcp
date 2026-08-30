export const PACKET_BOUNDS = {
  maxSerializedBytes: 65_536,
  maxSources: 10,
  maxSections: 3,
  maxEvidenceIdsPerSection: 10,
  source: {
    id: 64,
    title: 200,
    snippet: 1_000,
    url: 2_048,
    domain: 253,
    query: 300,
  },
  section: {
    title: 200,
    frameworkLabel: 120,
    reflection: 4_000,
  },
} as const

export const PLAN_BOUNDS = {
  maxProposedTitles: 8,
  maxTitleLength: 160,
  maxUserNoteLength: 500,
  maxStepsPerPlan: 20,
} as const

export const ICS_EVENT_CAPS = {
  daily: 3,
  weekly: 7,
  yearly: 4,
} as const
