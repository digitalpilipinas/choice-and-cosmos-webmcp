export const AGENT_UNAVAILABLE_REASON =
  'This browser does not expose document.modelContext.registerTool. The loop still works by hand, including structured ReadingPacketV1 import. Agent tools did not run.'

export const AGENT_REGISTER_FAILED_REASON =
  'This browser could not finish registering agent tools. The loop still works by hand, including structured ReadingPacketV1 import. Agent tools did not run.'

export interface ModelContextTool {
  name: string
  title?: string
  description: string
  inputSchema?: object
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }
  execute: (
    input: Record<string, unknown>,
    extras?: { signal?: AbortSignal },
  ) => Promise<unknown>
}

export interface ModelContextLike {
  registerTool: (
    tool: ModelContextTool,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>
}

export type DetectedModelContext =
  | { kind: 'ready'; modelContext: ModelContextLike }
  | { kind: 'unavailable'; reason: string }

export function detectModelContext(source: unknown): DetectedModelContext {
  if (source === null || typeof source !== 'object') {
    return { kind: 'unavailable', reason: AGENT_UNAVAILABLE_REASON }
  }

  const candidate =
    'modelContext' in source ? source.modelContext : undefined
  if (
    candidate !== null &&
    typeof candidate === 'object' &&
    'registerTool' in candidate &&
    typeof candidate.registerTool === 'function'
  ) {
    return {
      kind: 'ready',
      modelContext: candidate as ModelContextLike,
    }
  }

  return { kind: 'unavailable', reason: AGENT_UNAVAILABLE_REASON }
}
