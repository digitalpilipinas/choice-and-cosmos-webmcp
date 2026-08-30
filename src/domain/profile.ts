import type { CosmicProfile } from './cosmic.ts'
import {
  CHINESE_ELEMENTS,
  CHINESE_ZODIAC_ANIMALS,
  HUMAN_DESIGN_AUTHORITIES,
  HUMAN_DESIGN_PROFILES,
  HUMAN_DESIGN_TYPES,
  LIFE_PATH_NUMBERS,
  ZODIAC_SIGNS,
  type ChineseElement,
  type ChineseZodiacAnimal,
  type HumanDesignAuthority,
  type HumanDesignProfile,
  type HumanDesignType,
  type LifePathNumber,
  type ZodiacSign,
} from './cosmic.ts'

export const HEAVENLY_STEMS = [
  'jia',
  'yi',
  'bing',
  'ding',
  'wu',
  'ji',
  'geng',
  'xin',
  'ren',
  'gui',
] as const
export type HeavenlyStem = (typeof HEAVENLY_STEMS)[number]

export const HUMAN_DESIGN_STRATEGIES = [
  'inform',
  'respond',
  'waitForInvitation',
  'waitLunarCycle',
] as const
export type HumanDesignStrategy = (typeof HUMAN_DESIGN_STRATEGIES)[number]

export type CoreNumber = LifePathNumber
export type BirthdayNumber =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | 31

export type WesternModule = {
  sun?: ZodiacSign
  moon?: ZodiacSign
  rising?: ZodiacSign
} & (
  | { sun: ZodiacSign }
  | { moon: ZodiacSign }
  | { rising: ZodiacSign }
)

export type NumerologyModule = {
  lifePath?: CoreNumber
  expression?: CoreNumber
  soulUrge?: CoreNumber
  personality?: CoreNumber
  maturity?: CoreNumber
  birthday?: BirthdayNumber
} & (
  | { lifePath: CoreNumber }
  | { expression: CoreNumber }
  | { soulUrge: CoreNumber }
  | { personality: CoreNumber }
  | { maturity: CoreNumber }
  | { birthday: BirthdayNumber }
)

export type ChineseModule =
  | { animal: ChineseZodiacAnimal; element?: ChineseElement }
  | { element: ChineseElement; animal?: never }

export type ElementCounts = { [K in ChineseElement]?: number }

export interface BaZiModule {
  dayMaster: HeavenlyStem
  elementCounts?: ElementCounts
}

export interface HumanDesignModule {
  type: HumanDesignType
  strategy?: HumanDesignStrategy
  authority?: HumanDesignAuthority
  profile?: HumanDesignProfile
}

export interface ModularBeliefs {
  western?: WesternModule
  numerology?: NumerologyModule
  chinese?: ChineseModule
  bazi?: BaZiModule
  humanDesign?: HumanDesignModule
}

const MODULE_KEYS = [
  'western',
  'numerology',
  'chinese',
  'bazi',
  'humanDesign',
] as const

const FORBIDDEN_PROFILE_KEYS = new Set([
  'birthDate',
  'birthTime',
  'birthLocation',
  'birthPlace',
  'dateOfBirth',
  'timeOfBirth',
  'placeOfBirth',
  'dob',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'natal',
  'chart',
  'account',
  'cloud',
  'fourPillars',
  'datetime',
])

const WESTERN_KEYS = new Set(['sun', 'moon', 'rising'])
const NUMEROLOGY_KEYS = new Set([
  'lifePath',
  'expression',
  'soulUrge',
  'personality',
  'maturity',
  'birthday',
])
const CHINESE_KEYS = new Set(['animal', 'element'])
const BAZI_KEYS = new Set(['dayMaster', 'elementCounts'])
const HD_KEYS = new Set(['type', 'strategy', 'authority', 'profile'])
const COUNT_KEYS = new Set(['wood', 'fire', 'earth', 'metal', 'water'])

export function emptyBeliefs(): ModularBeliefs {
  return {}
}

