import type { StudioEvidenceCard } from '../domain/studioView.ts'

export function EvidenceCard({
  card,
  showCiting = false,
  headingId,
}: {
  card: StudioEvidenceCard
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
          <dd>{card.methodLabel}</dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{card.providerLabel}</dd>
        </div>
        <div>
          <dt>Retrieved at</dt>
          <dd>{card.retrievedAt ?? 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Live URL</dt>
          <dd>
            {card.url === null ? (
              card.urlLabel
            ) : (
              <a href={card.url} rel="noreferrer">
                {card.urlLabel}
              </a>
            )}
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
