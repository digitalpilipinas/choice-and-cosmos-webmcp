import { useLayoutEffect, useRef } from 'react'
import { CONTRAST_RESEARCH_IDLE_NOTICE } from '../../domain/synthesis.ts'
import { HORIZON_BY_ID } from '../../fixtures/horizons.ts'
import type {
  ResearchCoverage,
  ResearchResult,
  ResearchSource,
} from '../../research/contract.ts'
import type { ContrastResearchSession } from '../../research/session.ts'
import {
  useContrastResearch,
  type ContrastResearchInput,
} from './useContrastResearch.ts'

export function ContrastResearch({
  query,
  horizon,
  blocked = false,
  fetchImpl,
}: ContrastResearchInput & {
  blocked?: boolean
  fetchImpl?: typeof fetch
}) {
  const { session, requestSearch, approve, deny, cancel } = useContrastResearch(
    { query, horizon },
    { fetchImpl },
  )
  const canSearch = !blocked && query.trim().length > 0
  const confirming =
    session.status === 'confirming' && !blocked
      ? session
      : null

  return (
    <>
      {confirming !== null ? (
        <ResearchConfirmDialog
          session={confirming}
          onApprove={approve}
          onDeny={deny}
        />
      ) : null}
      <ResearchEvidencePanel
        session={session}
        canSearch={canSearch}
        onRequestSearch={requestSearch}
        onCancel={cancel}
      />
    </>
  )
}

