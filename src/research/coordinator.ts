import { PACKET_BOUNDS } from '../domain/bounds.ts'
import type { PacketDigest } from '../domain/brand.ts'
import type { ModularBeliefs } from '../domain/profile.ts'
import type { HorizonId } from '../domain/types.ts'
import { serializedBytes } from './packet.ts'
import {
  admitPacket,
  type AdmittedPacket,
  type IntakeBlock,
  type PacketReview,
} from './gate.ts'

export type { AdmittedPacket, IntakeBlock, PacketReview } from './gate.ts'

export const INTAKE_REJECT_CODES = [
  'malformed',
  'over_limit',
  'expired',
  'cancelled',
  'incompatible',
] as const

export type IntakeRejectCode = (typeof INTAKE_REJECT_CODES)[number]

export type PacketIntake =
  | { status: 'idle' }
  | {
      status: 'assembling'
      horizon: HorizonId
      sources: unknown[]
      sections: unknown[]
    }
  | { status: 'ready'; packet: AdmittedPacket; review: PacketReview }
  | { status: 'rejected'; code: IntakeRejectCode; reason: string }
  | { status: 'adopted'; digest: PacketDigest }

export const EMPTY_INTAKE: PacketIntake = { status: 'idle' }

export type IntakeCommand =
  | { op: 'begin'; horizon: HorizonId }
  | { op: 'append_sources'; sources: unknown[] }
  | { op: 'append_sections'; sections: unknown[] }
  | { op: 'finalize' }
  | { op: 'cancel' }
  | { op: 'import_json'; text: string }

export interface IntakeApplyResult {
  intake: PacketIntake
  packet: AdmittedPacket | null
}

export interface IntakeProgress {
  sources: number
  sections: number
  maxSources: number
  maxSections: number
}

export function applyIntake(
  intake: PacketIntake,
  command: IntakeCommand,
  input: { beliefs: ModularBeliefs },
): IntakeApplyResult {
  switch (command.op) {
    case 'begin':
      return beginIntake(intake, command.horizon)
    case 'append_sources':
      return appendSources(intake, command.sources)
    case 'append_sections':
      return appendSections(intake, command.sections)
    case 'finalize':
      return finalizeIntake(intake, input.beliefs)
    case 'cancel':
      return {
        intake: {
          status: 'rejected',
          code: 'cancelled',
          reason: 'This packet batch was cancelled. It was not adopted.',
        },
        packet: null,
      }
    case 'import_json':
      return importJson(command.text, input.beliefs)
  }
}

export function intakeProgress(intake: PacketIntake): IntakeProgress {
  const maxSources = PACKET_BOUNDS.maxSources
  const maxSections = PACKET_BOUNDS.maxSections
  switch (intake.status) {
    case 'idle':
    case 'rejected':
    case 'adopted':
      return { sources: 0, sections: 0, maxSources, maxSections }
    case 'assembling':
      return {
        sources: intake.sources.length,
        sections: intake.sections.length,
        maxSources,
        maxSections,
      }
    case 'ready':
      return {
        sources: intake.packet.sources.length,
        sections: intake.packet.sections.length,
        maxSources,
        maxSections,
      }
  }
}

function beginIntake(intake: PacketIntake, horizon: HorizonId): IntakeApplyResult {
  if (intake.status === 'assembling' && intake.horizon === horizon) {
    return { intake, packet: null }
  }
  return {
    intake: { status: 'assembling', horizon, sources: [], sections: [] },
    packet: null,
  }
}

function appendSources(intake: PacketIntake, sources: unknown[]): IntakeApplyResult {
  if (intake.status !== 'assembling') {
    return reject(
      'malformed',
      'Begin a packet batch before appending sources.',
    )
  }
  if (!Array.isArray(sources)) {
    return reject('malformed', 'append_sources requires an array.')
  }
  const next = [...intake.sources, ...sources]
  if (next.length > PACKET_BOUNDS.maxSources) {
    return reject(
      'over_limit',
      `A transport batch accepts at most ${PACKET_BOUNDS.maxSources} sources.`,
    )
  }
  const envelope = {
    schemaVersion: 1,
    horizon: intake.horizon,
    sources: next,
    sections: intake.sections,
  }
  if (serializedBytes(envelope) > PACKET_BOUNDS.maxSerializedBytes) {
    return reject(
      'over_limit',
      `A transport batch accepts at most ${PACKET_BOUNDS.maxSerializedBytes} serialized bytes.`,
    )
  }
  return {
    intake: { ...intake, sources: next },
    packet: null,
  }
}

