import { describe, expect, it } from 'vitest'
import { PACKET_BOUNDS } from '../../src/domain/bounds.ts'
import { parseReadingPacketV1, serializedBytes } from '../../src/research/packet.ts'
import { SAMPLE_PACKET } from './samplePacket.ts'

const FILL_LENSES = ['energyOverview', 'decisionSupport', 'focusActionPlan'] as const

function withSources(count: number) {
  const sources = Array.from({ length: count }, (_, i) => ({
    ...SAMPLE_PACKET.sources[0],
    id: `ev_${i}`,
  }))
  return {
    ...SAMPLE_PACKET,
    sources,
    sections: [{ ...SAMPLE_PACKET.sections[0], evidenceIds: ['ev_0'] }],
  }
}

function withSections(count: number) {
  return {
    ...SAMPLE_PACKET,
    sections: Array.from({ length: count }, (_, i) => ({
      ...SAMPLE_PACKET.sections[0],
      id: FILL_LENSES[i],
      title: `Section ${i}`,
    })),
  }
}

function withTitle(title: string) {
  return {
    ...SAMPLE_PACKET,
    sources: [{ ...SAMPLE_PACKET.sources[0], title }],
  }
}

function paddedRaw(targetBytes: number): unknown {
  const emptyPad = serializedBytes({ ...SAMPLE_PACKET, pad: '' })
  const padLen = targetBytes - emptyPad
  return { ...SAMPLE_PACKET, pad: 'a'.repeat(padLen) }
}

describe('parseReadingPacketV1', () => {
  it('accepts a bounded https packet and derives domain', () => {
    const parsed = parseReadingPacketV1(SAMPLE_PACKET)
    expect(parsed).toMatchObject({
      schemaVersion: 1,
      horizon: 'daily',
      sources: [{ id: 'ev_sun_1', domain: 'example.com' }],
    })
  })

  it('rejects http, credentials, extra keys, and over-cap arrays', () => {
    expect(
      parseReadingPacketV1({
        ...SAMPLE_PACKET,
        sources: [{ ...SAMPLE_PACKET.sources[0], url: 'http://example.com/sun' }],
      }),
    ).toBeNull()
    expect(
      parseReadingPacketV1({
        ...SAMPLE_PACKET,
        sources: [
          {
            ...SAMPLE_PACKET.sources[0],
            url: 'https://user:pass@example.com/sun',
          },
        ],
      }),
    ).toBeNull()
    expect(parseReadingPacketV1({ ...SAMPLE_PACKET, birthDate: '1991-01-01' })).toBeNull()
    expect(parseReadingPacketV1(withSources(PACKET_BOUNDS.maxSources + 1))).toBeNull()
  })

  it('rejects javascript and data URLs', () => {
    expect(
      parseReadingPacketV1({
        ...SAMPLE_PACKET,
        sources: [
          {
            ...SAMPLE_PACKET.sources[0],
            url: 'javascript:alert(1)',
          },
        ],
      }),
    ).toBeNull()
    expect(
      parseReadingPacketV1({
        ...SAMPLE_PACKET,
        sources: [
          {
            ...SAMPLE_PACKET.sources[0],
            url: 'data:text/html,hi',
          },
        ],
      }),
    ).toBeNull()
  })

  it('rejects evidence ids that do not match a source', () => {
    expect(
      parseReadingPacketV1({
        ...SAMPLE_PACKET,
        sections: [{ ...SAMPLE_PACKET.sections[0], evidenceIds: ['missing'] }],
      }),
    ).toBeNull()
  })

  it('accepts array counts at the cap and rejects the first value over', () => {
    expect(parseReadingPacketV1(withSources(PACKET_BOUNDS.maxSources))).not.toBeNull()
    expect(parseReadingPacketV1(withSources(PACKET_BOUNDS.maxSources + 1))).toBeNull()
    expect(parseReadingPacketV1(withSections(PACKET_BOUNDS.maxSections))).not.toBeNull()
    expect(parseReadingPacketV1(withSections(PACKET_BOUNDS.maxSections + 1))).toBeNull()
  })

  it('accepts a source title at the cap and rejects the first character over', () => {
    expect(parseReadingPacketV1(withTitle('a'.repeat(PACKET_BOUNDS.source.title)))).not.toBeNull()
    expect(
      parseReadingPacketV1(withTitle('a'.repeat(PACKET_BOUNDS.source.title + 1))),
    ).toBeNull()
  })

  it('accepts serialized size at the cap and rejects the first byte over', () => {
    const atLimit = paddedRaw(PACKET_BOUNDS.maxSerializedBytes)
    const overLimit = paddedRaw(PACKET_BOUNDS.maxSerializedBytes + 1)
    expect(serializedBytes(atLimit)).toBe(PACKET_BOUNDS.maxSerializedBytes)
    expect(serializedBytes(overLimit)).toBe(PACKET_BOUNDS.maxSerializedBytes + 1)
    expect(serializedBytes(SAMPLE_PACKET)).toBeLessThanOrEqual(PACKET_BOUNDS.maxSerializedBytes)
    expect(parseReadingPacketV1(SAMPLE_PACKET)).not.toBeNull()
    expect(parseReadingPacketV1(atLimit)).toBeNull()
    expect(parseReadingPacketV1(overLimit)).toBeNull()
  })
})
