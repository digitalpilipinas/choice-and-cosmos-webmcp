import { ChartFigure } from '../ChartFigure.tsx'
import { ForecastCockpit } from '../ForecastCockpit.tsx'
import { FreeWillBanner } from '../FreeWillBanner.tsx'
import { ContrastResearch } from '../research/ContrastResearch.tsx'
import { PacketImport } from '../research/PacketImport.tsx'
import { UncertaintyPanel } from '../UncertaintyPanel.tsx'
import { SkippedLenses } from './CosmosPhase.tsx'
import type { StudioPhaseProps } from './phaseProps.ts'

export function ContrastPhase({ studio, dispatch }: StudioPhaseProps) {
  if (studio.reading.status === 'empty') {
    return (
      <section className="phase" aria-labelledby="contrast-heading">
        <h2 id="contrast-heading">Contrast</h2>
        <p>{studio.reading.emptyBody}</p>
        <FreeWillBanner />
        <p className="research-notice">{studio.notices.research}</p>
        <ForecastCockpit cockpit={studio.cockpit} uncertainty={studio.uncertainty} />
        <UncertaintyPanel state={studio.uncertainty} />
        <PacketImport
          {...studio.intake}
          dispatch={dispatch}
          fieldId="packet-json-contrast"
        />
        <ContrastResearch intake={studio.intake} dispatch={dispatch} />
      </section>
    )
  }

  const reading = studio.reading
  const coverage = studio.coverage
  return (
    <section className="phase contrast-phase" aria-labelledby="contrast-heading">
      <header className="phase-header">
        <h2 id="contrast-heading">Contrast</h2>
        <p>
          Separate the grounded source notes from the reflective interpretation.
          Cosmos offered a reading. This page shows the provenance that reading
          leaned on, and how little of a source pool it used.
        </p>
      </header>
      <FreeWillBanner />
      <p className="research-notice">{studio.notices.research}</p>
      <ForecastCockpit cockpit={studio.cockpit} uncertainty={studio.uncertainty} />
      {reading.charts.map((model) => (
        <ChartFigure key={model.id} model={model} />
      ))}
      <UncertaintyPanel state={studio.uncertainty} />
      <SkippedLenses items={reading.skippedLenses} />

      {coverage !== null ? (
        <article className="coverage-card" aria-labelledby="coverage-heading">
          <h3 id="coverage-heading">{coverage.heading}</h3>
          <p className="coverage-mode">{coverage.modeCopy}</p>
          {coverage.levelCopy !== null ? (
            <p className="coverage-level">{coverage.levelCopy}</p>
          ) : null}
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
              <dt>Time window</dt>
              <dd>{coverage.timeWindowDescription}</dd>
            </div>
            <div>
              <dt>Why it stopped</dt>
              <dd>{coverage.stoppingReason}</dd>
            </div>
          </dl>
          <p>{coverage.notConfidenceNote}</p>
        </article>
      ) : null}

      <div className="contrast-split">
        <article aria-labelledby="evidence-shows-heading">
          <h3 id="evidence-shows-heading">What the grounded notes show</h3>
          <p className="claim-kind">{reading.sections[0]?.groundedHeading}</p>
          <p>
            Each card in the evidence rail is a labeled source for this horizon.
            Fixture examples do not invent live links. Adopted cards keep the
            https URL from the packet.
          </p>
        </article>
        <article aria-labelledby="reflection-interprets-heading">
          <h3 id="reflection-interprets-heading">
            What the reflection interprets from it
          </h3>
          <p className="claim-kind">{reading.sections[0]?.reflectiveHeading}</p>
          <p>
            Cosmos turned those sources into metaphor. That turn is optional
            meaning-making, not a proof, and not a statement that anything will
            happen. You can reject the whole reading and still keep your focus
            intention.
          </p>
        </article>
      </div>
      <PacketImport
        {...studio.intake}
        dispatch={dispatch}
        fieldId="packet-json-contrast"
      />
      <ContrastResearch intake={studio.intake} dispatch={dispatch} />
    </section>
  )
}
