import type {
  DerivedProfile,
  HorizonId,
  ReportSection,
  ReportSectionId,
} from '../domain/types.ts'

export const REPORT_SECTION_ORDER = [
  'energyOverview',
  'numerology',
  'humanDesign',
  'westernAstrology',
  'chineseElemental',
  'lifeAreas',
  'decisionSupport',
  'tarotOracle',
  'focusActionPlan',
  'symbolicCodes',
  'higherSelfLetter',
] as const satisfies readonly ReportSectionId[]

const SECTION_META: Record<
  ReportSectionId,
  { title: string; frameworkLabel: string }
> = {
  energyOverview: {
    title: 'Energy overview',
    frameworkLabel: 'Reflective energy map, reflective framework',
  },
  numerology: {
    title: 'Numerology',
    frameworkLabel: 'Numerology, interpretive lens',
  },
  humanDesign: {
    title: 'Human design',
    frameworkLabel: 'Human design, interpretive lens',
  },
  westernAstrology: {
    title: 'Western astrology',
    frameworkLabel: 'Western astrology, interpretive lens',
  },
  chineseElemental: {
    title: 'Chinese elemental',
    frameworkLabel: 'Five-phase elemental metaphor, interpretive lens',
  },
  lifeAreas: {
    title: 'Life areas',
    frameworkLabel: 'Life-area overlay, reflective framework',
  },
  decisionSupport: {
    title: 'Decision support',
    frameworkLabel: 'Decision hygiene, reflective framework',
  },
  tarotOracle: {
    title: 'Tarot / oracle',
    frameworkLabel: 'Tarot and oracle imagery, interpretive lens',
  },
  focusActionPlan: {
    title: 'Focus action plan',
    frameworkLabel: 'Focus plan, reflective framework',
  },
  symbolicCodes: {
    title: 'Symbolic codes',
    frameworkLabel: 'Symbolic motif reading, interpretive lens',
  },
  higherSelfLetter: {
    title: 'Higher-self letter',
    frameworkLabel: 'Inner-letter form, reflective framework',
  },
}

const HORIZON_CUES: Record<HorizonId, string> = {
  daily:
    'Read this against the Signal window: today into tomorrow morning. Let anything past breakfast tomorrow wait.',
  weekly:
    'Read this against the Compass window: this week through the coming weekend. Midweek is a hinge, not a verdict.',
  yearly:
    'Read this against the Constellation window: this calendar year as a long arc. A year is a pattern you can steer, not a sentence.',
}

const TONE_CUES: Record<DerivedProfile['tone'], string> = {
  grounded:
    'Tone cue, grounded: keep the image close to the next hour you can actually touch. Drop anything that only sounds impressive.',
  curious:
    'Tone cue, curious: treat every image as a question you can walk around. If a line closes a door, set it down.',
  bold: 'Tone cue, bold: take the largest honest step you can stand behind. Leave the theatrical ones on the table.',
}

const REFLECTION_VARIANTS: Record<
  ReportSectionId,
  readonly [string, string]