export function parseModularProfile(raw: unknown): ModularBeliefs | null {
  if (!isRecord(raw)) {
    return null
  }
  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_PROFILE_KEYS.has(key) || !MODULE_KEYS.includes(key as (typeof MODULE_KEYS)[number])) {
      return null
    }
  }
  const beliefs: ModularBeliefs = {}
  if (raw.western !== undefined) {
    const western = parseWestern(raw.western)
    if (western === null) {
      return null
    }
    beliefs.western = western
  }
  if (raw.numerology !== undefined) {
    const numerology = parseNumerology(raw.numerology)
    if (numerology === null) {
      return null
    }
    beliefs.numerology = numerology
  }
  if (raw.chinese !== undefined) {
    const chinese = parseChinese(raw.chinese)
    if (chinese === null) {
      return null
    }
    beliefs.chinese = chinese
  }
  if (raw.bazi !== undefined) {
    const bazi = parseBazi(raw.bazi)
    if (bazi === null) {
      return null
    }
    beliefs.bazi = bazi
  }
  if (raw.humanDesign !== undefined) {
    const humanDesign = parseHumanDesign(raw.humanDesign)
    if (humanDesign === null) {
      return null
    }
    beliefs.humanDesign = humanDesign
  }
  return beliefs
}

export function beliefsFromLegacyCosmic(cosmic: CosmicProfile): ModularBeliefs {
  const beliefs: ModularBeliefs = {}
  const western = compactWestern({
    sun: cosmic.sunSign,
    moon: cosmic.moonSign,
    rising: cosmic.risingSign,
  })
  if (western !== undefined) {
    beliefs.western = western
  }
  if (cosmic.lifePath !== undefined) {
    beliefs.numerology = { lifePath: cosmic.lifePath }
  }
  const chinese = compactChinese({
    animal: cosmic.chineseZodiacAnimal,
    element: cosmic.chineseElement,
  })
  if (chinese !== undefined) {
    beliefs.chinese = chinese
  }
  if (cosmic.humanDesignType !== undefined) {
    const humanDesign: HumanDesignModule = { type: cosmic.humanDesignType }
    if (cosmic.humanDesignAuthority !== undefined) {
      humanDesign.authority = cosmic.humanDesignAuthority
    }
    if (cosmic.humanDesignProfile !== undefined) {
      humanDesign.profile = cosmic.humanDesignProfile
    }
    beliefs.humanDesign = humanDesign
  }
  return beliefs
}

export function hasBeliefModule(beliefs: ModularBeliefs): boolean {
  return (
    beliefs.western !== undefined ||
    beliefs.numerology !== undefined ||
    beliefs.chinese !== undefined ||
    beliefs.bazi !== undefined ||
    beliefs.humanDesign !== undefined
  )
}

export function cosmicFromBeliefs(beliefs: ModularBeliefs): CosmicProfile {
  const cosmic: CosmicProfile = {}
  if (beliefs.western?.sun !== undefined) {
    cosmic.sunSign = beliefs.western.sun
  }
  if (beliefs.western?.moon !== undefined) {
    cosmic.moonSign = beliefs.western.moon
  }
  if (beliefs.western?.rising !== undefined) {
    cosmic.risingSign = beliefs.western.rising
  }
  if (beliefs.humanDesign?.type !== undefined) {
    cosmic.humanDesignType = beliefs.humanDesign.type
  }
  if (beliefs.humanDesign?.authority !== undefined) {
    cosmic.humanDesignAuthority = beliefs.humanDesign.authority
  }
  if (beliefs.humanDesign?.profile !== undefined) {
    cosmic.humanDesignProfile = beliefs.humanDesign.profile
  }
  if (beliefs.numerology?.lifePath !== undefined) {
    cosmic.lifePath = beliefs.numerology.lifePath
  }
  if (beliefs.chinese?.animal !== undefined) {
    cosmic.chineseZodiacAnimal = beliefs.chinese.animal
  }
  if (beliefs.chinese?.element !== undefined) {
    cosmic.chineseElement = beliefs.chinese.element
  }
  return cosmic
}

export function tarotEligible(beliefs: ModularBeliefs): boolean {
  return beliefs.western?.sun !== undefined
}

export type BeliefLeaf =
  | 'sun'
  | 'moon'
  | 'rising'
  | 'lifePath'
  | 'expression'
  | 'soulUrge'
  | 'personality'
  | 'maturity'
  | 'birthday'
  | 'animal'
  | 'element'
  | 'dayMaster'
  | 'hdType'
  | 'hdStrategy'
  | 'hdAuthority'
  | 'hdProfile'

