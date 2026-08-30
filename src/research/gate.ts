import { PACKET_BOUNDS } from '../domain/bounds.ts'
import type { PacketDigest } from '../domain/brand.ts'
import type { ModularBeliefs } from '../domain/profile.ts'
import { packetDigest, skippedLensesFor } from '../domain/trust.ts'
import type { HorizonId, ReportSectionId } from '../domain/types.ts'
import type { SkippedLens } from './contract.ts'
import { lensSupportedByBeliefs } from './lenses.ts'
import {
  parseReadingPacketV1,
  serializedBytes,
  type ReadingPacketV1,
} from './packet.ts'

declare const admitted: unique symbol

export type AdmittedPacket = ReadingPacketV1 & { readonly [admitted]: true }

export type IntakeBlockCode =
  | 'malformed'
  | 'over_limit'
  | 'incompatible_section'

export type IntakeBlockSubject =
  | { kind: 'packet' }
  | { kind: 'lens'; lens: ReportSectionId }
  | { kind: 'field'; path: string; limit: number; actual: number }

export interface IntakeBlock {
  code: IntakeBlockCode
  subject: IntakeBlockSubject
  reason: string
  remedy: string
}

export interface PacketReview {
  digest: PacketDigest
  horizon: HorizonId
  sourceCount: number
  sectionCount: number
  supported: ReportSectionId[]
  skipped: SkippedLens[]
  untrustedAsData: boolean
  stoppingReason: string
  exhaustive: false
}

export type Admission =
  | { status: 'admitted'; packet: AdmittedPacket; review: PacketReview }
  | { status: 'blocked'; blocks: [IntakeBlock, ...IntakeBlock[]] }

const LENS_NAMES: Record<ReportSectionId, string> = {
  energyOverview: 'Energy overview',
  numerology: 'Numerology',
  humanDesign: 'Human design',
  westernAstrology: 'Western astrology',
  chineseElemental: 'Chinese elemental',
  lifeAreas: 'Life areas',
  decisionSupport: 'Decision support',
  tarotOracle: 'Tarot / oracle',
  focusActionPlan: 'Focus action plan',
  symbolicCodes: 'Symbolic codes',
  higherSelfLetter: 'Higher-self letter',
}

const INJECTION_RE =
  /ignore (all |any )?(previous|prior)|system prompt|you are now\b|act as (?:system|admin)|<\/?system>/i

export function admitPacket(
  raw: unknown,
  input: { beliefs: ModularBeliefs },
): Admission {
  const size = serializedBytes(raw)
  if (size > PACKET_BOUNDS.maxSerializedBytes) {
    return blocked({
      code: 'over_limit',
      subject: {
        kind: 'field',
        path: 'packet',
        limit: PACKET_BOUNDS.maxSerializedBytes,
        actual: size,
      },
      reason: `A transport batch accepts at most ${PACKET_BOUNDS.maxSerializedBytes} serialized bytes.`,
      remedy: `Resubmit a packet at or under ${PACKET_BOUNDS.maxSerializedBytes} serialized bytes.`,
    })
  }
  const countBlock = arrayCountBlock(raw)
  if (countBlock !== null) {
    return blocked(countBlock)
  }
  const packet = parseReadingPacketV1(raw)
  if (packet === null) {
    return blocked({
      code: 'malformed',
      subject: { kind: 'packet' },
      reason:
        'That JSON is not a valid ReadingPacketV1. Manual import uses the same validator as later agent tools.',
      remedy: 'Fix the packet shape, then resubmit a valid ReadingPacketV1.',
    })
  }
  const unsupported = packet.sections.filter(
    (section) => !lensSupportedByBeliefs(section.id, input.beliefs),
  )
  if (unsupported.length > 0) {
    const [first, ...rest] = unsupported
    return {
      status: 'blocked',
      blocks: [
        incompatibleBlock(first.id),
        ...rest.map((section) => incompatibleBlock(section.id)),
      ],
    }
  }
  return {
    status: 'admitted',
    packet: packet as AdmittedPacket,
    review: buildReview(packet, input.beliefs),
  }
}

function arrayCountBlock(raw: unknown): IntakeBlock | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const record = raw as Record<string, unknown>
  if (Array.isArray(record.sources) && record.sources.length > PACKET_BOUNDS.maxSources) {
    return {
      code: 'over_limit',
      subject: {
        kind: 'field',
        path: 'sources',
        limit: PACKET_BOUNDS.maxSources,
        actual: record.sources.length,
      },
      reason: `A transport batch accepts at most ${PACKET_BOUNDS.maxSources} sources.`,
      remedy: `Keep at most ${PACKET_BOUNDS.maxSources} sources, then resubmit.`,
    }
  }
  if (Array.isArray(record.sections) && record.sections.length > PACKET_BOUNDS.maxSections) {
    return {
      code: 'over_limit',
      subject: {
        kind: 'field',
        path: 'sections',
        limit: PACKET_BOUNDS.maxSections,
        actual: record.sections.length,
      },
      reason: `A transport batch accepts at most ${PACKET_BOUNDS.maxSections} sections.`,
      remedy: `Keep at most ${PACKET_BOUNDS.maxSections} sections, then resubmit.`,
    }
  }
  return null
}

function incompatibleBlock(lens: ReportSectionId): IntakeBlock {
  const name = LENS_NAMES[lens]
  return {
    code: 'incompatible_section',
    subject: { kind: 'lens', lens },
    reason: `${name} is present without a matching self-supplied module.`,
    remedy: `Remove the ${lens} section, or add the ${moduleHint(lens)} module, then resubmit.`,
  }
}

function moduleHint(lens: ReportSectionId): string {
  switch (lens) {
    case 'westernAstrology':
      return 'western'
    case 'humanDesign':
      return 'humanDesign'
    case 'numerology':
      return 'numerology'
    case 'chineseElemental':
      return 'chinese'
    default:
      return 'matching'
  }
}

function buildReview(packet: ReadingPacketV1, beliefs: ModularBeliefs): PacketReview {
  return {
    digest: packetDigest(packet),
    horizon: packet.horizon,
    sourceCount: packet.sources.length,
    sectionCount: packet.sections.length,
    supported: packet.sections.map((section) => section.id),
    skipped: skippedLensesFor(packet, beliefs),
    untrustedAsData: packetLooksInjected(packet),
    stoppingReason:
      'This batch stopped at the transport cap or at the sources the agent supplied. It is not an exhaustive search.',
    exhaustive: false,
  }
}

function packetLooksInjected(packet: ReadingPacketV1): boolean {
  for (const source of packet.sources) {
    if (INJECTION_RE.test(`${source.title} ${source.snippet} ${source.provenance.query}`)) {
      return true
    }
  }
  for (const section of packet.sections) {
    if (INJECTION_RE.test(`${section.title} ${section.reflection}`)) {
      return true
    }
  }
  return false
}

function blocked(block: IntakeBlock): Admission {
  return { status: 'blocked', blocks: [block] }
}
