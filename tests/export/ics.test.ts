import { describe, expect, it } from 'vitest'
import { ICS_EVENT_CAPS } from '../../src/domain/bounds.ts'
import { mustInstant } from '../../src/domain/brand.ts'
import type { ChoiceStep, ChoiceStepStatus, HorizonId } from '../../src/domain/types.ts'
import { packetDigest, skippedLensesFor } from '../../src/domain/trust.ts'
import {
  buildCalendar,
  icsUid,
  serializeCalendar,
} from '../../src/export/ics.ts'
import { parseReadingPacketV1, type ReadingPacketV1 } from '../../src/research/packet.ts'
import { SAMPLE_PACKET } from '../research/samplePacket.ts'

const ADOPTED_AT = mustInstant(Date.parse('2026-08-29T12:00:00.000Z'))

function parsed(horizon: HorizonId): ReadingPacketV1 {
  const packet = parseReadingPacketV1({ ...SAMPLE_PACKET, horizon })
  if (packet === null) {
    throw new Error('expected a valid packet')
  }
  return packet
}

function artifact(horizon: HorizonId = 'daily') {
  const packet = parsed(horizon)
  return {
    horizon: packet.horizon,
    adoptedAt: ADOPTED_AT,
    packetDigest: packetDigest(packet),
    sources: packet.sources,
    sections: packet.sections,
    coverage: {
      sourcesConsidered: packet.sources.length,
      sourcesUsed: packet.sources.length,
      timeWindowDescription: 'Adopted from a reviewed reading packet.',
      stoppingReason: 'The person adopted this packet. It is not an exhaustive search.',
      mode: 'adopted' as const,
      exhaustive: false as const,
    },
    skippedLenses: skippedLensesFor(packet, {}),
  }
}

function step(id: string, status: ChoiceStepStatus = 'accepted'): ChoiceStep {
  return {
    id,
    title: `Keep ${id} moving`,
    rationale: 'A reversible move.',
    status,
    userNote: '',
    origin: 'custom',
  }
}

function selection(
  stepId: string,
  input: { startDate?: string; timeOfDay?: string; timeZone?: string } = {},
) {
  return {
    stepId,
    startDate: input.startDate ?? '2026-09-02',
    timeOfDay: input.timeOfDay ?? '09:30',
    timeZone: input.timeZone ?? 'Asia/Singapore',
  }
}

function unfold(text: string): string {
  return text.replace(/\r\n[ \t]/g, '')
}