> = {
  energyOverview: [
    'This overview is a weather report for attention, not a forecast of events. {horizonCue} Your stated focus, "{focus}", is the only needle on this map. {toneCue} Notice where energy gathers and where it thins, then choose what to feed.',
    'Think of this as a tide chart for effort. {horizonCue} The phrase you brought, "{focus}", is the shore this tide is measured against. {toneCue} Nothing here claims the tide will turn. It only names a way to watch it.',
  ],
  numerology: [
    'A number here is a motif, not a proof. {horizonCue} Holding "{focus}" beside a repeating digit is a journaling trick, the same way a poet repeats a line. {toneCue} If the motif does not earn a seat at your table, it leaves.',
    'This numerology pass is a counting rhyme for meaning, not a calculation of fate. {horizonCue} Let "{focus}" be the only quantity that actually matters. {toneCue} Use a number only if it helps you remember what you already know.',
  ],
  humanDesign: [
    'This human-design sketch is a costume rack for energy style, not a diagnosis. {horizonCue} Try the costume on against "{focus}" and see whether it helps you move. {toneCue} Authority stays with you. The chart does not get a vote.',
    'Read these type-and-strategy words as metaphors for pacing. {horizonCue} Your focus, "{focus}", is the scene. The costume is optional. {toneCue} If a strategy feels like a command, it has already failed the test.',
  ],
  westernAstrology: [
    'Planets here are characters in a play you are directing. {horizonCue} Place "{focus}" at center stage and let the sky-language be set dressing. {toneCue} No transit is treated as a cause, and no chart is treated as a future.',
    'This western-astrology pass is an interpretive sky-story, not a clock. {horizonCue} The story is only useful if it sheds light on "{focus}". {toneCue} When the story and your body disagree, your body wins.',
  ],
  chineseElemental: [
    'Wood, fire, earth, metal, and water are used here as seasons of effort. {horizonCue} Ask which phase currently feeds "{focus}", and which phase is overgrown. {toneCue} This is metaphor. It does not describe your organs, your luck, or the year you were born, because that data is not here.',
    'This five-phase reading is a kitchen metaphor: too much fire scorches, too much water dilutes. {horizonCue} Season the dish called "{focus}" with that in mind. {toneCue} You still choose the recipe.',
  ],
  lifeAreas: [
    'Life areas in this preview are rooms in a house, not scores. {horizonCue} Walk the rooms with "{focus}" in your pocket and notice which door you keep passing. {toneCue} A room that feels loud is not a room you must enter.',
    'This overlay names a few rooms, work, rest, kin, craft, so you can see where "{focus}" is currently living. {horizonCue} {toneCue} Moving a concern from one room to another is a choice you make, not a change the sky makes.',
  ],
  decisionSupport: [
    'Decision support here is hygiene, not an answer key. {horizonCue} For "{focus}", try naming one reversible step and one thing you will not decide yet. {toneCue} The guide does not pick. You do.',
    'This section offers a pause, a frame, and a next honest question about "{focus}". {horizonCue} {toneCue} If two options still look even, that is information, not failure. Wait is a valid move.',
  ],
  tarotOracle: [
    'Cards in this fixture are picture-prompts. {horizonCue} Draw the image across "{focus}" the way you would a postcard, then put the postcard down. {toneCue} A card does not make a future. It only asks whether a symbol still fits.',
    'This oracle pass is a collage, not a verdict. {horizonCue} Let one image sit beside "{focus}" and see what it stirs. {toneCue} If the image feels like a command, it is the wrong use of a picture.',
  ],
  focusActionPlan: [
    'This plan is a draft you can tear up. {horizonCue} It exists only to give "{focus}" a few candidate moves. {toneCue} Accepting none of them is still a complete use of the loop.',
    'Candidate steps are invitations, not assignments. {horizonCue} Each one should be small enough to do while still holding "{focus}". {toneCue} You will meet them again in Choice, where they stay optional.',
  ],
  symbolicCodes: [
    'Symbols here are shorthand, a key, a threshold, a hinge. {horizonCue} Pick one that helps you remember "{focus}" and ignore the rest. {toneCue} A code that needs a priest is the wrong code for this preview.',
    'This motif pass is a pocket-sized poem. {horizonCue} If a symbol does not click against "{focus}", it is decoration. {toneCue} Keep the one you can sketch from memory. Leave the ornate ones.',
  ],
  higherSelfLetter: [
    'This letter is you, writing to you, in a slower voice. {horizonCue} It does not speak from the sky. It asks what "{focus}" looks like if you were already on your own side. {toneCue} You may rewrite every line, or none.',
    'Read this as a draft from a calmer desk in the same house. {horizonCue} The desk does not know the future of "{focus}". It only knows how to ask a kinder question. {toneCue} Sign it only if the voice sounds like yours.',
  ],
}

export function buildReportSection(args: {
  id: ReportSectionId
  horizon: HorizonId
  tone: DerivedProfile['tone']
  focus: string
  variant: 0 | 1
  evidenceIds: string[]
}): ReportSection {
  const meta = SECTION_META[args.id]
  const template = REFLECTION_VARIANTS[args.id][args.variant]
  const reflection = fill(template, {
    horizonCue: HORIZON_CUES[args.horizon],
    toneCue: TONE_CUES[args.tone],
    focus: clipFocus(args.focus),
  })

  return {
    id: args.id,
    title: meta.title,
    frameworkLabel: meta.frameworkLabel,
    reflection,
    evidenceIds: args.evidenceIds,
  }
}

function clipFocus(focus: string): string {
  const trimmed = focus.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= 120) {
    return trimmed
  }
  return `${trimmed.slice(0, 117)}...`
}

function fill(
  template: string,
  values: Record<'horizonCue' | 'toneCue' | 'focus', string>,
): string {
  return template.replace(/\{(horizonCue|toneCue|focus)\}/g, (_, key: string) => {
    if (key === 'horizonCue' || key === 'toneCue' || key === 'focus') {
      return values[key]
    }
    return ''
  })
}
