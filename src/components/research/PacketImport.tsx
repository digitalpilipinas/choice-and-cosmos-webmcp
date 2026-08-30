import { useState, type Dispatch } from 'react'
import { mustInstant } from '../../domain/brand.ts'
import type { AppAction } from '../../domain/loop.ts'
import type { StudioIntake } from '../../domain/studioView.ts'
import { PacketReviewCard } from './PacketReviewCard.tsx'

export function PacketImport({
  dispatch,
  fieldId = 'packet-json',
  ...intake
}: StudioIntake & {
  dispatch: Dispatch<AppAction>
  fieldId?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const error = intake.status === 'rejected' ? intake.reason : null
  const showForm = expanded || intake.status !== 'idle'
  const headingId = `${fieldId}-heading`

  return (
    <article className="research-panel" aria-labelledby={headingId}>
      <h3 id={headingId}>Import a reading packet</h3>
      <p>
        Paste a complete ReadingPacketV1 JSON object. Import uses the same
        validator later WebMCP tools will call. A packet is only staged in
        memory. It is not adopted until you confirm it.
      </p>
      {showForm ? (
        <PacketImportForm
          fieldId={fieldId}
          intake={intake}
          draftError={error}
          dispatch={dispatch}
        />
      ) : (
        <button type="button" onClick={() => setExpanded(true)}>
          Paste ReadingPacketV1 JSON
        </button>
      )}
    </article>
  )
}

function PacketImportForm({
  fieldId,
  intake,
  draftError,
  dispatch,
}: {
  fieldId: string
  intake: StudioIntake
  draftError: string | null
  dispatch: Dispatch<AppAction>
}) {
  const [draft, setDraft] = useState('')
  return (
    <>
      <dl className="coverage-list">
        <div>
          <dt>Batch sources</dt>
          <dd>
            {intake.progress.sources} / {intake.progress.maxSources}
          </dd>
        </div>
        <div>
          <dt>Batch sections</dt>
          <dd>
            {intake.progress.sections} / {intake.progress.maxSections}
          </dd>
        </div>
      </dl>
      <div className="field">
        <label htmlFor={fieldId}>ReadingPacketV1 JSON</label>
        <textarea
          id={fieldId}
          name="packetJson"
          rows={6}
          value={draft}
          disabled={intake.blocked}
          onChange={(event) => setDraft(event.target.value)}
          placeholder='{"schemaVersion":1,"horizon":"daily","sources":[],"sections":[]}'
        />
      </div>
      <div className="persistence-actions">
        <button
          type="button"
          className="primary"
          disabled={intake.blocked || draft.trim().length === 0}
          onClick={() =>
            dispatch({
              type: 'INTAKE_IMPORT_JSON',
              text: draft,
              now: mustInstant(Date.now()),
            })
          }
        >
          Review pasted packet
        </button>
        <button
          type="button"
          disabled={intake.blocked || intake.status === 'idle'}
          onClick={() => dispatch({ type: 'INTAKE_CANCEL' })}
        >
          Cancel this packet
        </button>
      </div>
      <p>
        Open batches also accept begin, append sources, append sections, and
        finalize through the shared coordinator. Horizon for a new batch is{' '}
        {intake.horizon}.
      </p>
      {draftError !== null ? <p role="alert">{draftError}</p> : null}
      {intake.status === 'ready' ? (
        <>
          <p role="status">
            Packet staged for review. It expires in 30 minutes and is not saved
            until you adopt it.
          </p>
          <PacketReviewCard review={intake.review} />
        </>
      ) : null}
      {intake.status === 'adopted' ? (
        <p role="status">
          This packet was adopted. It is the canonical reading for its horizon.
        </p>
      ) : null}
    </>
  )
}