export function patchBeliefLeaf(
  beliefs: ModularBeliefs,
  leaf: BeliefLeaf,
  value: unknown,
): ModularBeliefs | null {
  const next: Record<string, unknown> = {
    western: beliefs.western === undefined ? undefined : { ...beliefs.western },
    numerology: beliefs.numerology === undefined ? undefined : { ...beliefs.numerology },
    chinese: beliefs.chinese === undefined ? undefined : { ...beliefs.chinese },
    bazi: beliefs.bazi === undefined ? undefined : { ...beliefs.bazi },
    humanDesign:
      beliefs.humanDesign === undefined ? undefined : { ...beliefs.humanDesign },
  }
  switch (leaf) {
    case 'sun':
    case 'moon':
    case 'rising':
      next.western = setOrDelete(
        isRecord(next.western) ? next.western : {},
        leaf,
        value,
      )
      break
    case 'lifePath':
    case 'expression':
    case 'soulUrge':
    case 'personality':
    case 'maturity':
    case 'birthday':
      next.numerology = setOrDelete(
        isRecord(next.numerology) ? next.numerology : {},
        leaf,
        value,
      )
      break
    case 'animal':
    case 'element':
      next.chinese = setOrDelete(
        isRecord(next.chinese) ? next.chinese : {},
        leaf,
        value,
      )
      break
    case 'dayMaster':
      next.bazi = setOrDelete(isRecord(next.bazi) ? next.bazi : {}, leaf, value)
      break
    case 'hdType':
      next.humanDesign = setOrDelete(
        isRecord(next.humanDesign) ? next.humanDesign : {},
        'type',
        value,
      )
      break
    case 'hdStrategy':
      next.humanDesign = setOrDelete(
        isRecord(next.humanDesign) ? next.humanDesign : {},
        'strategy',
        value,
      )
      break
    case 'hdAuthority':
      next.humanDesign = setOrDelete(
        isRecord(next.humanDesign) ? next.humanDesign : {},
        'authority',
        value,
      )
      break
    case 'hdProfile':
      next.humanDesign = setOrDelete(
        isRecord(next.humanDesign) ? next.humanDesign : {},
        'profile',
        value,
      )
      break
  }
  for (const key of MODULE_KEYS) {
    const moduleValue = next[key]
    if (isRecord(moduleValue) && Object.keys(moduleValue).length === 0) {
      delete next[key]
    }
  }
  return parseModularProfile(next)
}

function setOrDelete(
  record: Record<string, unknown>,
  key: string,
  value: unknown,
): Record<string, unknown> {
  if (value === undefined) {
    delete record[key]
    return record
  }
  record[key] = value
  return record
}

function parseWestern(raw: unknown): WesternModule | null {
  if (!isRecord(raw) || hasForbidden(raw) || hasUnknown(raw, WESTERN_KEYS)) {
    return null
  }
  const sun = optionalEnum(raw.sun, ZODIAC_SIGNS)
  const moon = optionalEnum(raw.moon, ZODIAC_SIGNS)
  const rising = optionalEnum(raw.rising, ZODIAC_SIGNS)
  if (sun === undefined || moon === undefined || rising === undefined) {
    return null
  }
  return compactWestern({
    sun: sun ?? undefined,
    moon: moon ?? undefined,
    rising: rising ?? undefined,
  }) ?? null
}

function parseNumerology(raw: unknown): NumerologyModule | null {
  if (!isRecord(raw) || hasForbidden(raw) || hasUnknown(raw, NUMEROLOGY_KEYS)) {
    return null
  }
  const lifePath = optionalCore(raw.lifePath)
  const expression = optionalCore(raw.expression)
  const soulUrge = optionalCore(raw.soulUrge)
  const personality = optionalCore(raw.personality)
  const maturity = optionalCore(raw.maturity)
  const birthday = optionalBirthday(raw.birthday)
  if (
    lifePath === undefined ||
    expression === undefined ||
    soulUrge === undefined ||
    personality === undefined ||
    maturity === undefined ||
    birthday === undefined
  ) {
    return null
  }
  const module: NumerologyModule = {
    ...(lifePath !== null ? { lifePath } : {}),
    ...(expression !== null ? { expression } : {}),
    ...(soulUrge !== null ? { soulUrge } : {}),
    ...(personality !== null ? { personality } : {}),
    ...(maturity !== null ? { maturity } : {}),
    ...(birthday !== null ? { birthday } : {}),
  } as NumerologyModule
  if (
    module.lifePath === undefined &&
    module.expression === undefined &&
    module.soulUrge === undefined &&
    module.personality === undefined &&
    module.maturity === undefined &&
    module.birthday === undefined
  ) {
    return null
  }
  return module
}

