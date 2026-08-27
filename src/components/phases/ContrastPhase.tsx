import {
  CLAIM_KIND_LABEL,
  LIVE_RESEARCH_NOTICE,
  evidenceCards,
  horizonChart,
} from '../../domain/synthesis.ts'
import {
  COVERAGE_LEVEL_COPY,
  coverageLevel,
  currentForecast,
  forecastCockpit,
  uncertaintyFor,
} from '../../domain/selectors.ts'
import { HORIZON_BY_ID } from '../../fixtures/horizons.ts'
import { EvidenceCard } from '../EvidenceCard.tsx'
import { ForecastCockpit } from '../ForecastCockpit.tsx'
import { FreeWillBanner } from '../FreeWillBanner.tsx'
import { HorizonChart } from '../HorizonChart.tsx'
import { ContrastResearch } from '../research/ContrastResearch.tsx'
import { UncertaintyPanel } from '../UncertaintyPanel.tsx'
import type { PhaseProps } from './phaseProps.ts'

export function ContrastPhase({ state }: PhaseProps) {
  const forecast = currentForecast(state)
  const cockpit = forecastCockpit(state.horizon, state.profile, forecast)
  const uncertainty = uncertaintyFor(forecast)

  if (forecast === null) {
    return (
      <section className="phase" aria-labelledby="contrast-heading">
        <h2 id="contrast-heading">Contrast</h2>
        <p>No fixture evidence is in memory yet. Go back and open a report from Context.</p>
        <FreeWillBanner />
        <p className="research-notice">{LIVE_RESEARCH_NOTICE}</p>
        <ForecastCockpit cockpit={cockpit} uncertainty={uncertainty} />
        <UncertaintyPanel state={uncertainty} />
        <ContrastResearch
          key={`${state.horizon}:${state.profile.focusIntention}`}
          query={state.profile.focusIntention}
          horizon={state.horizon}
          blocked={state.confirmation.status === 'pending'}
        />
      </section>
    )
  }

  const { coverage } = forecast
  const level = coverageLevel(coverage)
  const horizon = HORIZON_BY_ID[forecast.horizon]
  const cards = evidenceCards(forecast)
  const chart = horizonChart(forecast)

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
      <p className="research-notice">{LIVE_RESEARCH_NOTICE}</p>
      <ForecastCockpit cockpit={cockpit} uncertainty={uncertainty} />
      <HorizonChart model={chart} />
      <UncertaintyPanel state={uncertainty} />

      <article className="coverage-card" aria-labelledby="coverage-heading">
        <h3 id="coverage-heading">Coverage summary</h3>
        <p className="coverage-mode">
          {coverage.mode === 'manual'
            ? 'Mode: manual. These are links you supplied. This preview did not fetch or search them.'
            : 'Mode: fixture example data, not live research. This preview never searched the internet.'}
        </p>
        <p className={`coverage-level coverage-level-${level}`}>
          {COVERAGE_LEVEL_COPY[level]}
        </p>
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
        <p>
          These counts are a coverage receipt so the preview cannot pretend it
          read the whole web. They are not a confidence score.
        </p>
      </article>

      <div className="contrast-split">
        <article aria-labelledby="evidence-shows-heading">
          <h3 id="evidence-shows-heading">What the grounded notes show</h3>
          <p className="claim-kind">{CLAIM_KIND_LABEL.grounded}</p>
          <p>
            Each card below is a labeled example invented for the {horizon.label}{' '}
            horizon. It records a pretend source, not a finding about your life.
          </p>
          <ul className="source-cards">
            {cards.map((card) => (
              <li key={card.id}>
                <EvidenceCard card={card} showCiting />
              </li>
            ))}
          </ul>
        </article>
        <article aria-labelledby="reflection-interprets-heading">
          <h3 id="reflection-interprets-heading">
            What the reflection interprets from it
          </h3>
          <p className="claim-kind">{CLAIM_KIND_LABEL.reflective}</p>
          <p>
            Cosmos turned those examples into metaphor. That turn is optional
            meaning-making, not a proof, and not a statement that anything will
            happen. You can reject the whole reading and still keep your focus
            intention.
          </p>
        </article>
      </div>
      <ContrastResearch
        key={`${state.horizon}:${state.profile.focusIntention}`}
        query={state.profile.focusIntention}
        horizon={state.horizon}
        blocked={state.confirmation.status === 'pending'}
      />
    </section>
  )
}
