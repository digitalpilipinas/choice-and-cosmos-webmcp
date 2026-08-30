import { useState, type ReactNode, type ToggleEvent } from 'react'
import { ChartFigure } from '../ChartFigure.tsx'
import { EvidenceCard } from '../EvidenceCard.tsx'
import { ForecastCockpit } from '../ForecastCockpit.tsx'
import { FreeWillBanner } from '../FreeWillBanner.tsx'
import { PacketImport } from '../research/PacketImport.tsx'
import { ResearchBriefPanel } from '../research/ResearchBriefPanel.tsx'
import type { SkippedLensCopy, StudioSection } from '../../domain/studioView.ts'
import type { StudioPhaseProps } from './phaseProps.ts'

export function CosmosPhase({ studio, dispatch }: StudioPhaseProps) {
  if (studio.reading.status === 'empty') {
    return (
      <section className="phase" aria-labelledby="cosmos-heading">
        <h2 id="cosmos-heading">Cosmos</h2>
        <p>{studio.reading.emptyBody}</p>
        <FreeWillBanner />
        <p className="research-notice">{studio.notices.research}</p>
        <ForecastCockpit cockpit={studio.cockpit} uncertainty={studio.uncertainty} />
        <ResearchBriefPanel brief={studio.brief} />
        <PacketImport {...studio.intake} dispatch={dispatch} fieldId="packet-json-cosmos" />
      </section>
    )
  }

  const reading = studio.reading
  return (
    <section className="phase cosmos-phase" aria-labelledby="cosmos-heading">
      <header className="phase-header">
        <h2 id="cosmos-heading">Cosmos</h2>
        <p>{reading.lede}</p>
        {reading.legacyBadge !== null ? (
          <p className="legacy-badge">{reading.legacyBadge}</p>
        ) : null}
      </header>
      <FreeWillBanner />
      <p className="research-notice">{studio.notices.research}</p>
      <ResearchBriefPanel brief={studio.brief} />
      <PacketImport {...studio.intake} dispatch={dispatch} fieldId="packet-json-cosmos" />
      <ForecastCockpit cockpit={studio.cockpit} uncertainty={studio.uncertainty} />
      {reading.charts.map((model) => (
        <ChartFigure key={model.id} model={model} />
      ))}
      <SkippedLenses items={reading.skippedLenses} />
      <div className="section-list">
        {reading.sections.map((section, index) => (
          <ReportBlock key={section.id} section={section} defaultOpen={index === 0} />
        ))}
      </div>
    </section>
  )
}

function ReportBlock({
  section,
  defaultOpen,
}: {
  section: StudioSection
  defaultOpen: boolean
}) {
  return (
    <ReportDetails defaultOpen={defaultOpen}>
      <summary>
        <span className="report-title">{section.title}</span>
        <span className="report-lens">{section.frameworkLabel}</span>
        <span className="framework-badge">{section.frameworkKindLabel}</span>
      </summary>
      <p className="claim-kind">{section.reflectiveHeading}</p>
      <p className="reading-prose">{section.reflection}</p>
      <p className="claim-kind">{section.groundedHeading}</p>
      {section.evidence.length === 0 ? (
        <p className="evidence-ids-empty">No evidence IDs cited</p>
      ) : (
        <ul
          className="source-cards"
          aria-label={`Evidence IDs for ${section.title}`}
        >
          {section.evidence.map((card) => (
            <li key={card.id}>
              <EvidenceCard
                card={card}
                headingId={`evidence-${section.id}-${card.id}`}
              />
            </li>
          ))}
        </ul>
      )}
    </ReportDetails>
  )
}

export function SkippedLenses({ items }: { items: SkippedLensCopy[] }) {
  if (items.length === 0) {
    return null
  }
  return (
    <article className="skipped-lenses" aria-labelledby="skipped-lenses-heading">
      <h3 id="skipped-lenses-heading">Skipped lenses</h3>
      <ul>
        {items.map((item) => (
          <li key={item.lens}>
            {item.lens}: {item.reason}
          </li>
        ))}
      </ul>
    </article>
  )
}

function ReportDetails({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <details
      className="report-section"
      open={open}
      onToggle={(event: ToggleEvent<HTMLDetailsElement>) => {
        setOpen(event.currentTarget.open)
      }}
    >
      {children}
    </details>
  )
}
