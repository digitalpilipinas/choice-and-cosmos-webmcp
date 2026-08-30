import type { ConfirmationKind } from '../domain/types.ts'

export type ToolErrorCode =
  | 'needs_confirmation'
  | 'confirmation_busy'
  | 'denied'
  | 'unknown_confirmation'
  | 'stale_confirmation'
  | 'invalid_input'
  | 'focus_required'
  | 'no_brief'
  | 'no_reading'
  | 'no_plan'
  | 'unavailable'

export type ToolResult =
  | { ok: true; data: unknown }
  | {
      ok: false
      code: ToolErrorCode
      message: string
      confirmationId?: string
      kind?: ConfirmationKind
    }
