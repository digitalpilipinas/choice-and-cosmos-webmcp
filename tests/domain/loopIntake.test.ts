import { describe, expect, it } from 'vitest'
import { STAGED_TTL_MS, mustInstant } from '../../src/domain/brand.ts'
import {
  INITIAL_STATE,
  appReducer,
  confirmationIdForPayload,
} from '../../src/domain/loop.ts'
import { packetDigest } from '../../src/domain/trust.ts'
import { parseReadingPacketV1 } from '../../src/research/packet.ts'
import { SAMPLE_PACKET } from '../research/samplePacket.ts'
import { runTool } from '../../src/webmcp/tools.ts'

function focused() {
  let state = appReducer(INITIAL_STATE, {
    type: 'SET_PROFILE_FIELD',
    field: 'focusIntention',
    value: 'protect one block of attention',
  })
  state = appReducer(state, {
    type: 'SET_BELIEFS',
    beliefs: { western: { sun: 'leo' } },
  })
  return state
}

function parsed() {
  const packet = parseReadingPacketV1(SAMPLE_PACKET)
  if (packet === null) {
    throw new Error('expected sample packet')
  }
  return packet
}

describe('intake reducer and human adoption', () => {
  it('stages a pasted packet without making it canonical', () => {
    const now = mustInstant(1_000)
    const state = appReducer(focused(), {
      type: 'INTAKE_IMPORT_JSON',
      text: JSON.stringify(SAMPLE_PACKET),
      now,
    })
    expect(state.desk.staged?.packet).toEqual(parsed())
    expect(state.readingsByHorizon.daily).toBeNull()
    expect(state.intake.status).toBe('ready')
  })

  it('adopts only after an approved confirmation', () => {
    const now = mustInstant(Date.now())
    let state = appReducer(focused(), {
      type: 'INTAKE_IMPORT_JSON',
      text: JSON.stringify(SAMPLE_PACKET),
      now,
    })
    state = appReducer(state, { type: 'REQUEST_ADOPT_STAGED', now })
    expect(state.confirmation.status).toBe('pending')
    expect(state.readingsByHorizon.daily).toBeNull()
    if (state.confirmation.status !== 'pending') {
      throw new Error('expected pending adopt')
    }
    const denied = appReducer(state, {
      type: 'DENY_CONFIRMATION',
      id: state.confirmation.id,
    })
    expect(denied.readingsByHorizon.daily).toBeNull()
    expect(denied.desk.staged).not.toBeNull()

    const approved = appReducer(state, {
      type: 'APPROVE_CONFIRMATION',
      id: state.confirmation.id,
    })
    expect(approved.readingsByHorizon.daily?.packetDigest).toBe(packetDigest(parsed()))
    expect(approved.readingsByHorizon.daily?.coverage.exhaustive).toBe(false)
    expect(approved.intake.status).toBe('adopted')
    expect(approved.desk.staged).toBeNull()
  })

  it('does not prune stored resonance when a packet is adopted', () => {
    const now = mustInstant(Date.now())
    let state = focused()
    state = {
      ...state,
      resonanceByHorizon: {
        daily: { energyOverview: 'resonates', numerology: 'unsure' },
        weekly: null,
        yearly: null,
      },
    }
    state = appReducer(state, {
      type: 'INTAKE_IMPORT_JSON',
      text: JSON.stringify(SAMPLE_PACKET),
      now,
    })
    state = appReducer(state, { type: 'REQUEST_ADOPT_STAGED', now })
    if (state.confirmation.status !== 'pending') {
      throw new Error('expected pending adopt')
    }
    const approved = appReducer(state, {
      type: 'APPROVE_CONFIRMATION',
      id: state.confirmation.id,
    })
    expect(approved.resonanceByHorizon.daily).toEqual({
      energyOverview: 'resonates',
      numerology: 'unsure',
    })
  })

  it('treats expiry and cancel as unsuccessful', () => {
    const now = mustInstant(1_000)
    let state = appReducer(focused(), {
      type: 'INTAKE_IMPORT_JSON',
      text: JSON.stringify(SAMPLE_PACKET),
      now,
    })
    const expired = appReducer(state, {
      type: 'REQUEST_ADOPT_STAGED',
      now: mustInstant(now + STAGED_TTL_MS),
    })
    expect(expired.readingsByHorizon.daily).toBeNull()
    expect(expired.intake).toMatchObject({ status: 'rejected', code: 'expired' })

    state = appReducer(state, { type: 'INTAKE_CANCEL' })
    expect(state.desk.staged).toBeNull()
    expect(state.intake).toMatchObject({ status: 'rejected', code: 'cancelled' })
  })

  it('clears a staged daily packet, adopt confirmation, and intake when switching to weekly', () => {
    const now = mustInstant(Date.now())
    let state = appReducer(focused(), {
      type: 'INTAKE_IMPORT_JSON',
      text: JSON.stringify(SAMPLE_PACKET),
      now,
    })
    state = appReducer(state, { type: 'REQUEST_ADOPT_STAGED', now })
    expect(state.intake.status).toBe('ready')
    expect(state.desk.staged).not.toBeNull()
    expect(state.confirmation.status).toBe('pending')

    state = appReducer(state, { type: 'SET_HORIZON', horizon: 'weekly' })
    expect(state.horizon).toBe('weekly')
    expect(state.intake).toEqual({ status: 'idle' })
    expect(state.desk.staged).toBeNull()
    expect(state.confirmation.status).toBe('idle')
    expect(state.readingsByHorizon.daily).toBeNull()
  })

  it('clears a staged weekly packet when switching to yearly', () => {
    const now = mustInstant(Date.now())
    let state = appReducer(focused(), { type: 'SET_HORIZON', horizon: 'weekly' })
    state = appReducer(state, {
      type: 'INTAKE_IMPORT_JSON',
      text: JSON.stringify({ ...SAMPLE_PACKET, horizon: 'weekly' }),
      now,
    })
    expect(state.intake.status).toBe('ready')
    expect(state.desk.staged?.packet.horizon).toBe('weekly')

    state = appReducer(state, { type: 'SET_HORIZON', horizon: 'yearly' })
    expect(state.horizon).toBe('yearly')
    expect(state.intake).toEqual({ status: 'idle' })
    expect(state.desk.staged).toBeNull()
    expect(state.confirmation.status).toBe('idle')
  })

  it('does not adopt from a confirmation id that is not bound to the staged digest', () => {
    const now = mustInstant(Date.now())
    let state = appReducer(focused(), {
      type: 'INTAKE_IMPORT_JSON',
      text: JSON.stringify(SAMPLE_PACKET),
      now,
    })
    state = appReducer(state, { type: 'REQUEST_ADOPT_STAGED', now })
    const foreign = confirmationIdForPayload({
      kind: 'adopt_reading',
      packetDigest: 'p1.dead' as never,
      horizon: 'daily',
    })
    const next = appReducer(state, { type: 'APPROVE_CONFIRMATION', id: foreign })
    expect(next.readingsByHorizon.daily).toBeNull()
    expect(next.confirmation.status).toBe('pending')
  })

  it('matches WebMCP packet submit with the same intake reducer', () => {
    const started = runTool(focused(), 'submit_reading_packet', {
      op: 'begin',
      horizon: 'daily',
    })
    const viaTool = started.actions.reduce(appReducer, focused())
    const viaReducer = appReducer(focused(), {
      type: 'INTAKE_BEGIN',
      horizon: 'daily',
    })
    expect(viaTool.intake).toEqual(viaReducer.intake)
    expect(viaTool.desk.staged).toEqual(viaReducer.desk.staged)
  })

  it('refuses a Chinese section on a Western-only profile and never adopts it', () => {
    const now = mustInstant(Date.now())
    const chinese = {
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
    }
    const state = appReducer(focused(), {
      type: 'INTAKE_IMPORT_JSON',
      text: JSON.stringify(chinese),
      now,
    })
    expect(state.intake.status).not.toBe('ready')
    expect(state.intake).toMatchObject({ status: 'rejected', code: 'incompatible' })
    expect(state.desk.staged).toBeNull()
    expect(state.readingsByHorizon.daily).toBeNull()
    const requested = appReducer(state, { type: 'REQUEST_ADOPT_STAGED', now })
    expect(requested.readingsByHorizon.daily).toBeNull()
  })
})
