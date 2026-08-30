import { ICS_EVENT_CAPS } from '../domain/bounds.ts'
import type { Instant, PacketDigest } from '../domain/brand.ts'
import { isPersonalized, type ReadingArtifact } from '../domain/trust.ts'
import type { ChoiceStep, HorizonId } from '../domain/types.ts'

export type IcsUid = string & { readonly __brand: 'IcsUid' }
export type IanaTimeZone = string & { readonly __brand: 'IanaTimeZone' }
export type CalendarDate = string & { readonly __brand: 'CalendarDate' }
export type ClockTime = string & { readonly __brand: 'ClockTime' }

export const EVENT_DURATION_MINUTES = 30
export const DEFAULT_CLOCK_TIME = '09:00'

export interface CalendarSelection {
  stepId: string
  startDate: CalendarDate
  timeOfDay: ClockTime
  timeZone: IanaTimeZone
}

export interface CalendarEvent {
  uid: IcsUid
  stepId: string
  summary: string
  description: string
  startDate: CalendarDate
  timeOfDay: ClockTime
  timeZone: IanaTimeZone
  localLabel: string
}

export interface CalendarPlan {
  horizon: HorizonId
  events: CalendarEvent[]
  cap: number
  filename: string
  dtstamp: string
}

export type CalendarRefusalCode =
  | 'not_adopted'
  | 'unaccepted_step'
  | 'over_horizon_cap'
  | 'invalid_civil_time'

export type CalendarOutcome =
  | { ok: true; plan: CalendarPlan }
  | { ok: false; code: CalendarRefusalCode; reason: string }

export function parseCalendarDate(raw: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (match === null) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null
  }
  return raw as CalendarDate
}

export function parseClockTime(raw: string): ClockTime | null {
  const match = /^(\d{2}):(\d{2})$/.exec(raw)
  if (match === null) {
    return null
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) {
    return null
  }
  return raw as ClockTime
}

export function parseIanaTimeZone(raw: string): IanaTimeZone | null {
  if (raw.length === 0 || raw.trim() !== raw) {
    return null
  }
  try {
    Intl.DateTimeFormat('en-US', { timeZone: raw }).format()
    return raw as IanaTimeZone
  } catch {
    return null
  }
}

export function parseSelection(raw: {
  stepId: string
  startDate: string
  timeOfDay: string
  timeZone: string
}): CalendarSelection | null {
  if (raw.stepId.length === 0) {
    return null
  }
  const startDate = parseCalendarDate(raw.startDate)
  const timeOfDay = parseClockTime(raw.timeOfDay)
  const timeZone = parseIanaTimeZone(raw.timeZone)
  if (startDate === null || timeOfDay === null || timeZone === null) {
    return null
  }
  return { stepId: raw.stepId, startDate, timeOfDay, timeZone }
}

export function defaultSchedule(artifact: ReadingArtifact): {
  startDate: CalendarDate
  timeOfDay: ClockTime
  timeZone: IanaTimeZone
} {
  const startDate =
    parseCalendarDate(new Date(artifact.adoptedAt).toISOString().slice(0, 10)) ??
    ('1970-01-01' as CalendarDate)
  const timeOfDay = parseClockTime(DEFAULT_CLOCK_TIME) ?? ('09:00' as ClockTime)
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timeZone =
    parseIanaTimeZone(resolved) ?? parseIanaTimeZone('UTC') ?? ('UTC' as IanaTimeZone)
  return { startDate, timeOfDay, timeZone }
}

export function icsUid(input: {
  packetDigest: PacketDigest
  horizon: HorizonId
  stepId: string
}): IcsUid {
  return `${input.packetDigest}-${input.horizon}-${input.stepId}@choice-and-cosmos.local` as IcsUid
}