function appendSections(intake: PacketIntake, sections: unknown[]): IntakeApplyResult {
  if (intake.status !== 'assembling') {
    return reject(
      'malformed',
      'Begin a packet batch before appending sections.',
    )
  }
  if (!Array.isArray(sections)) {
    return reject('malformed', 'append_sections requires an array.')
  }
  const next = [...intake.sections, ...sections]
  if (next.length > PACKET_BOUNDS.maxSections) {
    return reject(
      'over_limit',
      `A transport batch accepts at most ${PACKET_BOUNDS.maxSections} sections.`,
    )
  }
  const envelope = {
    schemaVersion: 1,
    horizon: intake.horizon,
    sources: intake.sources,
    sections: next,
  }
  if (serializedBytes(envelope) > PACKET_BOUNDS.maxSerializedBytes) {
    return reject(
      'over_limit',
      `A transport batch accepts at most ${PACKET_BOUNDS.maxSerializedBytes} serialized bytes.`,
    )
  }
  return {
    intake: { ...intake, sections: next },
    packet: null,
  }
}

function finalizeIntake(
  intake: PacketIntake,
  beliefs: ModularBeliefs,
): IntakeApplyResult {
  if (intake.status !== 'assembling') {
    return reject('malformed', 'There is no open packet batch to finalize.')
  }
  return acceptRaw(
    {
      schemaVersion: 1,
      horizon: intake.horizon,
      sources: intake.sources,
      sections: intake.sections,
    },
    beliefs,
  )
}

function importJson(text: string, beliefs: ModularBeliefs): IntakeApplyResult {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return reject('malformed', 'Paste a ReadingPacketV1 JSON object.')
  }
  if (new TextEncoder().encode(trimmed).length > PACKET_BOUNDS.maxSerializedBytes) {
    return reject(
      'over_limit',
      `A transport batch accepts at most ${PACKET_BOUNDS.maxSerializedBytes} serialized bytes.`,
    )
  }
  let raw: unknown
  try {
    raw = JSON.parse(trimmed) as unknown
  } catch {
    return reject('malformed', 'That text is not valid JSON.')
  }
  if (!isRecord(raw)) {
    return reject('malformed', 'ReadingPacketV1 must be a JSON object.')
  }
  if (typeof raw.op === 'string') {
    return reject(
      'malformed',
      'Manual import accepts a complete ReadingPacketV1 JSON object.',
    )
  }
  return acceptRaw(raw, beliefs)
}

function acceptRaw(
  raw: unknown,
  beliefs: ModularBeliefs,
): IntakeApplyResult {
  const admission = admitPacket(raw, { beliefs })
  if (admission.status === 'blocked') {
    return rejectFromBlocks(admission.blocks)
  }
  return {
    intake: {
      status: 'ready',
      packet: admission.packet,
      review: admission.review,
    },
    packet: admission.packet,
  }
}

function rejectFromBlocks(blocks: [IntakeBlock, ...IntakeBlock[]]): IntakeApplyResult {
  const incompatible = blocks.filter((block) => block.code === 'incompatible_section')
  if (incompatible.length > 0) {
    const reason = incompatible.map((block) => block.reason).join(' ')
    const remedy = incompatible.map((block) => block.remedy).join(' ')
    return reject('incompatible', `${reason} ${remedy}`)
  }
  const first = blocks[0]
  if (first.code === 'over_limit') {
    return reject('over_limit', first.reason)
  }
  return reject('malformed', first.reason)
}

function reject(code: IntakeRejectCode, reason: string): IntakeApplyResult {
  return { intake: { status: 'rejected', code, reason }, packet: null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
