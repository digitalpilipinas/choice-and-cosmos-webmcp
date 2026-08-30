import { parseCosmicProfile } from '../../src/domain/cosmic.ts'
import type { HorizonId, ReportSectionId } from '../../src/domain/types.ts'
import {
  RESEARCH_BRIEF_SCHEMA_VERSION,
  type PersonalizedRequest,
  type ResearchBrief,
  type ResearchMode,
  type ResearchRequestInput,
} from '../../src/research/contract.ts'
import { ALWAYS_LENSES, isReportSectionId } from '../../src/research/lenses.ts'

const HORIZONS: readonly HorizonId[] = ['daily', 'weekly', 'yearly']
const MODES: readonly ResearchMode[] = ['auto', 'fixture', 'manual']
const TONES = ['grounded', 'curious', 'bold'] as const
const MAX_FOCUS_CHARS = 2000
const MAX_MANUAL_URLS = 32
const MAX_LENSES = 11
const MAX_WALK_NODES = 64

const V1_KEYS = new Set(['horizon', 'query', 'mode', 'manualUrls'])
const V2_KEYS = new Set(['schemaVersion', 'mode', 'brief', 'manualUrls'])
const BRIEF_KEYS = new Set([
  'schemaVersion',
  'horizon',
  'focus',
  'tone',
  'cosmic',
  'requestedLenses',
])

const FORBIDDEN_KEYS = new Set([
  'displayName',
  'birthDate',
  'birthTime',
  'birthPlace',
  'birthLocation',
  'account',
  'accounts',
  'ip',
  'rawIp',
  'rawIP',
  'CF-Connecting-IP',
  'cfConnectingIp',
  'identity',
  'providerInstructions',
  'instructions',
  'prompt',
  'apiKey',
  'GEMINI_API_KEY',
])

export type ParsedResearchBody =
  | { ok: true; version: 1; value: ResearchRequestInput }
  | { ok: true; version: 2; value: PersonalizedRequest }
  | { ok: false; reason: string; declaredVersion: 1 | 2 }

type ParseFail = { ok: false; reason: string }

export type ParseResult =
  | { ok: true; value: ResearchRequestInput }
  | { ok: false; reason: string }

export function parseResearchInput(body: unknown): ParseResult {
  const parsed = parseResearchBody(body)
  if (!parsed.ok) {
    return parsed
  }
  if (parsed.version !== 1) {
    return {
      ok: false,
      reason: 'Body must be a version-1 research request.',
    }
  }
  return { ok: true, value: parsed.value }
}

export function parseResearchBody(body: unknown): ParsedResearchBody {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Body must be a JSON object.', 1)
  }

  const record = body as Record<string, unknown>
  const declaredVersion: 1 | 2 =
    record.schemaVersion === RESEARCH_BRIEF_SCHEMA_VERSION ? 2 : 1
  const forbidden = findForbiddenKey(record, 0, 0)
  if (forbidden !== null) {
    return fail(
      `Forbidden personal field ${forbidden} is not allowed on a research request.`,
      declaredVersion,
    )
  }

  if (record.schemaVersion === RESEARCH_BRIEF_SCHEMA_VERSION) {
    return declare(parseV2(record), 2)
  }
  if (record.schemaVersion !== undefined) {
    return fail('schemaVersion must be 2 when present.', 1)
  }
  return declare(parseV1(record), 1)
}

function fail(reason: string, declaredVersion: 1 | 2): ParseFail & {
  declaredVersion: 1 | 2
} {
  return { ok: false, reason, declaredVersion }
}

function declare(
  parsed: Exclude<ParsedResearchBody, { ok: false }> | ParseFail,
  declaredVersion: 1 | 2,
): ParsedResearchBody {
  if (!parsed.ok) {
    return fail(parsed.reason, declaredVersion)
  }
  return parsed
}

