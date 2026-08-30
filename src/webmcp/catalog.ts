import { PACKET_BOUNDS, PLAN_BOUNDS } from '../domain/bounds.ts'

export const TOOL_NAMES = [
  'get_session_status',
  'request_profile_access',
  'propose_profile_update',
  'get_research_brief',
  'submit_reading_packet',
  'inspect_reading',
  'propose_choice_plan',
  'request_plan_save',
] as const

export type ToolName = (typeof TOOL_NAMES)[number]

export interface ToolDescriptor {
  name: ToolName
  title: string
  description: string
  readOnlyHint: boolean
  untrustedContentHint: boolean
  inputSchema: object
}

export const TOOL_CATALOG: readonly ToolDescriptor[] = [
  {
    name: 'get_session_status',
    title: 'Session status',
    description:
      'Read phase, horizon, whether a focus, plan, staged packet, or adopted reading exists, local-save status, agent availability, and any pending confirmation. Never returns profile text, notes, reflections, or a competing report.',
    readOnlyHint: true,
    untrustedContentHint: false,
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'request_profile_access',
    title: 'Request profile access',
    description:
      'Ask the person to confirm an exact field allowlist before returning those self-supplied values. Default allowlist is display name, focus intention, and tone. Belief modules return only when listed and already present. Call once to open the confirmation, then again with confirmationId after they approve.',
    readOnlyHint: true,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        fields: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'displayName',
              'focusIntention',
              'tone',
              'beliefs.western',
              'beliefs.numerology',
              'beliefs.chinese',
              'beliefs.bazi',
              'beliefs.humanDesign',
            ],
          },
        },
        confirmationId: { type: 'string' },
      },
    },
  },
  {
    name: 'propose_profile_update',
    title: 'Propose a profile update',
    description:
      'Propose a change to display name, focus, tone, or self-supplied belief modules. The change is applied only after the person approves the exact diff. Never collects birth date, time, location, accounts, or inferred values.',
    readOnlyHint: false,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        displayName: { type: 'string' },
        focusIntention: { type: 'string' },
        tone: { type: 'string', enum: ['grounded', 'curious', 'bold'] },
        beliefs: { type: 'object' },
        confirmationId: { type: 'string' },
      },
    },
  },
  {
    name: 'get_research_brief',
    title: 'Get research brief',
    description:
      'Return the exact research brief for the current horizon after a research-brief confirmation bound to that brief digest. The brief contains focus, tone, supplied belief fields, requested and skipped lenses, and transport caps. It is not a reading and not an exhaustive search.',
    readOnlyHint: true,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        confirmationId: { type: 'string' },
      },
    },
  },
  {
    name: 'submit_reading_packet',
    title: 'Submit a reading packet',
    description:
      'Assemble an untrusted ReadingPacketV1 in memory using begin, append_sources, append_content, finalize, or cancel. Transport batches stay within existing source and section caps. Finalize stages a review. It does not adopt the packet.',
    readOnlyHint: false,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['op'],
      properties: {
        op: {
          type: 'string',
          enum: ['begin', 'append_sources', 'append_content', 'finalize', 'cancel'],
        },
        horizon: { type: 'string', enum: ['daily', 'weekly', 'yearly'] },
        sources: {
          type: 'array',
          maxItems: PACKET_BOUNDS.maxSources,
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', maxLength: PACKET_BOUNDS.source.id },
              title: { type: 'string', maxLength: PACKET_BOUNDS.source.title },
              snippet: { type: 'string', maxLength: PACKET_BOUNDS.source.snippet },
              url: { type: 'string', maxLength: PACKET_BOUNDS.source.url },
              domain: { type: 'string', maxLength: PACKET_BOUNDS.source.domain },
              provenance: {
                type: 'object',
                properties: {
                  query: { type: 'string', maxLength: PACKET_BOUNDS.source.query },
                },
              },
            },
          },
        },
        content: {
          type: 'array',
          maxItems: PACKET_BOUNDS.maxSections,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', maxLength: PACKET_BOUNDS.section.title },
              frameworkLabel: {
                type: 'string',
                maxLength: PACKET_BOUNDS.section.frameworkLabel,
              },
              reflection: {
                type: 'string',
                maxLength: PACKET_BOUNDS.section.reflection,
              },
              evidenceIds: {
                type: 'array',
                maxItems: PACKET_BOUNDS.maxEvidenceIdsPerSection,
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  {
    name: 'inspect_reading',
    title: 'Inspect the current reading',
    description:
      'Read a concise navigation summary: coverage, supported and skipped lenses, evidence ids, and section titles. Does not return reflections, local notes, browser storage, or a competing full report.',
    readOnlyHint: true,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: 'propose_choice_plan',
    title: 'Propose choice steps',
    description:
      'Add custom steps in proposed status for the person to review. Cannot mark resonance, accept or dismiss steps, persist, export, erase, or approve.',
    readOnlyHint: false,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        titles: {
          type: 'array',
          maxItems: PLAN_BOUNDS.maxProposedTitles,
          items: { type: 'string', maxLength: PLAN_BOUNDS.maxTitleLength },
        },
      },
    },
  },
  {
    name: 'request_plan_save',
    title: 'Request plan save',
    description:
      'Ask the person to confirm this choice plan. Local IndexedDB saving is a separate checkbox and is not implied by plan approval. Nothing is sent anywhere.',
    readOnlyHint: false,
    untrustedContentHint: false,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        confirmationId: { type: 'string' },
      },
    },
  },
]
