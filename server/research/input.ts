import type { HorizonId } from '../../src/domain/types.ts'
import type { ResearchMode, ResearchRequestInput } from '../../src/research/contract.ts'

const HORIZONS: readonly HorizonId[] = ['daily', 'weekly', 'yearly']
const MODES: readonly ResearchMode[] = ['auto', 'fixture', 'manual']
const MAX_QUERY_CHARS = 2000
const MAX_MANUAL_URLS = 32

export type ParseResult =
  | { ok: true; value: ResearchRequestInput }
  | { ok: false; reason: string }

export function parseResearchInput(body: unknown): ParseResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'Body must be a JSON object.' }
  }

  const record = body as Record<string, unknown>
  const horizon = record.horizon
  if (!isHorizon(horizon)) {
    return {
      ok: false,
      reason: 'horizon must be daily, weekly, or yearly.',
    }
  }

  if (typeof record.query !== 'string') {
    return { ok: false, reason: 'query must be a string.' }
  }
  const query = record.query.trim()
  if (query.length === 0) {
    return { ok: false, reason: 'query must not be empty.' }
  }
  if (query.length > MAX_QUERY_CHARS) {
    return {
      ok: false,
      reason: `query must be at most ${MAX_QUERY_CHARS} characters.`,
    }
  }

  let mode: ResearchMode = 'auto'
  if (record.mode !== undefined) {
    if (!isMode(record.mode)) {
      return {
        ok: false,
        reason: 'mode must be auto, fixture, or manual.',
      }
    }
    mode = record.mode
  }

  let manualUrls: string[] = []
  if (record.manualUrls !== undefined) {
    if (!Array.isArray(record.manualUrls)) {
      return { ok: false, reason: 'manualUrls must be an array of strings.' }
    }
    if (record.manualUrls.length > MAX_MANUAL_URLS) {
      return {
        ok: false,
        reason: `manualUrls must contain at most ${MAX_MANUAL_URLS} entries.`,
      }
    }
    for (const entry of record.manualUrls) {
      if (typeof entry !== 'string') {
        return { ok: false, reason: 'manualUrls must be an array of strings.' }
      }
      manualUrls.push(entry)
    }
  }

  return {
    ok: true,
    value: { horizon, query, mode, manualUrls },
  }
}

function isHorizon(value: unknown): value is HorizonId {
  return typeof value === 'string' && (HORIZONS as readonly string[]).includes(value)
}

function isMode(value: unknown): value is ResearchMode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value)
}
