import type {
  ConfirmationId,
  Instant,
  MemoryOnly,
  PacketDigest,
  Persistable,
} from './brand.ts'
import { STAGED_TTL_MS } from './brand.ts'
import { asConfirmationId, asPacketDigest, digestHex } from './digest.ts'
import type { ModularBeliefs } from './profile.ts'
import { tarotEligible } from './profile.ts'
import type {
  ConfirmationKind,
  ConfirmationPayload,
  ConfirmationState,
  HorizonId,
  ReportSectionId,
} from './types.ts'
import type { ReadingPacketV1 } from '../research/packet.ts'
import { ALL_LENSES, lensSupportedByBeliefs } from '../research/lenses.ts'
import type { SkippedLens } from '../research/contract.ts'

export type StagedPacket = MemoryOnly<{
  packet: ReadingPacketV1
  digest: PacketDigest
  stagedAt: Instant
  expiresAt: Instant
}>

export type ConfirmationTicket =
  | { status: 'idle' }
  | {
      status: 'pending'
      id: ConfirmationId
      issuedAt: Instant
      expiresAt: Instant
      summary: string
      payload: ConfirmationPayload
    }
  | {
      status: 'approved'
      id: ConfirmationId
      payload: ConfirmationPayload
      issuedAt: Instant
      expiresAt: Instant
    }
  | { status: 'denied'; id: ConfirmationId; kind: ConfirmationKind }
  | { status: 'spent'; id: ConfirmationId }

export interface ReadingDesk {
  staged: StagedPacket | null
  ticket: ConfirmationTicket
}

export const EMPTY_DESK: ReadingDesk = { staged: null, ticket: { status: 'idle' } }

export interface ArtifactCoverage {
  sourcesConsidered: number
  sourcesUsed: number
  timeWindowDescription: string
  stoppingReason: string
  mode: 'adopted'
  exhaustive: false
}

export type ReadingArtifact = Persistable<{
  horizon: HorizonId
  adoptedAt: Instant
  packetDigest: PacketDigest
  sources: ReadingPacketV1['sources']
  sections: ReadingPacketV1['sections']
  coverage: ArtifactCoverage
  skippedLenses: SkippedLens[]
}>

export function packetDigest(packet: ReadingPacketV1): PacketDigest {
  return asPacketDigest(digestHex(packet))
}

export function confirmationIdForPayload(payload: ConfirmationPayload): ConfirmationId {
  return asConfirmationId(digestHex(payload))
}

export function isStagedExpired(staged: StagedPacket, now: Instant): boolean {
  return now >= staged.expiresAt
}

export function stagePacket(
  desk: ReadingDesk,
  packet: ReadingPacketV1,
  input: { now: Instant },
): ReadingDesk | null {
  const digest = packetDigest(packet)
  const staged: StagedPacket = {
    packet,
    digest,
    stagedAt: input.now,
    expiresAt: (input.now + STAGED_TTL_MS) as Instant,
  }
  let ticket = desk.ticket
  if (
    (ticket.status === 'pending' || ticket.status === 'approved') &&
    ticket.payload.kind === 'adopt_reading'
  ) {
    ticket = { status: 'idle' }
  }
  if (ticket.status === 'spent') {
    ticket = { status: 'idle' }
  }
  return { staged, ticket }
}

export function issueConfirmation(
  desk: ReadingDesk,
  input: { payload: ConfirmationPayload; summary: string; now: Instant },
): { desk: ReadingDesk } | null {
  const id = confirmationIdForPayload(input.payload)
  const ticket = desk.ticket
  if (ticket.status === 'approved' || ticket.status === 'denied') {
    return null
  }
  if (ticket.status === 'pending' && ticket.id !== id) {
    return null
  }
  if (ticket.status === 'pending' && ticket.id === id && input.now < ticket.expiresAt) {
    return { desk }
  }
  if (input.payload.kind === 'adopt_reading') {
    if (
      desk.staged === null ||
      desk.staged.digest !== input.payload.packetDigest ||
      desk.staged.packet.horizon !== input.payload.horizon ||
      isStagedExpired(desk.staged, input.now)
    ) {
      return null
    }
  }
  const expiresAt =
    input.payload.kind === 'adopt_reading' && desk.staged !== null
      ? desk.staged.expiresAt
      : ((input.now + STAGED_TTL_MS) as Instant)
  return {
    desk: {
      ...desk,
      ticket: {
        status: 'pending',
        id,
        issuedAt: input.now,
        expiresAt,
        summary: input.summary,
        payload: input.payload,
      },
    },
  }
}

export function isTicketExpired(ticket: ConfirmationTicket, now: Instant): boolean {
  return (
    (ticket.status === 'pending' || ticket.status === 'approved') &&
    now >= ticket.expiresAt
  )
}

export function sectionsAdmissible(
  sections: ReadingPacketV1['sections'],
  beliefs: ModularBeliefs,
): boolean {
  return sections.every((section) => lensSupportedByBeliefs(section.id, beliefs))
}

export function approveTicket(
  desk: ReadingDesk,
  id: ConfirmationId,
  now: Instant,
): ReadingDesk | null {
  const ticket = desk.ticket
  if (
    ticket.status !== 'pending' ||
    ticket.id !== id ||
    isTicketExpired(ticket, now)
  ) {
    return null
  }
  return {
    ...desk,
    ticket: {
      status: 'approved',
      id: ticket.id,
      payload: ticket.payload,
      issuedAt: ticket.issuedAt,
      expiresAt: ticket.expiresAt,
    },
  }
}

