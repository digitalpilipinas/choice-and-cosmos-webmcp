import { describe, expect, it } from 'vitest'
import { AGENT_UNAVAILABLE_REASON, detectModelContext } from '../../src/webmcp/detect.ts'

describe('detectModelContext', () => {
  it('reports unavailable when registerTool is missing', () => {
    expect(detectModelContext({})).toEqual({
      kind: 'unavailable',
      reason: AGENT_UNAVAILABLE_REASON,
    })
    expect(detectModelContext({ modelContext: {} })).toEqual({
      kind: 'unavailable',
      reason: AGENT_UNAVAILABLE_REASON,
    })
  })

  it('reports ready when registerTool exists', () => {
    const modelContext = { registerTool: async () => undefined }
    expect(detectModelContext({ modelContext })).toEqual({
      kind: 'ready',
      modelContext,
    })
  })
})