describe('buildCalendar', () => {
  it('refuses when there is no adopted artifact', () => {
    const result = buildCalendar({
      artifact: null,
      accepted: [step('walk')],
      selections: [selection('walk')],
    })
    expect(result).toEqual({
      ok: false,
      code: 'not_adopted',
      reason: 'Calendar download is only for an adopted reading.',
    })
  })

  it('refuses a step that is not accepted', () => {
    const result = buildCalendar({
      artifact: artifact('daily'),
      accepted: [step('walk', 'proposed'), step('sit', 'dismissed')],
      selections: [selection('walk')],
    })
    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('expected refuse')
    }
    expect(result.code).toBe('unaccepted_step')
  })

  it('emits only accepted steps', () => {
    const result = buildCalendar({
      artifact: artifact('weekly'),
      accepted: [step('walk'), step('skip', 'proposed')],
      selections: [selection('walk')],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('expected a calendar')
    }
    expect(result.plan.events.map((event) => event.stepId)).toEqual(['walk'])
  })

  it.each([
    ['daily', ICS_EVENT_CAPS.daily],
    ['weekly', ICS_EVENT_CAPS.weekly],
    ['yearly', ICS_EVENT_CAPS.yearly],
  ] as const)('allows %s cap of %i events', (horizon, cap) => {
    const accepted = Array.from({ length: cap }, (_, index) => step(`s${String(index)}`))
    const result = buildCalendar({
      artifact: artifact(horizon),
      accepted,
      selections: accepted.map((item) => selection(item.id)),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('expected a calendar')
    }
    expect(result.plan.events).toHaveLength(cap)
    expect(result.plan.cap).toBe(cap)
  })

  it.each([
    ['daily', ICS_EVENT_CAPS.daily],
    ['weekly', ICS_EVENT_CAPS.weekly],
    ['yearly', ICS_EVENT_CAPS.yearly],
  ] as const)('refuses one event over the %s cap of %i', (horizon, cap) => {
    const accepted = Array.from({ length: cap + 1 }, (_, index) =>
      step(`s${String(index)}`),
    )
    const result = buildCalendar({
      artifact: artifact(horizon),
      accepted,
      selections: accepted.map((item) => selection(item.id)),
    })
    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('expected refuse')
    }
    expect(result.code).toBe('over_horizon_cap')
  })

  it('keeps a stable UID from digest, horizon, and step', () => {
    const reading = artifact('weekly')
    const first = buildCalendar({
      artifact: reading,
      accepted: [step('walk')],
      selections: [selection('walk')],
    })
    const second = buildCalendar({
      artifact: reading,
      accepted: [step('walk')],
      selections: [selection('walk')],
    })
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) {
      throw new Error('expected calendars')
    }
    const uid = icsUid({
      packetDigest: reading.packetDigest,
      horizon: 'weekly',
      stepId: 'walk',
    })
    expect(first.plan.events[0]?.uid).toBe(uid)
    expect(second.plan.events[0]?.uid).toBe(uid)
    expect(uid).toBe(`${reading.packetDigest}-weekly-walk@choice-and-cosmos.local`)
  })

  it('preserves the selected date, time, and timezone', () => {
    const result = buildCalendar({
      artifact: artifact('daily'),
      accepted: [step('walk')],
      selections: [
        selection('walk', {
          startDate: '2026-09-02',
          timeOfDay: '09:30',
          timeZone: 'Asia/Singapore',
        }),
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('expected a calendar')
    }
    const event = result.plan.events[0]
    expect(event?.startDate).toBe('2026-09-02')
    expect(event?.timeOfDay).toBe('09:30')
    expect(event?.timeZone).toBe('Asia/Singapore')
    expect(event?.localLabel).toContain('09:30')
    expect(event?.localLabel).toContain('Asia/Singapore')
    const text = serializeCalendar(result.plan)
    expect(text).toContain('TZID=Asia/Singapore:20260902T093000')
    expect(text).toContain('METHOD:PUBLISH')
    expect(text).not.toContain('ORGANIZER')
  })

  it('refuses an invalid civil time or timezone', () => {
    const reading = artifact('daily')
    const accepted = [step('walk')]
    expect(
      buildCalendar({
        artifact: reading,
        accepted,
        selections: [selection('walk', { startDate: '2026-02-30' })],
      }).ok,
    ).toBe(false)
    expect(
      buildCalendar({
        artifact: reading,
        accepted,
        selections: [selection('walk', { timeOfDay: '24:00' })],
      }).ok,
    ).toBe(false)
    expect(
      buildCalendar({
        artifact: reading,
        accepted,
        selections: [selection('walk', { timeZone: 'Not/AZone' })],
      }).ok,
    ).toBe(false)
  })

  it('stamps DTSTAMP from adoptedAt and folds long lines', () => {
    const reading = artifact('daily')
    const result = buildCalendar({
      artifact: reading,
      accepted: [step('walk')],
      selections: [selection('walk')],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('expected a calendar')
    }
    const first = serializeCalendar(result.plan)
    const second = serializeCalendar(result.plan)
    expect(first).toBe(second)
    expect(first).toContain('DTSTAMP:20260829T120000Z')
    expect(first.endsWith('\r\n')).toBe(true)
    const uid = result.plan.events[0]?.uid
    expect(uid).toEqual(expect.any(String))
    expect(unfold(first)).toContain(`UID:${uid ?? ''}`)
    for (const line of first.trimEnd().split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })
})
