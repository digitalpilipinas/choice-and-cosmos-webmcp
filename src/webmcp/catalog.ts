export const TOOL_NAMES = [
  'get_session_status',
  'request_profile_access',
  'propose_profile_update',
  'generate_forecast',
  'inspect_evidence',
  'draft_choice_plan',
  'request_plan_save',
  'request_external_share',
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
      'Read phase, horizon, whether a focus or forecast exists, local-save status, agent availability, and any pending confirmation. Never returns profile text, notes, or plan wording.',
    readOnlyHint: true,
    untrustedContentHint: false,
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'request_profile_access',
    title: 'Request profile access',
    description:
      'Ask the person to confirm before returning display name, focus intention, and tone. Call once to open the confirmation, then again with confirmationId after they approve.',
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
    name: 'propose_profile_update',
    title: 'Propose a profile update',
    description:
      'Propose a change to display name, focus intention, or tone. The change is applied only after the person approves the exact diff. Never collects birth date, time, or location.',
    readOnlyHint: false,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        displayName: { type: 'string' },
        focusIntention: { type: 'string' },
        tone: { type: 'string', enum: ['grounded', 'curious', 'bold'] },
        confirmationId: { type: 'string' },
      },
    },
  },
  {
    name: 'generate_forecast',
    title: 'Generate a fixture forecast',
    description:
      'Generate or regenerate the fixture forecast for the current or named horizon. Regeneration resets fixture steps to proposed and keeps custom steps. Requires a focus intention already in the session.',
    readOnlyHint: false,
    untrustedContentHint: false,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        horizon: { type: 'string', enum: ['daily', 'weekly', 'yearly'] },
      },
    },
  },
  {
    name: 'inspect_evidence',
    title: 'Inspect evidence',
    description:
      'Read fixture evidence, coverage, and uncertainty for the current horizon. Optional evidenceId or sectionId narrows the result. Does not return personal notes.',
    readOnlyHint: true,
    untrustedContentHint: false,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        evidenceId: { type: 'string' },
        sectionId: { type: 'string' },
      },
    },
  },
  {
    name: 'draft_choice_plan',
    title: 'Draft the choice plan',
    description:
      'Accept, dismiss, annotate, add, or remove steps on the current choice plan. Removing works only for custom steps. Saving the plan is a separate confirmed tool.',
    readOnlyHint: false,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['set_status', 'set_note', 'add_step', 'remove_step'],
        },
        stepId: { type: 'string' },
        status: {
          type: 'string',
          enum: ['proposed', 'accepted', 'dismissed'],
        },
        title: { type: 'string' },
        userNote: { type: 'string' },
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
  {
    name: 'request_external_share',
    title: 'Request external sharing',
    description:
      'Ask the person to confirm sharing selected session parts with a future Gemini research run. Approval is recorded only. This slice does not send data.',
    readOnlyHint: false,
    untrustedContentHint: false,
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        include: {
          type: 'array',
          items: { type: 'string', enum: ['profile', 'forecast', 'plan'] },
        },
        confirmationId: { type: 'string' },
      },
    },
  },
]
