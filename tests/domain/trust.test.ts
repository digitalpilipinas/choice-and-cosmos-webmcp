import { describe, expect, it } from 'vitest'
import { mustInstant, STAGED_TTL_MS } from '../../src/domain/brand.ts'
import {
  EMPTY_DESK,
  adoptStagedPacket,
  approveTicket,
  confirmationIdForPayload,
  consumeTicket,
  issueConfirmation,
  isStagedExpired,
  packetDigest,
  stagePacket,
} from '../../src/domain/trust.ts'
import { parseReadingPacketV1 } from '../../src/research/packet.ts'
import { SAMPLE_PACKET } from '../research/samplePacket.ts'

function packet() {
  const parsed = parseReadingPacketV1(SAMPLE_PACKET)
  if (parsed === null) {
    throw new Error('expected a valid sample packet')
  }
  return parsed
}

describe('digest-bound confirmations and staged expiry', () => {
  it('issues an adopt_reading id from the payload, not the packet digest', () => {
    const now = mustInstant(1_000)
    const staged = stagePacket(EMPTY_DESK, packet(), { now })
    if (staged === null) {
      throw new Error('expected a staged desk')
    }
    const digest = packetDigest(packet())
    expect(staged.staged?.digest).toBe(digest)
    const payload = {
      kind: 'adopt_reading' as const,
      packetDigest: digest,
      horizon: 'daily' as const,
    }
    const issued = issueConfirmation(staged, {
      payload,
      summary: 'Adopt this packet',
      now,
    })
    expect(issued?.desk.ticket.status).toBe('pending')
    if (issued?.desk.ticket.status !== 'pending') {
      throw new Error('expected pending')
    }
    expect(issued.desk.ticket.id).toBe(confirmationIdForPayload(payload))
    expect(issued.desk.ticket.id).not.toBe(digest)
  })

  it('refuses a digest mismatch and a replay after consume', () => {
    const now = mustInstant(1_000)
    const staged = stagePacket(EMPTY_DESK, packet(), { now })
    if (staged === null) {
      throw new Error('expected staged')
    }
    const payload = {
      kind: 'adopt_reading' as const,
      packetDigest: packetDigest(packet()),
      horizon: 'daily' as const,
    }
    const issued = issueConfirmation(staged, {
      payload: { ...payload, packetDigest: 'p1.dead' as typeof payload.packetDigest },
      summary: 'wrong digest',
      now,
    })
    expect(issued).toBeNull()

    const ok = issueConfirmation(staged, { payload, summary: 'adopt', now })
    if (ok === null || ok.desk.ticket.status !== 'pending') {
      throw new Error('expected pending adopt')
    }
    const approved = approveTicket(ok.desk, ok.desk.ticket.id, now)
    if (approved === null) {
      throw new Error('expected approve')
    }
    const first = adoptStagedPacket(approved, {
      confirmationId: ok.desk.ticket.id,
      now,
      beliefs: { western: { sun: 'leo' } },
    })
    expect(first?.artifact.horizon).toBe('daily')
    expect(first?.artifact.coverage.mode).toBe('adopted')
    const spent = consumeTicket(first?.desk ?? approved, ok.desk.ticket.id)
    expect(
      adoptStagedPacket(spent ?? first?.desk ?? approved, {
        confirmationId: ok.desk.ticket.id,
        now,
        beliefs: { western: { sun: 'leo' } },
      }),
    ).toBeNull()
  })

  it('treats staged expiry as exclusive at the TTL boundary', () => {
    const now = mustInstant(10_000)
    const staged = stagePacket(EMPTY_DESK, packet(), { now })
    if (staged === null || staged.staged === null) {
      throw new Error('expected staged packet')
    }
    const lastValid = mustInstant(now + STAGED_TTL_MS - 1)
    const atExpiry = mustInstant(now + STAGED_TTL_MS)
    const after = mustInstant(now + STAGED_TTL_MS + 1)
    expect(isStagedExpired(staged.staged, lastValid)).toBe(false)
    expect(isStagedExpired(staged.staged, atExpiry)).toBe(true)
    expect(isStagedExpired(staged.staged, after)).toBe(true)

    const payload = {
      kind: 'adopt_reading' as const,
      packetDigest: staged.staged.digest,
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
    expect(
      adoptStagedPacket(approved, {
        confirmationId: issued.desk.ticket.id,
        now: lastValid,
        beliefs: {},
      })?.artifact.horizon,
    ).toBe('daily')
    expect(
      adoptStagedPacket(approved, {
        confirmationId: issued.desk.ticket.id,
        now: atExpiry,
        beliefs: {},
      }),
    ).toBeNull()
  })

  it('returns null instead of copying a staged packet whose sections no longer match beliefs', () => {
    const chinese = parseReadingPacketV1({
      ...SAMPLE_PACKET,
      sections: [
        {
          id: 'chineseElemental',
          title: 'Element',
          frameworkLabel: 'Guide',
          reflection: 'Sit with metal.',
          evidenceIds: ['ev_sun_1'],
        },
      ],
    })
    if (chinese === null) {
      throw new Error('expected a valid chinese packet')
    }
    const now = mustInstant(1_000)
    const staged = stagePacket(EMPTY_DESK, chinese, { now })
    if (staged === null || staged.staged === null) {
      throw new Error('expected staged chinese packet')
    }
    const payload = {
      kind: 'adopt_reading' as const,
      packetDigest: staged.staged.digest,
      horizon: 'daily' as const,
    }
    const issued = issueConfirmation(staged, { payload, summary: 'adopt', now })
    if (issued === null || issued.desk.ticket.status !== 'pending') {
      throw new Error('expected pending adopt')
    }
    const approved = approveTicket(issued.desk, issued.desk.ticket.id, now)
    if (approved === null) {
      throw new Error('expected approve')
    }
    expect(
      adoptStagedPacket(approved, {
        confirmationId: issued.desk.ticket.id,
        now,
        beliefs: { western: { sun: 'leo' } },
      }),
    ).toBeNull()
    expect(
      adoptStagedPacket(approved, {
        confirmationId: issued.desk.ticket.id,
        now,
        beliefs: { chinese: { animal: 'horse', element: 'metal' } },
      })?.artifact.sections.map((section) => section.id),
    ).toEqual(['chineseElemental'])
  })
})
