import type { EvidenceId, SafeHttpsUrl } from '../domain/brand.ts'
import { PACKET_BOUNDS } from '../domain/bounds.ts'
import { canonicalJson } from '../domain/digest.ts'
import type { HorizonId, ReportSectionId } from '../domain/types.ts'
import { ALL_LENSES, isReportSectionId } from './lenses.ts'

export const RETAINED_CAPS: Record<HorizonId, { maxSources: number; maxNovelDomains: number }> =
  {
    daily: { maxSources: 12, maxNovelDomains: 4 },
    weekly: { maxSources: 24, maxNovelDomains: 8 },
    yearly: { maxSources: 36, maxNovelDomains: 12 },
  }

export const REPORT_MAX_SECTIONS = 11

export type PacketProvenance =
  | { provider: 'agent'; method: 'untrusted_submission'; query: string }
  | { provider: 'manual'; method: 'user_supplied_link'; query: string }

export interface PacketSource {
  id: EvidenceId
  title: string
  url: SafeHttpsUrl
  snippet: string
  domain: string
  provenance: PacketProvenance
}

export interface PacketSection {
  id: ReportSectionId
  title: string
  frameworkLabel: string
  reflection: string
  evidenceIds: [EvidenceId, ...EvidenceId[]]
}

export interface ReadingPacketV1 {
  schemaVersion: 1
  horizon: HorizonId
  sources: PacketSource[]
  sections: PacketSection[]
}

const PACKET_KEYS = new Set(['schemaVersion', 'horizon', 'sources', 'sections'])
const SOURCE_KEYS = new Set(['id', 'title', 'url', 'snippet', 'domain', 'provenance'])
const SECTION_KEYS = new Set(['id', 'title', 'frameworkLabel', 'reflection', 'evidenceIds'])
const PROVENANCE_KEYS = new Set(['provider', 'method', 'query'])
const FORBIDDEN = new Set([
  'birthDate',
  'birthTime',
  'birthLocation',
  'displayName',
  'apiKey',
  'gemini',
])

export function serializedBytes(value: unknown): number {
  return new TextEncoder().encode(canonicalJson(value)).length
}

export function parseReadingPacketV1(raw: unknown): ReadingPacketV1 | null {
  if (serializedBytes(raw) > PACKET_BOUNDS.maxSerializedBytes) {
    return null
  }
  if (!isRecord(raw) || hasForbidden(raw) || hasUnknown(raw, PACKET_KEYS)) {
    return null
  }
  if (raw.schemaVersion !== 1 || !isHorizonId(raw.horizon)) {
    return null
  }
  if (!Array.isArray(raw.sources) || !Array.isArray(raw.sections)) {
    return null
  }
  if (
    raw.sources.length < 1 ||
    raw.sources.length > PACKET_BOUNDS.maxSources ||
    raw.sections.length < 1 ||
    raw.sections.length > PACKET_BOUNDS.maxSections
  ) {
    return null
  }
  const sources: PacketSource[] = []
  const ids = new Set<string>()
  for (const item of raw.sources) {
    const source = parseSource(item)
    if (source === null || ids.has(source.id)) {
      return null
    }
    ids.add(source.id)
    sources.push(source)
  }
  const sections: PacketSection[] = []
  const sectionIds = new Set<ReportSectionId>()
  for (const item of raw.sections) {
    const section = parseSection(item, ids)
    if (section === null || sectionIds.has(section.id)) {
      return null
    }
    sectionIds.add(section.id)
    sections.push(section)
  }
  if (sectionIds.size > REPORT_MAX_SECTIONS) {
    return null
  }
  return {
    schemaVersion: 1,
    horizon: raw.horizon,
    sources,
    sections,
  }
}

