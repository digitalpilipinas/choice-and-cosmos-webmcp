export const ZODIAC_SIGNS = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const
export type ZodiacSign = (typeof ZODIAC_SIGNS)[number]

export const HUMAN_DESIGN_TYPES = [
  'generator',
  'manifestingGenerator',
  'manifestor',
  'projector',
  'reflector',
] as const
export type HumanDesignType = (typeof HUMAN_DESIGN_TYPES)[number]

export const HUMAN_DESIGN_AUTHORITIES = [
  'emotional',
  'sacral',
  'splenic',
  'ego',
  'selfProjected',
  'mental',
  'lunar',
] as const
export type HumanDesignAuthority = (typeof HUMAN_DESIGN_AUTHORITIES)[number]

export const HUMAN_DESIGN_PROFILES = [
  '1/3',
  '1/4',
  '2/4',
  '2/5',
  '3/5',
  '3/6',
  '4/6',
  '4/1',
  '5/1',
  '5/2',
  '6/2',
  '6/3',
] as const
export type HumanDesignProfile = (typeof HUMAN_DESIGN_PROFILES)[number]

export const LIFE_PATH_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33,
] as const
export type LifePathNumber = (typeof LIFE_PATH_NUMBERS)[number]

export const CHINESE_ZODIAC_ANIMALS = [
  'rat',
  'ox',
  'tiger',
  'rabbit',
  'dragon',
  'snake',
  'horse',
  'goat',
  'monkey',
  'rooster',
  'dog',
  'pig',
] as const
export type ChineseZodiacAnimal = (typeof CHINESE_ZODIAC_ANIMALS)[number]

export const CHINESE_ELEMENTS = [
  'wood',
  'fire',
  'earth',
  'metal',
  'water',
] as const
export type ChineseElement = (typeof CHINESE_ELEMENTS)[number]

export const COSMIC_KEYS = [
  'sunSign',
  'moonSign',
  'risingSign',
  'humanDesignType',
  'humanDesignAuthority',
  'humanDesignProfile',
  'lifePath',
  'chineseZodiacAnimal',
  'chineseElement',
] as const
export type CosmicField = (typeof COSMIC_KEYS)[number]

export interface CosmicProfile {
  sunSign?: ZodiacSign
  moonSign?: ZodiacSign
  risingSign?: ZodiacSign
  humanDesignType?: HumanDesignType
  humanDesignAuthority?: HumanDesignAuthority
  humanDesignProfile?: HumanDesignProfile
  lifePath?: LifePathNumber
  chineseZodiacAnimal?: ChineseZodiacAnimal
  chineseElement?: ChineseElement
}

const COSMIC_KEY_SET = new Set<string>(COSMIC_KEYS)

export function emptyCosmic(): CosmicProfile {
  return {}
}

export function parseCosmicProfile(raw: unknown): CosmicProfile | null {
  if (!isRecord(raw)) {
    return null
  }
  for (const key of Object.keys(raw)) {
    if (!COSMIC_KEY_SET.has(key)) {
      return null
    }
  }

  const cosmic: CosmicProfile = {}
  const sunSign = optionalEnum(raw.sunSign, ZODIAC_SIGNS)
  const moonSign = optionalEnum(raw.moonSign, ZODIAC_SIGNS)
  const risingSign = optionalEnum(raw.risingSign, ZODIAC_SIGNS)
  const humanDesignType = optionalEnum(raw.humanDesignType, HUMAN_DESIGN_TYPES)
  const humanDesignAuthority = optionalEnum(
    raw.humanDesignAuthority,
    HUMAN_DESIGN_AUTHORITIES,
  )
  const humanDesignProfile = optionalEnum(
    raw.humanDesignProfile,
    HUMAN_DESIGN_PROFILES,
  )
  const lifePath = optionalLifePath(raw.lifePath)
  const chineseZodiacAnimal = optionalEnum(
    raw.chineseZodiacAnimal,
    CHINESE_ZODIAC_ANIMALS,
  )
  const chineseElement = optionalEnum(raw.chineseElement, CHINESE_ELEMENTS)

  if (
    sunSign === undefined ||
    moonSign === undefined ||
    risingSign === undefined ||
    humanDesignType === undefined ||
    humanDesignAuthority === undefined ||
    humanDesignProfile === undefined ||
    lifePath === undefined ||
    chineseZodiacAnimal === undefined ||
    chineseElement === undefined
  ) {
    return null
  }

  if (sunSign !== null) {
    cosmic.sunSign = sunSign
  }
  if (moonSign !== null) {
    cosmic.moonSign = moonSign
  }
  if (risingSign !== null) {
    cosmic.risingSign = risingSign
  }
  if (humanDesignType !== null) {
    cosmic.humanDesignType = humanDesignType
  }
  if (humanDesignAuthority !== null) {
    cosmic.humanDesignAuthority = humanDesignAuthority
  }
  if (humanDesignProfile !== null) {
    cosmic.humanDesignProfile = humanDesignProfile
  }
  if (lifePath !== null) {
    cosmic.lifePath = lifePath
  }
  if (chineseZodiacAnimal !== null) {
    cosmic.chineseZodiacAnimal = chineseZodiacAnimal
  }
  if (chineseElement !== null) {
    cosmic.chineseElement = chineseElement
  }
  return cosmic
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

function optionalLifePath(raw: unknown): LifePathNumber | null | undefined {
  if (raw === undefined) {
    return null
  }
  if (typeof raw !== 'number' || !LIFE_PATH_NUMBERS.includes(raw as LifePathNumber)) {
    return undefined
  }
  return raw as LifePathNumber
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