export function denyTicket(desk: ReadingDesk, id: ConfirmationId): ReadingDesk | null {
  const ticket = desk.ticket
  if (ticket.status !== 'pending' || ticket.id !== id) {
    return null
  }
  return {
    ...desk,
    ticket: { status: 'denied', id: ticket.id, kind: ticket.payload.kind },
  }
}

export function consumeTicket(desk: ReadingDesk, id: ConfirmationId): ReadingDesk | null {
  const ticket = desk.ticket
  if (ticket.status === 'idle' || ticket.status === 'spent' || ticket.id !== id) {
    return null
  }
  return { ...desk, ticket: { status: 'spent', id } }
}

export function adoptStagedPacket(
  desk: ReadingDesk,
  input: { confirmationId: ConfirmationId; now: Instant; beliefs: ModularBeliefs },
): { desk: ReadingDesk; artifact: ReadingArtifact } | null {
  const ticket = desk.ticket
  const staged = desk.staged
  if (
    ticket.status !== 'approved' ||
    ticket.id !== input.confirmationId ||
    ticket.payload.kind !== 'adopt_reading' ||
    staged === null ||
    staged.digest !== ticket.payload.packetDigest ||
    staged.packet.horizon !== ticket.payload.horizon ||
    isStagedExpired(staged, input.now) ||
    isTicketExpired(ticket, input.now) ||
    !sectionsAdmissible(staged.packet.sections, input.beliefs)
  ) {
    return null
  }
  const artifact: ReadingArtifact = {
    horizon: staged.packet.horizon,
    adoptedAt: input.now,
    packetDigest: staged.digest,
    sources: staged.packet.sources,
    sections: staged.packet.sections,
    coverage: {
      sourcesConsidered: staged.packet.sources.length,
      sourcesUsed: staged.packet.sources.length,
      timeWindowDescription: 'Adopted from a reviewed reading packet.',
      stoppingReason: 'The person adopted this packet. It is not an exhaustive search.',
      mode: 'adopted',
      exhaustive: false,
    },
    skippedLenses: skippedLensesFor(staged.packet, input.beliefs),
  }
  return {
    desk: { staged: null, ticket },
    artifact,
  }
}

export function confirmationView(desk: ReadingDesk): ConfirmationState {
  const ticket = desk.ticket
  switch (ticket.status) {
    case 'idle':
    case 'spent':
      return { status: 'idle' }
    case 'pending':
      return {
        status: 'pending',
        id: ticket.id,
        kind: ticket.payload.kind,
        summary: ticket.summary,
        payload: ticket.payload,
      }
    case 'approved':
      return {
        status: 'approved',
        id: ticket.id,
        kind: ticket.payload.kind,
        payload: ticket.payload,
      }
    case 'denied':
      return { status: 'denied', id: ticket.id, kind: ticket.kind }
  }
}

export function isPersonalized(
  artifact: ReadingArtifact | null,
): artifact is ReadingArtifact {
  return artifact !== null && artifact.coverage.mode === 'adopted'
}

export function clearStaged(desk: ReadingDesk): ReadingDesk {
  const ticket = desk.ticket
  if (
    (ticket.status === 'pending' || ticket.status === 'approved') &&
    ticket.payload.kind === 'adopt_reading'
  ) {
    return { staged: null, ticket: { status: 'idle' } }
  }
  return { staged: null, ticket }
}

export function skippedLensesFor(
  packet: ReadingPacketV1,
  beliefs: ModularBeliefs,
): SkippedLens[] {
  const present = new Set(packet.sections.map((section) => section.id))
  const skipped: SkippedLens[] = []
  for (const lens of ALL_LENSES) {
    if (present.has(lens)) {
      continue
    }
    skipped.push({ lens, reason: skipReason(lens, beliefs, packet) })
  }
  return skipped
}

function skipReason(
  lens: ReportSectionId,
  beliefs: ModularBeliefs,
  packet: ReadingPacketV1,
): string {
  switch (lens) {
    case 'westernAstrology':
      return beliefs.western === undefined
        ? 'Western astrology is skipped until a self-supplied placement is present.'
        : 'Western astrology is skipped because this packet has no supporting section.'
    case 'humanDesign':
      return beliefs.humanDesign === undefined
        ? 'Human Design is skipped until a self-supplied type is present.'
        : 'Human Design is skipped because this packet has no supporting section.'
    case 'numerology':
      return beliefs.numerology === undefined
        ? 'Numerology is skipped until a self-supplied number is present. It is never calculated from a birth date.'
        : 'Numerology is skipped because this packet has no supporting section.'
    case 'chineseElemental':
      return beliefs.chinese === undefined
        ? 'Chinese elemental guidance is skipped until a self-supplied animal or element is present.'
        : 'Chinese elemental guidance is skipped because this packet has no supporting section.'
    case 'tarotOracle':
      return !tarotEligible(beliefs)
        ? 'Tarot is skipped until a Sun sign is present with Sun-specific sources.'
        : packetHasSunEvidence(packet)
          ? 'Tarot is skipped because this packet has no tarot section.'
          : 'Tarot is skipped until current Sun-specific sources are present.'
    default:
      return 'This section is skipped until the packet provides supporting evidence. Generic copy is not used as a stand-in.'
  }
}

function packetHasSunEvidence(packet: ReadingPacketV1): boolean {
  return packet.sources.some((source) => /sun/i.test(`${source.title} ${source.snippet}`))
}