function parseSource(raw: unknown): PacketSource | null {
  if (!isRecord(raw) || hasForbidden(raw) || hasUnknown(raw, SOURCE_KEYS)) {
    return null
  }
  if (
    typeof raw.id !== 'string' ||
    raw.id.trim().length === 0 ||
    raw.id.length > PACKET_BOUNDS.source.id ||
    typeof raw.title !== 'string' ||
    raw.title.trim().length === 0 ||
    raw.title.length > PACKET_BOUNDS.source.title ||
    typeof raw.snippet !== 'string' ||
    raw.snippet.length > PACKET_BOUNDS.source.snippet
  ) {
    return null
  }
  if (typeof raw.url !== 'string' || raw.url.length > PACKET_BOUNDS.source.url) {
    return null
  }
  const url = parseSafeHttpsUrl(raw.url)
  if (url === null) {
    return null
  }
  const domain = domainOf(url)
  if (domain.length > PACKET_BOUNDS.source.domain) {
    return null
  }
  if (raw.domain !== undefined && raw.domain !== domain) {
    return null
  }
  const provenance = parseProvenance(raw.provenance)
  if (provenance === null) {
    return null
  }
  return {
    id: raw.id as EvidenceId,
    title: raw.title.trim(),
    url,
    snippet: raw.snippet,
    domain,
    provenance,
  }
}

function parseSection(
  raw: unknown,
  sourceIds: Set<string>,
): PacketSection | null {
  if (!isRecord(raw) || hasForbidden(raw) || hasUnknown(raw, SECTION_KEYS)) {
    return null
  }
  if (!isReportSectionId(raw.id) || !ALL_LENSES.includes(raw.id)) {
    return null
  }
  if (
    typeof raw.title !== 'string' ||
    raw.title.length > PACKET_BOUNDS.section.title ||
    typeof raw.frameworkLabel !== 'string' ||
    raw.frameworkLabel.length > PACKET_BOUNDS.section.frameworkLabel ||
    typeof raw.reflection !== 'string' ||
    raw.reflection.length > PACKET_BOUNDS.section.reflection ||
    !Array.isArray(raw.evidenceIds) ||
    raw.evidenceIds.length < 1 ||
    raw.evidenceIds.length > PACKET_BOUNDS.maxEvidenceIdsPerSection
  ) {
    return null
  }
  const evidenceIds: EvidenceId[] = []
  for (const id of raw.evidenceIds) {
    if (typeof id !== 'string' || !sourceIds.has(id)) {
      return null
    }
    evidenceIds.push(id as EvidenceId)
  }
  return {
    id: raw.id,
    title: raw.title,
    frameworkLabel: raw.frameworkLabel,
    reflection: raw.reflection,
    evidenceIds: evidenceIds as [EvidenceId, ...EvidenceId[]],
  }
}

function parseProvenance(raw: unknown): PacketProvenance | null {
  if (!isRecord(raw) || hasForbidden(raw) || hasUnknown(raw, PROVENANCE_KEYS)) {
    return null
  }
  if (typeof raw.query !== 'string' || raw.query.length > PACKET_BOUNDS.source.query) {
    return null
  }
  if (raw.provider === 'agent' && raw.method === 'untrusted_submission') {
    return { provider: 'agent', method: 'untrusted_submission', query: raw.query }
  }
  if (raw.provider === 'manual' && raw.method === 'user_supplied_link') {
    return { provider: 'manual', method: 'user_supplied_link', query: raw.query }
  }
  return null
}

export function parseSafeHttpsUrl(raw: unknown): SafeHttpsUrl | null {
  if (typeof raw !== 'string') {
    return null
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') {
    return null
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return null
  }
  if (parsed.hostname.length === 0) {
    return null
  }
  parsed.hash = ''
  return parsed.href as SafeHttpsUrl
}

function domainOf(url: SafeHttpsUrl): string {
  return new URL(url).hostname
}

function isHorizonId(value: unknown): value is HorizonId {
  return value === 'daily' || value === 'weekly' || value === 'yearly'
}

function hasForbidden(raw: Record<string, unknown>): boolean {
  return Object.keys(raw).some((key) => FORBIDDEN.has(key))
}

function hasUnknown(raw: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(raw).some((key) => !allowed.has(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
