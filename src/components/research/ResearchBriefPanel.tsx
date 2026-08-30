import { useState } from 'react'
import { agentPromptForBrief, type ExactResearchBrief } from '../../research/brief.ts'

export function ResearchBriefPanel({ brief }: { brief: ExactResearchBrief | null }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'shown'>('idle')
  if (brief === null) {
    return (
      <article className="research-panel" aria-labelledby="research-brief-heading">
        <h3 id="research-brief-heading">Research brief</h3>
        <p>
          Personalized research needs a focus and at least one self-supplied
          belief-system module. The app does not infer missing values.
        </p>
      </article>
    )
  }

  const prompt = agentPromptForBrief(brief)
  const preview = JSON.stringify(
    {
      schemaVersion: brief.schemaVersion,
      horizon: brief.horizon,
      focus: brief.focus,
      tone: brief.tone,
      cosmic: brief.cosmic,
      beliefs: brief.beliefs,
      requestedLenses: brief.requestedLenses,
      skippedLenses: brief.skippedLenses,
    },
    null,
    2,
  )

  return (
    <article className="research-panel" aria-labelledby="research-brief-heading">
      <h3 id="research-brief-heading">Research brief</h3>
      <p>
        This is the exact brief a compatible agent should research. It is not an
        exhaustive search request. Display names and birth data are omitted.
      </p>
      <pre
        className="research-model-text"
        tabIndex={0}
        aria-label="Exact research brief"
      >
        {preview}
      </pre>
      <button
        type="button"
        onClick={() => {
          void copyPrompt(prompt).then((result) => {
            setCopyState(result)
          })
        }}
      >
        Copy prompt for the agent
      </button>
      {copyState === 'copied' ? (
        <p role="status">Copied the agent prompt.</p>
      ) : null}
      {copyState === 'shown' ? (
        <div className="field">
          <p role="status">Select and copy the prompt below.</p>
          <label htmlFor="agent-prompt">Copy-to-agent prompt</label>
          <textarea id="agent-prompt" readOnly rows={8} value={prompt} />
        </div>
      ) : null}
    </article>
  )
}

async function copyPrompt(text: string): Promise<'copied' | 'shown'> {
  try {
    if (navigator.clipboard === undefined || typeof navigator.clipboard.writeText !== 'function') {
      return 'shown'
    }
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'shown'
  }
}
