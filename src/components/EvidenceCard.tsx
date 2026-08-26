import type { EvidenceCardView } from '../domain/synthesis.ts'

export function EvidenceCard({
  card,
  showCiting = false,
  headingId,
}: {
  card: EvidenceCardView
  showCiting?: boolean
  headingId?: string
}) {
  const heading = headingId ?? `evidence-${card.id}`
  return (
    <article className="evidence-card" aria-labelledby={heading}>
      <p className="evidence-id">{card.id}</p>
      <h4 id={heading}>{card.label}</h4>
      <p>{card.groundedNote}</p>
      <dl className="evidence-provenance">
        <div>
          <dt>Provenance method</dt>
          <dd>
            {card.method === 'local_fixture'
              ? 'local_fixture'
              : 'user_supplied_link'}
          </dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{card.provider}</dd>
        </div>
        <div>
          <dt>Retrieved at</dt>
          <dd>{card.retrievedAt}</dd>
        </div>
        <div>
          <dt>Live URL</dt>
          <dd>
            {card.url === null
              ? 'None. Fixture examples do not invent live links.'
              : card.url}
          </dd>
        </div>
      </dl>
      {showCiting ? (
        card.citingTitles.length === 0 ? (
          <p className="citing-sections-empty">No sections cite this evidence ID</p>
        ) : (
          <ul
            className="citing-sections"
            aria-label={`Sections citing ${card.id}`}
          >
            {card.citingTitles.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        )
      ) : null}
    </article>
  )
}
