import type { HorizonChartModel } from '../domain/synthesis.ts'

const CHART_WIDTH = 420
const CHART_HEIGHT = 140
const PLOT_TOP = 18
const PLOT_BOTTOM = 104
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP

export function HorizonChart({ model }: { model: HorizonChartModel }) {
  const max = Math.max(1, ...model.slots.map((slot) => slot.catalogWeight))
  const slotWidth = CHART_WIDTH / model.slots.length
  const barWidth = Math.min(36, slotWidth * 0.55)
  const description = `${model.title}. ${model.slots
    .map((slot) => `${slot.label} ${slot.catalogWeight}`)
    .join('. ')}. ${model.caption}`

  return (
    <figure className="horizon-chart">
      <figcaption>{model.title}</figcaption>
      <svg
        role="img"
        aria-label={description}
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        {model.slots.map((slot, index) => {
          const barHeight = (slot.catalogWeight / max) * PLOT_HEIGHT
          const x = index * slotWidth + (slotWidth - barWidth) / 2
          const y = PLOT_BOTTOM - barHeight
          return (
            <g key={slot.id}>
              <rect
                className="horizon-chart-bar"
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
              />
              <text
                className="horizon-chart-count"
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
              >
                {slot.catalogWeight}
              </text>
              <text
                className="horizon-chart-label"
                x={x + barWidth / 2}
                y={122}
                textAnchor="middle"
              >
                {slot.label}
              </text>
            </g>
          )
        })}
      </svg>
      <table className="horizon-chart-fallback">
        <caption>Catalog weight by window part. Integer counts, not probabilities.</caption>
        <thead>
          <tr>
            <th scope="col">Window part</th>
            <th scope="col">Catalog weight</th>
          </tr>
        </thead>
        <tbody>
          {model.slots.map((slot) => (
            <tr key={slot.id}>
              <th scope="row">{slot.label}</th>
              <td>{slot.catalogWeight}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{model.caption}</p>
    </figure>
  )
}
