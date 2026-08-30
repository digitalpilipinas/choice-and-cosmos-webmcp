import { useMemo, useState } from 'react'
import type { ContinuityCalendarAvailable } from '../../domain/studioView.ts'
import {
  buildCalendar,
  defaultSchedule,
  serializeCalendar,
} from '../../export/ics.ts'

export function CalendarExport({
  calendar,
}: {
  calendar: ContinuityCalendarAvailable
}) {
  const fallback = useMemo(
    () => defaultSchedule(calendar.artifact),
    [calendar.artifact],
  )
  const [rows, setRows] = useState<
    Record<string, { startDate: string; timeOfDay: string; timeZone: string }>
  >(() =>
    Object.fromEntries(
      calendar.acceptedSteps.map((step) => [
        step.id,
        {
          startDate: fallback.startDate,
          timeOfDay: fallback.timeOfDay,
          timeZone: fallback.timeZone,
        },
      ]),
    ),
  )

  const outcome = useMemo(
    () =>
      buildCalendar({
        artifact: calendar.artifact,
        accepted: calendar.acceptedSteps,
        selections: calendar.acceptedSteps.map((step) => {
          const row = rows[step.id] ?? fallback
          return {
            stepId: step.id,
            startDate: row.startDate,
            timeOfDay: row.timeOfDay,
            timeZone: row.timeZone,
          }
        }),
      }),
    [calendar.acceptedSteps, calendar.artifact, fallback, rows],
  )

  const setField = (
    stepId: string,
    field: 'startDate' | 'timeOfDay' | 'timeZone',
    value: string,
  ) => {
    setRows((current) => {
      const row = current[stepId] ?? fallback
      return {
        ...current,
        [stepId]: {
          ...row,
          [field]: field === 'timeOfDay' ? value.slice(0, 5) : value,
        },
      }
    })
  }

  const download = () => {
    if (!outcome.ok) {
      return
    }
    const blob = new Blob([serializeCalendar(outcome.plan)], {
      type: 'text/calendar;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = outcome.plan.filename
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="calendar-export" aria-labelledby="calendar-export-heading">
      <h3 id="calendar-export-heading">Calendar download</h3>
      <p>{calendar.capNote}</p>
      {calendar.acceptedSteps.map((step) => {
        const row = rows[step.id] ?? fallback
        return (
          <fieldset key={step.id}>
            <legend>{step.title}</legend>
            <div className="calendar-export-fields">
              <label>
                Date
                <input
                  type="date"
                  value={row.startDate}
                  onChange={(event) => setField(step.id, 'startDate', event.target.value)}
                />
              </label>
              <label>
                Time
                <input
                  type="time"
                  value={row.timeOfDay}
                  onChange={(event) => setField(step.id, 'timeOfDay', event.target.value)}
                />
              </label>
              <label>
                Time zone
                <input
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={row.timeZone}
                  onChange={(event) => setField(step.id, 'timeZone', event.target.value)}
                />
              </label>
            </div>
          </fieldset>
        )
      })}
      {outcome.ok ? (
        <table>
          <caption>Preview</caption>
          <thead>
            <tr>
              <th scope="col">Action</th>
              <th scope="col">When</th>
            </tr>
          </thead>
          <tbody>
            {outcome.plan.events.map((event) => (
              <tr key={event.uid}>
                <td>{event.summary}</td>
                <td>{event.localLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p role="status">{outcome.reason}</p>
      )}
      <button type="button" disabled={!outcome.ok} onClick={download}>
        Download calendar
      </button>
    </section>
  )
}