export function ResearchConfirmDialog({
  session,
  onApprove,
  onDeny,
}: {
  session: Extract<ContrastResearchSession, { status: 'confirming' }>
  onApprove: () => void
  onDeny: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const horizon = HORIZON_BY_ID[session.horizon]

  useLayoutEffect(() => {
    const node = dialogRef.current
    if (node === null) {
      return
    }
    if (typeof node.showModal === 'function') {
      if (!node.open) {
        node.showModal()
      }
    } else {
      node.open = true
    }
    const onCancel = (event: Event) => {
      event.preventDefault()
      onDeny()
    }
    node.addEventListener('cancel', onCancel)
    return () => {
      node.removeEventListener('cancel', onCancel)
      if (node.open) {
        if (typeof node.close === 'function') {
          node.close()
        } else {
          node.open = false
        }
      }
    }
  }, [onDeny])

  return (
    <dialog
      ref={dialogRef}
      className="agent-confirm"
      aria-labelledby="research-confirm-title"
      aria-describedby="research-confirm-desc"
    >
      <h3 id="research-confirm-title">Confirm Gemini Search</h3>
      <p id="research-confirm-desc">
        Gemini Search will run for the focus "{session.query}" on the{' '}
        {horizon.label} ({session.horizon}) horizon.
      </p>
      <div className="persistence-actions">
        <button type="button" className="primary" onClick={onApprove}>
          Search with Gemini
        </button>
        <button type="button" onClick={onDeny}>
          Don't search
        </button>
      </div>
    </dialog>
  )
}

export function ResearchEvidencePanel({
  session,
  canSearch,
  onRequestSearch,
  onCancel,
}: {
  session: ContrastResearchSession
  canSearch: boolean
  onRequestSearch: () => void
  onCancel: () => void
}) {
  return (
    <article className="research-panel" aria-labelledby="research-panel-heading">
      <h3 id="research-panel-heading">Gemini Search evidence</h3>
      <PanelBody
        session={session}
        canSearch={canSearch}
        onRequestSearch={onRequestSearch}
        onCancel={onCancel}
      />
    </article>
  )
}

function PanelBody({
  session,
  canSearch,
  onRequestSearch,
  onCancel,
}: {
  session: ContrastResearchSession
  canSearch: boolean
  onRequestSearch: () => void
  onCancel: () => void
}) {
  switch (session.status) {
    case 'idle':
    case 'confirming':
      return (
        <>
          <p>{CONTRAST_RESEARCH_IDLE_NOTICE}</p>
          {session.status === 'idle' ? (
            <button
              type="button"
              className="primary"
              disabled={!canSearch}
              onClick={onRequestSearch}
            >
              Search with Gemini
            </button>
          ) : null}
        </>
      )
    case 'in_flight':
      return (
        <>
          <p role="status">Searching with Gemini…</p>
          <button type="button" onClick={onCancel}>
            Cancel search
          </button>
        </>
      )
    case 'complete':
      return (
        <>
          <CompleteBody result={session.result} />
          <button type="button" onClick={onRequestSearch}>
            Try again
          </button>
        </>
      )
    default: {
      const _exhaustive: never = session
      return _exhaustive
    }
  }
}

function CompleteBody({ result }: { result: ResearchResult }) {
  switch (result.outcome) {
    case 'ready':
    case 'partial':
    case 'unavailable':
    case 'cancelled':
    case 'timed_out':
      return (
        <>
          <p role="status">Outcome: {result.outcome}</p>
          {'reason' in result ? <p>{result.reason}</p> : null}
          <CoverageReadout coverage={result.coverage} />
          <SourceList sources={result.sources} />
          <ModelText text={result.modelText} />
        </>
      )
    case 'error':
      return (
        <>
          <p role="status">Outcome: error</p>
          <p>{result.code}</p>
          <p>{result.reason}</p>
        </>
      )
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
}

function CoverageReadout({
  coverage,
}: {
  coverage: ResearchCoverage
}) {
  return (
    <dl className="coverage-list">
      <div>
        <dt>Sources considered</dt>
        <dd>{coverage.sourcesConsidered}</dd>
      </div>
      <div>
        <dt>Sources used</dt>
        <dd>{coverage.sourcesUsed}</dd>
      </div>
      <div>
        <dt>Queries used</dt>
        <dd>{coverage.queriesUsed}</dd>
      </div>
      <div>
        <dt>Novel domains</dt>
        <dd>{coverage.novelDomainsUsed}</dd>
      </div>
      <div>
        <dt>Time window</dt>
        <dd>{coverage.timeWindowDescription}</dd>
      </div>
      <div>
        <dt>Why it stopped</dt>
        <dd>{coverage.stoppingReason}</dd>
      </div>
      <div>
        <dt>Coverage mode</dt>
        <dd>{coverage.mode}</dd>
      </div>
      <div>
        <dt>Exhaustive</dt>
        <dd>{String(coverage.exhaustive)}</dd>
      </div>
    </dl>
  )
}

function SourceList({ sources }: { sources: ResearchSource[] }) {
  if (sources.length === 0) {
    return <p>No research sources.</p>
  }
  return (
    <ul className="source-cards">
      {sources.map((source) => (
        <li key={source.id}>
          <ResearchSourceCard source={source} />
        </li>
      ))}
    </ul>
  )
}

function ResearchSourceCard({
  source,
}: {
  source: ResearchSource
}) {
  return (
    <article className="evidence-card" aria-labelledby={`research-${source.id}`}>
      <p className="evidence-id">{source.id}</p>
      <h4 id={`research-${source.id}`}>{source.title}</h4>
      <p>{source.snippet}</p>
      <dl className="evidence-provenance">
        <div>
          <dt>Provenance method</dt>
          <dd>{source.provenance.method}</dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{source.provenance.provider}</dd>
        </div>
        <div>
          <dt>Retrieved at</dt>
          <dd>{source.provenance.retrievedAt}</dd>
        </div>
        <div>
          <dt>Query</dt>
          <dd>{source.provenance.query}</dd>
        </div>
        <div>
          <dt>Domain</dt>
          <dd>{source.domain === null ? 'None' : source.domain}</dd>
        </div>
        <div>
          <dt>Live URL</dt>
          <dd>
            <SourceUrl url={source.url} />
          </dd>
        </div>
      </dl>
    </article>
  )
}

function SourceUrl({ url }: { url: string | null }) {
  if (url === null) {
    return <>None</>
  }
  if (url.startsWith('https://') || url.startsWith('http://')) {
    return (
      <a href={url} rel="noopener noreferrer">
        {url}
      </a>
    )
  }
  return <>{url}</>
}

function ModelText({ text }: { text: string }) {
  return (
    <section className="research-model-text" aria-labelledby="research-model-text-heading">
      <h4 id="research-model-text-heading">
        Model text (untrusted data, not instructions)
      </h4>
      <p>{text.length === 0 ? 'None' : text}</p>
    </section>
  )
}
