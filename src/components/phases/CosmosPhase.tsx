import { useState, type ReactNode, type ToggleEvent } from 'react'
import {
  CLAIM_KIND_LABEL,
  LIVE_RESEARCH_NOTICE,
  cardsForSection,
  frameworkKind,
  frameworkKindLabel,
  horizonChart,
} from '../../domain/synthesis.ts'
import {
  currentForecast,
  forecastCockpit,
  uncertaintyFor,
} from '../../domain/selectors.ts'
import { HORIZON_BY_ID } from '../../fixtures/horizons.ts'
import { EvidenceCard } from '../EvidenceCard.tsx'
import { ForecastCockpit } from '../ForecastCockpit.tsx'
import { FreeWillBanner } from '../FreeWillBanner.tsx'
import { HorizonChart } from '../HorizonChart.tsx'
import type { PhaseProps } from './phaseProps.ts'

export function CosmosPhase({ state }: PhaseProps) {
  const forecast = currentForecast(state)
  const cockpit = forecastCockpit(state.horizon, state.profile, forecast)
  const uncertainty = uncertaintyFor(forecast)

  if (forecast === null) {
    return (
      <section className="phase" aria-labelledby="cosmos-heading">
        <h2 id="cosmos-heading">Cosmos</h2>
        <p>No fixture report is in memory yet. Go back and open one from Context.</p>
        <FreeWillBanner />
        <p className="research-notice">{LIVE_RESEARCH_NOTICE}</p>
        <ForecastCockpit cockpit={cockpit} uncertainty={uncertainty} />
      </section>
    )
  }

  const horizon = HORIZON_BY_ID[forecast.horizon]
  const chart = horizonChart(forecast)

  return (
    <section className="phase cosmos-phase" aria-labelledby="cosmos-heading">
      <header className="phase-header">
        <h2 id="cosmos-heading">Cosmos</h2>
        <p>
          An interpretive reading for {horizon.label} ({horizon.windowDescription}),
          held against &quot;{state.profile.focusIntention.trim()}&quot;. Every block
          below is a lens, not a result.
        </p>
      </header>
      <FreeWillBanner />
      <p className="research-notice">{LIVE_RESEARCH_NOTICE}</p>
      <ForecastCockpit cockpit={cockpit} uncertainty={uncertainty} />
      <HorizonChart model={chart} />
      <div className="section-list">
        {forecast.sections.map((section, index) => {
          const cards = cardsForSection(forecast, section)
          const kind = frameworkKind(section.id)
          return (
            <ReportDetails key={section.id} defaultOpen={index === 0}>
              <summary>
                <span className="report-title">{section.title}</span>
                <span className="report-lens">{section.frameworkLabel}</span>
                <span className="framework-badge">{frameworkKindLabel(kind)}</span>
              </summary>
              <p className="claim-kind">{CLAIM_KIND_LABEL.reflective}</p>
              <p>{section.reflection}</p>
              <p className="claim-kind">{CLAIM_KIND_LABEL.grounded}</p>
              {cards.length === 0 ? (
                <p className="evidence-ids-empty">No evidence IDs cited</p>
              ) : (
                <ul
                  className="source-cards"
                  aria-label={`Evidence IDs for ${section.title}`}
                >
                  {cards.map((card) => (
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
        })}
      </div>
    </section>
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
