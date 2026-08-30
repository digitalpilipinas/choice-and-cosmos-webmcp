import type { Dispatch } from 'react'
import type { AppAction } from '../domain/loop.ts'
import type { AppState } from '../domain/types.ts'
import { TOOL_CATALOG } from './catalog.ts'
import type { ModelContextLike } from './detect.ts'
import { runTool } from './tools.ts'

export interface ToolHost {
  getState: () => AppState
  dispatch: Dispatch<AppAction>
}

export async function registerCatalog(
  modelContext: ModelContextLike,
  host: ToolHost,
  signal?: AbortSignal,
): Promise<void> {
  for (const tool of TOOL_CATALOG) {
    if (signal?.aborted) {
      throw new DOMException('Agent tool registration was aborted.', 'AbortError')
    }
    await modelContext.registerTool(
      {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: tool.readOnlyHint,
          untrustedContentHint: tool.untrustedContentHint,
        },
        execute: async (input) => {
          const run = runTool(host.getState(), tool.name, input ?? {})
          for (const action of run.actions) {
            host.dispatch(action)
          }
          return run.result
        },
      },
      { signal },
    )
  }
}
