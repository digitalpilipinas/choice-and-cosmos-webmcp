import { describe, expect, it } from 'vitest'
import { appReducer, INITIAL_STATE, type AppAction } from '../../src/domain/loop.ts'
import type { AppState } from '../../src/domain/types.ts'
import type { ModelContextTool } from '../../src/webmcp/detect.ts'
import { registerCatalog } from '../../src/webmcp/host.ts'
import { SAMPLE_PACKET } from '../research/samplePacket.ts'
import { TOOL_NAMES } from '../../src/webmcp/catalog.ts'

function withFocus(focus = 'finish the draft'): AppState {
  return appReducer(INITIAL_STATE, {
    type: 'SET_PROFILE_FIELD',
    field: 'focusIntention',
    value: focus,
  })
}

function withBeliefs(): AppState {
  return appReducer(withFocus(), {
    type: 'SET_BELIEFS',
    beliefs: { western: { sun: 'leo' } },
  })
}

function createReducerHost(initial: AppState) {
  let live = initial
  return {
    getState: () => live,
    dispatch: (action: AppAction) => {
      live = appReducer(live, action)
    },
  }
}

describe('registered host execute', () => {
  it('lets packet submit and inspect_reading see the same reducer turn', async () => {
    const host = createReducerHost(withBeliefs())
    const registered = new Map<string, ModelContextTool>()

    await registerCatalog(
      {
        registerTool: async (tool) => {
          registered.set(tool.name, tool)
        },
      },
      host,
    )

    expect([...registered.keys()]).toEqual([...TOOL_NAMES])
    const submit = registered.get('submit_reading_packet')
    const inspect = registered.get('inspect_reading')
    if (submit === undefined || inspect === undefined) {
      throw new Error('expected submit and inspect tools')
    }

    await submit.execute({ op: 'begin', horizon: 'daily' })
    await submit.execute({ op: 'append_sources', sources: SAMPLE_PACKET.sources })
    await submit.execute({ op: 'append_content', content: SAMPLE_PACKET.sections })
    const finalized = await submit.execute({ op: 'finalize' })
    expect(finalized).toMatchObject({ ok: true, data: { adopted: false } })

    const inspected = await inspect.execute({})
    expect(inspected).toMatchObject({
      ok: true,
      data: { status: 'staged', horizon: 'daily' },
    })
    expect(host.getState().readingsByHorizon.daily).toBeNull()
  })

  it('sees a user profile edit in the next tool call without a React flush', async () => {
    const host = createReducerHost(INITIAL_STATE)
    const registered = new Map<string, ModelContextTool>()

    await registerCatalog(
      {
        registerTool: async (tool) => {
          registered.set(tool.name, tool)
        },
      },
      host,
    )

    host.dispatch({
      type: 'SET_PROFILE_FIELD',
      field: 'focusIntention',
      value: 'user typed this',
    })
    host.dispatch({
      type: 'SET_BELIEFS',
      beliefs: { western: { sun: 'virgo' } },
    })

    const status = registered.get('get_session_status')
    if (status === undefined) {
      throw new Error('expected get_session_status')
    }
    const result = await status.execute({})
    expect(result).toMatchObject({
      ok: true,
      data: { hasFocus: true, hasReading: false, fallback: null },
    })
    expect(host.getState().profile.focusIntention).toBe('user typed this')
  })

  it('adds proposed steps from the host without accepting them', async () => {
    const host = createReducerHost(withFocus())
    host.dispatch({ type: 'GENERATE_FORECAST' })
    const registered = new Map<string, ModelContextTool>()
    await registerCatalog(
      {
        registerTool: async (tool) => {
          registered.set(tool.name, tool)
        },
      },
      host,
    )
    const propose = registered.get('propose_choice_plan')
    if (propose === undefined) {
      throw new Error('expected propose_choice_plan')
    }
    const drafted = await propose.execute({ titles: ['one more check'] })
    expect(drafted).toMatchObject({
      ok: true,
      data: { proposed: ['one more check'], status: 'proposed' },
    })
    const custom = host.getState().plansByHorizon.daily?.steps.filter(
      (step) => step.origin === 'custom',
    )
    expect(custom).toEqual([
      expect.objectContaining({
        title: 'one more check',
        status: 'proposed',
        origin: 'custom',
      }),
    ])
    expect(custom?.[0]?.id).toEqual(expect.any(String))
    expect(custom?.[0]?.id.length).toBeGreaterThan(0)
  })
})
