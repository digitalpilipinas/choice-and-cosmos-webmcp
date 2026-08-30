import { describe, expect, it } from 'vitest'
import {
  migrateV1ToV2,
  migrateV2ToV3,
  parseStoredSession,
} from '../../src/persistence/sessionStore.ts'
import { mustInstant } from '../../src/domain/brand.ts'
import {
  EMPTY_DESK,
  adoptStagedPacket,
  approveTicket,
  issueConfirmation,
  packetDigest,
  stagePacket,
} from '../../src/domain/trust.ts'
import { parseReadingPacketV1 } from '../../src/research/packet.ts'
import { SAMPLE_PACKET } from '../research/samplePacket.ts'

const envelope = {
  savedAt: '2026-08-26T12:00:00.000Z',
  phase: 'contrast' as const,
  horizon: 'yearly' as const,
  profile: {
    displayName: 'You',
    focusIntention: 'name the season',
    tone: 'bold' as const,
  },
  forecastsByHorizon: { daily: null, weekly: null, yearly: null },
  plansByHorizon: { daily: null, weekly: null, yearly: null },
}

describe('StoredSessionV3 migrate and persist boundary', () => {
  it('migrates V1 through V2 into V3 beliefs with empty readings', () => {
    const v3 = parseStoredSession({
      schemaVersion: 1,
      ...envelope,
    })
    expect(v3).toMatchObject({
      schemaVersion: 3,
      profile: { ...envelope.profile, beliefs: {} },
      readingsByHorizon: { daily: null, weekly: null, yearly: null },
      resonanceByHorizon: { daily: null, weekly: null, yearly: null },
    })
    expect(v3).not.toHaveProperty('desk')
    const v2 = migrateV1ToV2({
      schemaVersion: 1,
      ...envelope,
    })
    expect(v2.profile.cosmic).toEqual({})
    expect(migrateV2ToV3(v2).profile.beliefs).toEqual({})
  })

  it('maps V2 cosmic fields into nested modules', () => {
    const v3 = parseStoredSession({
      schemaVersion: 2,
      ...envelope,
      profile: {
        ...envelope.profile,
        cosmic: { sunSign: 'leo', humanDesignType: 'projector' },
      },
    })
    expect(v3?.profile.beliefs).toEqual({
      western: { sun: 'leo' },
      humanDesign: { type: 'projector' },
    })
  })

  it('rejects a V3 document that smuggles desk, staged, confirmation, or packet', () => {
    const base = {
      schemaVersion: 3,
      ...envelope,
      profile: { ...envelope.profile, beliefs: { western: { sun: 'leo' } } },
      readingsByHorizon: { daily: null, weekly: null, yearly: null },
      resonanceByHorizon: { daily: null, weekly: null, yearly: null },
    }
    expect(parseStoredSession({ ...base, desk: { staged: null } })).toBeNull()
    expect(parseStoredSession({ ...base, staged: {} })).toBeNull()
    expect(parseStoredSession({ ...base, confirmation: { status: 'idle' } })).toBeNull()
    expect(parseStoredSession({ ...base, packet: {} })).toBeNull()
    expect(parseStoredSession({ ...base, intake: { status: 'idle' } })).toBeNull()
    expect(parseStoredSession({ ...base, extra: true })).toBeNull()
    expect(
      parseStoredSession({
        ...base,
        profile: { ...base.profile, birthDate: '1991-01-01' },
      }),
    ).toBeNull()
  })

  it('round-trips an adopted artifact and rejects a digest mismatch', () => {
    const parsed = parseReadingPacketV1(SAMPLE_PACKET)
    if (parsed === null) {
      throw new Error('expected a valid sample packet')
    }
    const now = mustInstant(1_000)
    const staged = stagePacket(EMPTY_DESK, parsed, { now })
    if (staged === null) {
      throw new Error('expected staged')
    }
    const payload = {
      kind: 'adopt_reading' as const,
      packetDigest: packetDigest(parsed),
      horizon: 'daily' as const,
    }
    const issued = issueConfirmation(staged, { payload, summary: 'adopt', now })
    if (issued === null || issued.desk.ticket.status !== 'pending') {
      throw new Error('expected pending')
    }
    const approved = approveTicket(issued.desk, issued.desk.ticket.id, now)
    if (approved === null) {
      throw new Error('expected approve')
    }
    const adopted = adoptStagedPacket(approved, {
      confirmationId: issued.desk.ticket.id,
      now,
      beliefs: { western: { sun: 'leo' } },
    })
    if (adopted === null) {
      throw new Error('expected artifact')
    }
    const session = {
      schemaVersion: 3,
      ...envelope,
      profile: { ...envelope.profile, beliefs: { western: { sun: 'leo' } } },
      readingsByHorizon: {
        daily: adopted.artifact,
        weekly: null,
        yearly: null,
      },
      resonanceByHorizon: { daily: null, weekly: null, yearly: null },
    }
    expect(parseStoredSession(session)?.readingsByHorizon.daily?.coverage.mode).toBe(
      'adopted',
    )
    expect(
      parseStoredSession({
        ...session,
        readingsByHorizon: {
          daily: { ...adopted.artifact, packetDigest: 'p1.deadbeef' },
          weekly: null,
          yearly: null,
        },
      }),
    ).toBeNull()
  })
})