function parseV1(
  record: Record<string, unknown>,
): Exclude<ParsedResearchBody, { ok: false }> | ParseFail {
  const extra = extraKeys(record, V1_KEYS)
  if (extra !== null) {
    return extra
  }

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
  if (query.length > MAX_FOCUS_CHARS) {
    return {
      ok: false,
      reason: `query must be at most ${MAX_FOCUS_CHARS} characters.`,
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

  const urls = parseManualUrls(record.manualUrls)
  if (!urls.ok) {
    return urls
  }

  return {
    ok: true,
    version: 1,
    value: { horizon, query, mode, manualUrls: urls.value },
  }
}

function parseV2(
  record: Record<string, unknown>,
): Exclude<ParsedResearchBody, { ok: false }> | ParseFail {
  const extra = extraKeys(record, V2_KEYS)
  if (extra !== null) {
    return extra
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

  const brief = parseBrief(record.brief, mode)
  if (!brief.ok) {
    return brief
  }

  const urls = parseManualUrls(record.manualUrls)
  if (!urls.ok) {
    return urls
  }

  return {
    ok: true,
    version: 2,
    value: {
      schemaVersion: 2,
      mode,
      brief: brief.value,
      manualUrls: urls.value,
    },
  }
}

function parseBrief(
  raw: unknown,
  mode: ResearchMode,
): { ok: true; value: ResearchBrief } | { ok: false; reason: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'brief must be a JSON object.' }
  }
  const record = raw as Record<string, unknown>
  const extra = extraKeys(record, BRIEF_KEYS)
  if (extra !== null) {
    return extra
  }
  if (record.schemaVersion !== RESEARCH_BRIEF_SCHEMA_VERSION) {
    return { ok: false, reason: 'brief.schemaVersion must be 2.' }
  }
  if (!isHorizon(record.horizon)) {
    return {
      ok: false,
      reason: 'brief.horizon must be daily, weekly, or yearly.',
    }
  }
  if (typeof record.focus !== 'string') {
    return { ok: false, reason: 'brief.focus must be a string.' }
  }
  const focus = record.focus.trim()
  if (focus.length === 0) {
    return { ok: false, reason: 'brief.focus must not be empty.' }
  }
  if (focus.length > MAX_FOCUS_CHARS) {
    return {
      ok: false,
      reason: `brief.focus must be at most ${MAX_FOCUS_CHARS} characters.`,
    }
  }
  if (!isTone(record.tone)) {
    return {
      ok: false,
      reason: 'brief.tone must be grounded, curious, or bold.',
    }
  }
  const cosmic = parseCosmicProfile(record.cosmic)
  if (cosmic === null) {
    return {
      ok: false,
      reason:
        'brief.cosmic must contain only approved closed-enum profile fields.',
    }
  }
  if (mode === 'auto' && cosmic.sunSign === undefined) {
    return {
      ok: false,
      reason: 'Personalized auto research requires a Sun sign. It is never inferred.',
    }
  }

  const lenses = parseLenses(record.requestedLenses)
  if (!lenses.ok) {
    return lenses
  }

  return {
    ok: true,
    value: {
      schemaVersion: 2,
      horizon: record.horizon,
      focus,
      tone: record.tone,
      cosmic,
      requestedLenses: lenses.value,
    },
  }
}

function parseLenses(
  raw: unknown,
): { ok: true; value: ReportSectionId[] } | { ok: false; reason: string } {
  if (raw === undefined) {
    return { ok: true, value: [...ALWAYS_LENSES] }
  }
  if (!Array.isArray(raw)) {
    return { ok: false, reason: 'brief.requestedLenses must be an array of lens ids.' }
  }
  if (raw.length > MAX_LENSES) {
    return {
      ok: false,
      reason: `brief.requestedLenses must contain at most ${MAX_LENSES} entries.`,
    }
  }
  const lenses: ReportSectionId[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!isReportSectionId(entry)) {
      return {
        ok: false,
        reason: 'brief.requestedLenses must contain only approved lens ids.',
      }
    }
    if (seen.has(entry)) {
      return {
        ok: false,
        reason: 'brief.requestedLenses must not contain duplicates.',
      }
    }
    seen.add(entry)
    lenses.push(entry)
  }
  if (lenses.length === 0) {
    return { ok: true, value: [...ALWAYS_LENSES] }
  }
  return { ok: true, value: lenses }
}

function parseManualUrls(
  raw: unknown,
): { ok: true; value: string[] } | { ok: false; reason: string } {
  if (raw === undefined) {
    return { ok: true, value: [] }
  }
  if (!Array.isArray(raw)) {
    return { ok: false, reason: 'manualUrls must be an array of strings.' }
  }
  if (raw.length > MAX_MANUAL_URLS) {
    return {
      ok: false,
      reason: `manualUrls must contain at most ${MAX_MANUAL_URLS} entries.`,
    }
  }
  const manualUrls: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      return { ok: false, reason: 'manualUrls must be an array of strings.' }
    }
    manualUrls.push(entry)
  }
  return { ok: true, value: manualUrls }
}

function extraKeys(
  record: Record<string, unknown>,
  allowed: Set<string>,
): { ok: false; reason: string } | null {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      return {
        ok: false,
        reason: `Unexpected field ${key} is not allowed on this research request.`,
      }
    }
  }
  return null
}

function findForbiddenKey(
  value: unknown,
  depth: number,
  nodes: number,
): string | null {
  if (nodes > MAX_WALK_NODES || depth > 8 || value === null || value === undefined) {
    return null
  }
  if (Array.isArray(value)) {
    let walked = nodes
    for (const entry of value) {
      walked += 1
      const found = findForbiddenKey(entry, depth + 1, walked)
      if (found !== null) {
        return found
      }
    }
    return null
  }
  if (typeof value !== 'object') {
    return null
  }
  const record = value as Record<string, unknown>
  let walked = nodes
  for (const [key, child] of Object.entries(record)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return key
    }
    walked += 1
    const found = findForbiddenKey(child, depth + 1, walked)
    if (found !== null) {
      return found
    }
  }
  return null
}

function isHorizon(value: unknown): value is HorizonId {
  return typeof value === 'string' && (HORIZONS as readonly string[]).includes(value)
}

function isMode(value: unknown): value is ResearchMode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value)
}

function isTone(
  value: unknown,
): value is (typeof TONES)[number] {
  return typeof value === 'string' && (TONES as readonly string[]).includes(value)
}
