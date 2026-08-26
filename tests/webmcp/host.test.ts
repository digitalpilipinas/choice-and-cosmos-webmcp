import { describe, expect, it } from 'vitest'
import { appReducer, INITIAL_STATE, type AppAction } from '../../src/domain/loop.ts'
import type { AppState } from '../../src/domain/types.ts'
import type { ModelContextTool } from '../../src/webmcp/detect.ts'
import { registerCatalog } from '../../src/webmcp/host.ts'

function withFocus(focus = 'finish the draft'): AppState {
  return appReducer(INITIAL_STATE, {
    type: 'SET_PROFILE_FIELD',
    field: 'focusIntention',
    value: focus,
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
  it('lets inspect_evidence and draft_choice_plan see generate_forecast in the same turn', async () => {
    const host = createReducerHost(withFocus())
    const registered = new Map<string, ModelContextTool>()

    await registerCatalog(
      {
        registerTool: async (tool) => {
          registered.set(tool.name, tool)
        },
      },
      host,
    )

    const generate = registered.get('generate_forecast')
    const inspect = registered.get('inspect_evidence')
    const draft = registered.get('draft_choice_plan')
    if (
      generate === undefined ||
      inspect === undefined ||
      draft === undefined
    ) {
      throw new Error('expected generate, inspect, and draft tools')
    }

    const generated = await generate.execute({})
    expect(generated).toMatchObject({ ok: true, data: { generated: true } })

    const inspected = await inspect.execute({})
    expect(inspected).toMatchObject({ ok: true })

    const drafted = await draft.execute({
      action: 'add_step',
      title: 'one more check',
    })
    expect(drafted).toMatchObject({ ok: true })

    const custom = host.getState().plansByHorizon.daily?.steps.filter(
      (step) => step.origin === 'custom',
    )
    expect(custom).toEqual([
      expect.objectContaining({
        title: 'one more check',
        origin: 'custom',
      }),
    ])
    expect(custom?.[0]?.id).toEqual(custom?.[0]?.id)
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

    const generate = registered.get('generate_forecast')
    if (generate === undefined) {
      throw new Error('expected generate_forecast')
    }

    const generated = await generate.execute({})
    expect(generated).toMatchObject({ ok: true, data: { generated: true } })
    expect(host.getState().profile.focusIntention).toBe('user typed this')
    expect(host.getState().forecastsByHorizon.daily).not.toBeNull()
  })
})