function parseChinese(raw: unknown): ChineseModule | null {
  if (!isRecord(raw) || hasForbidden(raw) || hasUnknown(raw, CHINESE_KEYS)) {
    return null
  }
  const animal = optionalEnum(raw.animal, CHINESE_ZODIAC_ANIMALS)
  const element = optionalEnum(raw.element, CHINESE_ELEMENTS)
  if (animal === undefined || element === undefined) {
    return null
  }
  return compactChinese({
    animal: animal ?? undefined,
    element: element ?? undefined,
  }) ?? null
}

function parseBazi(raw: unknown): BaZiModule | null {
  if (!isRecord(raw) || hasForbidden(raw) || hasUnknown(raw, BAZI_KEYS)) {
    return null
  }
  const dayMaster = optionalEnum(raw.dayMaster, HEAVENLY_STEMS)
  if (dayMaster === undefined || dayMaster === null) {
    return null
  }
  const module: BaZiModule = { dayMaster }
  if (raw.elementCounts !== undefined) {
    const counts = parseElementCounts(raw.elementCounts)
    if (counts === null) {
      return null
    }
    if (Object.keys(counts).length > 0) {
      module.elementCounts = counts
    }
  }
  return module
}

function parseHumanDesign(raw: unknown): HumanDesignModule | null {
  if (!isRecord(raw) || hasForbidden(raw) || hasUnknown(raw, HD_KEYS)) {
    return null
  }
  const type = optionalEnum(raw.type, HUMAN_DESIGN_TYPES)
  if (type === undefined || type === null) {
    return null
  }
  const strategy = optionalEnum(raw.strategy, HUMAN_DESIGN_STRATEGIES)
  const authority = optionalEnum(raw.authority, HUMAN_DESIGN_AUTHORITIES)
  const profile = optionalEnum(raw.profile, HUMAN_DESIGN_PROFILES)
  if (strategy === undefined || authority === undefined || profile === undefined) {
    return null
  }
  const module: HumanDesignModule = { type }
  if (strategy !== null) {
    module.strategy = strategy
  }
  if (authority !== null) {
    module.authority = authority
  }
  if (profile !== null) {
    module.profile = profile
  }
  return module
}

function parseElementCounts(raw: unknown): ElementCounts | null {
  if (!isRecord(raw) || hasForbidden(raw) || hasUnknown(raw, COUNT_KEYS)) {
    return null
  }
  const counts: ElementCounts = {}
  for (const key of COUNT_KEYS) {
    if (raw[key] === undefined) {
      continue
    }
    if (typeof raw[key] !== 'number' || !Number.isInteger(raw[key]) || raw[key] < 0 || raw[key] > 12) {
      return null
    }
    counts[key as ChineseElement] = raw[key]
  }
  return counts
}

function compactWestern(input: {
  sun?: ZodiacSign
  moon?: ZodiacSign
  rising?: ZodiacSign
}): WesternModule | undefined {
  if (input.sun === undefined && input.moon === undefined && input.rising === undefined) {
    return undefined
  }
  return {
    ...(input.sun !== undefined ? { sun: input.sun } : {}),
    ...(input.moon !== undefined ? { moon: input.moon } : {}),
    ...(input.rising !== undefined ? { rising: input.rising } : {}),
  } as WesternModule
}

function compactChinese(input: {
  animal?: ChineseZodiacAnimal
  element?: ChineseElement
}): ChineseModule | undefined {
  if (input.animal !== undefined) {
    return input.element === undefined
      ? { animal: input.animal }
      : { animal: input.animal, element: input.element }
  }
  if (input.element !== undefined) {
    return { element: input.element }
  }
  return undefined
}

function optionalEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
): T | null | undefined {
  if (raw === undefined) {
    return null
  }
  if (typeof raw !== 'string' || !allowed.includes(raw as T)) {
    return undefined
  }
  return raw as T
}

function optionalCore(raw: unknown): CoreNumber | null | undefined {
  if (raw === undefined) {
    return null
  }
  if (typeof raw !== 'number' || !LIFE_PATH_NUMBERS.includes(raw as LifePathNumber)) {
    return undefined
  }
  return raw as CoreNumber
}

function optionalBirthday(raw: unknown): BirthdayNumber | null | undefined {
  if (raw === undefined) {
    return null
  }
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 31) {
    return undefined
  }
  return raw as BirthdayNumber
}

function hasForbidden(raw: Record<string, unknown>): boolean {
  return Object.keys(raw).some((key) => FORBIDDEN_PROFILE_KEYS.has(key))
}

function hasUnknown(raw: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(raw).some((key) => !allowed.has(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
