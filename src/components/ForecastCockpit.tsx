import { UncertaintyPanel } from './UncertaintyPanel.tsx'
import type { StudioUncertainty } from '../domain/studioView.ts'
import type { ForecastCockpit as ForecastCockpitModel, HorizonId } from '../domain/types.ts'

export function ForecastCockpit({
  cockpit,
  uncertainty,
}: {
  cockpit: ForecastCockpitModel
  uncertainty: StudioUncertainty
}) {
  return (
    <article className="forecast-cockpit" aria-labelledby="forecast-cockpit-heading">
      <h3 id="forecast-cockpit-heading">Forecast cockpit</h3>
      <dl className="coverage-list">
        <div>
          <dt>Horizon</dt>
          <dd>{horizonIdLabel(cockpit.horizon)}</dd>
        </div>
        <div>
          <dt>Name</dt>
          <dd>{cockpit.name}</dd>
        </div>
        <div>
          <dt>Tagline</dt>
          <dd>{cockpit.tagline}</dd>
        </div>
        <div>
          <dt>Window</dt>
          <dd>{cockpit.windowDescription}</dd>
        </div>
        <div>
          <dt>Focus</dt>
          <dd>{cockpit.focusIntention.trim() || 'None written'}</dd>
        </div>
        <div>
          <dt>Generated at</dt>
          <dd>{cockpit.generatedAt ?? 'Not generated'}</dd>
        </div>
      </dl>
      <UncertaintyPanel state={uncertainty} compact />
    </article>
  )
}

function horizonIdLabel(horizon: HorizonId): string {
  return `${horizon.slice(0, 1).toUpperCase()}${horizon.slice(1)}`
}
