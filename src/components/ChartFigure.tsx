import type { ChartModel } from '../domain/studioView.ts'

const CHART_WIDTH = 420
const CHART_HEIGHT = 140
const PLOT_TOP = 18
const PLOT_BOTTOM = 104
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP

export function ChartFigure({ model }: { model: ChartModel }) {
  const max = Math.max(1, ...model.slots.map((slot) => slot.value))
  const slotWidth = CHART_WIDTH / model.slots.length
  const barWidth = Math.min(36, slotWidth * 0.55)
  const description = `${model.title}. ${model.slots
    .map((slot) => `${slot.label} ${slot.value}`)
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
          const barHeight = (slot.value / max) * PLOT_HEIGHT
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
                {slot.value}
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
        <caption>{model.caption}</caption>
        <thead>
          <tr>
            <th scope="col">Slot</th>
            <th scope="col">{model.valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {model.slots.map((slot) => (
            <tr key={slot.id}>
              <th scope="row">{slot.label}</th>
              <td>{slot.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{model.caption}</p>
    </figure>
  )
}