export function buildCalendar(input: {
  artifact: ReadingArtifact | null
  accepted: readonly ChoiceStep[]
  selections: readonly {
    stepId: string
    startDate: string
    timeOfDay: string
    timeZone: string
  }[]
}): CalendarOutcome {
  if (!isPersonalized(input.artifact)) {
    return {
      ok: false,
      code: 'not_adopted',
      reason: 'Calendar download is only for an adopted reading.',
    }
  }
  const artifact = input.artifact
  const acceptedById = new Map(
    input.accepted
      .filter((step) => step.status === 'accepted')
      .map((step) => [step.id, step]),
  )
  const cap = ICS_EVENT_CAPS[artifact.horizon]
  if (input.selections.length > cap) {
    return {
      ok: false,
      code: 'over_horizon_cap',
      reason: `This ${artifact.horizon} reading allows at most ${String(cap)} calendar events.`,
    }
  }
  const events: CalendarEvent[] = []
  const seen = new Set<string>()
  for (const raw of input.selections) {
    if (seen.has(raw.stepId)) {
      return {
        ok: false,
        code: 'unaccepted_step',
        reason: 'Only accepted steps can be added to the calendar.',
      }
    }
    seen.add(raw.stepId)
    const step = acceptedById.get(raw.stepId)
    if (step === undefined) {
      return {
        ok: false,
        code: 'unaccepted_step',
        reason: 'Only accepted steps can be added to the calendar.',
      }
    }
    const selection = parseSelection(raw)
    if (selection === null) {
      return {
        ok: false,
        code: 'invalid_civil_time',
        reason: 'Date, time, or time zone is not a valid civil value.',
      }
    }
    const note = step.userNote.trim()
    events.push({
      uid: icsUid({
        packetDigest: artifact.packetDigest,
        horizon: artifact.horizon,
        stepId: step.id,
      }),
      stepId: step.id,
      summary: step.title,
      description: note.length > 0 ? `${step.rationale}\n${note}` : step.rationale,
      startDate: selection.startDate,
      timeOfDay: selection.timeOfDay,
      timeZone: selection.timeZone,
      localLabel: localLabel(selection),
    })
  }
  if (events.length === 0) {
    return {
      ok: false,
      code: 'unaccepted_step',
      reason: 'There are no accepted steps to put on a calendar.',
    }
  }
  const digestHex = artifact.packetDigest.slice(3, 11)
  return {
    ok: true,
    plan: {
      horizon: artifact.horizon,
      events,
      cap,
      filename: `choice-and-cosmos-${artifact.horizon}-${digestHex}.ics`,
      dtstamp: icsUtcFromInstant(artifact.adoptedAt),
    },
  }
}

export function serializeCalendar(plan: CalendarPlan): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Choice & Cosmos//Continuity//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const event of plan.events) {
    const ended = addMinutes(event.startDate, event.timeOfDay, EVENT_DURATION_MINUTES)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${plan.dtstamp}`,
      `DTSTART;TZID=${event.timeZone}:${icsCivil(event.startDate, event.timeOfDay)}`,
      `DTEND;TZID=${event.timeZone}:${icsCivil(ended.date, ended.time)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}

function localLabel(selection: CalendarSelection): string {
  const noon = new Date(`${selection.startDate}T12:00:00Z`)
  const dated = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(noon)
  return `${dated}, ${selection.timeOfDay} (${selection.timeZone})`
}

function addMinutes(
  date: CalendarDate,
  time: ClockTime,
  minutes: number,
): { date: CalendarDate; time: ClockTime } {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const end = new Date(
    Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0) +
      minutes * 60_000,
  )
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    date: `${String(end.getUTCFullYear())}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}` as CalendarDate,
    time: `${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}` as ClockTime,
  }
}

function icsCivil(date: CalendarDate, time: ClockTime): string {
  return `${date.replaceAll('-', '')}T${time.replace(':', '')}00`
}

function icsUtcFromInstant(instant: Instant): string {
  return new Date(instant).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
}

function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) {
    return line
  }
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let offset = 0
  let max = 75
  while (offset < bytes.length) {
    let end = Math.min(offset + max, bytes.length)
    while (end < bytes.length && end > offset && (bytes[end] & 0xc0) === 0x80) {
      end -= 1
    }
    chunks.push(decoder.decode(bytes.subarray(offset, end)))
    offset = end
    max = 74
  }
  return chunks.map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`)).join('\r\n')
}
