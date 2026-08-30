import type { CosmicField, CosmicProfile } from '../domain/cosmic.ts'
import type { ModularBeliefs } from '../domain/profile.ts'
import type { ReportSectionId } from '../domain/types.ts'
import type { SkippedLens } from './contract.ts'

export const ALL_LENSES: readonly ReportSectionId[] = [
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
]

export const ALWAYS_LENSES: readonly ReportSectionId[] = [
  'energyOverview',
  'decisionSupport',
  'focusActionPlan',
]

const LENS_SET = new Set<string>(ALL_LENSES)

export function isReportSectionId(value: unknown): value is ReportSectionId {
  return typeof value === 'string' && LENS_SET.has(value)
}

export function hasCosmicValue(
  cosmic: CosmicProfile,
  field: CosmicField,
): boolean {
  return cosmic[field] !== undefined
}

export function lensSupported(
  lens: ReportSectionId,
  cosmic: CosmicProfile,
): boolean {
  switch (lens) {
    case 'energyOverview':
    case 'decisionSupport':
    case 'focusActionPlan':
      return true
    case 'westernAstrology':
      return hasCosmicValue(cosmic, 'sunSign')
    case 'humanDesign':
      return hasCosmicValue(cosmic, 'humanDesignType')
    case 'numerology':
      return hasCosmicValue(cosmic, 'lifePath')
    case 'chineseElemental':
      return (
        hasCosmicValue(cosmic, 'chineseZodiacAnimal') ||
        hasCosmicValue(cosmic, 'chineseElement')
      )
    case 'lifeAreas':
    case 'tarotOracle':
    case 'symbolicCodes':
    case 'higherSelfLetter':
      return false
  }
}

export function planLenses(
  requested: readonly ReportSectionId[],
  cosmic: CosmicProfile,
): {
  active: ReportSectionId[]
  skipped: SkippedLens[]
} {
  return planRequested(requested, (lens) => lensSupported(lens, cosmic), skipReason)
}

export function lensSupportedByBeliefs(
  lens: ReportSectionId,
  beliefs: ModularBeliefs,
): boolean {
  switch (lens) {
    case 'energyOverview':
    case 'decisionSupport':
    case 'focusActionPlan':
      return true
    case 'westernAstrology':
      return beliefs.western !== undefined
    case 'humanDesign':
      return beliefs.humanDesign !== undefined
    case 'numerology':
      return beliefs.numerology !== undefined
    case 'chineseElemental':
      return beliefs.chinese !== undefined
    case 'lifeAreas':
    case 'tarotOracle':
    case 'symbolicCodes':
    case 'higherSelfLetter':
      return false
  }
}

export function planLensesForBeliefs(
  requested: readonly ReportSectionId[],
  beliefs: ModularBeliefs,
): {
  active: ReportSectionId[]
  skipped: SkippedLens[]
} {
  return planRequested(
    requested,
    (lens) => lensSupportedByBeliefs(lens, beliefs),
    (lens) => skipReasonForBeliefs(lens),
  )
}

function planRequested(
  requested: readonly ReportSectionId[],
  supported: (lens: ReportSectionId) => boolean,
  reasonFor: (lens: ReportSectionId) => string,
): {
  active: ReportSectionId[]
  skipped: SkippedLens[]
} {
  const active: ReportSectionId[] = []
  const skipped: SkippedLens[] = []
  const seen = new Set<ReportSectionId>()
  for (const lens of requested) {
    if (seen.has(lens)) {
      continue
    }
    seen.add(lens)
    if (supported(lens)) {
      active.push(lens)
    } else {
      skipped.push({
        lens,
        reason: reasonFor(lens),
      })
    }
  }
  return { active, skipped }
}

function skipReasonForBeliefs(lens: ReportSectionId): string {
  if (lens === 'numerology') {
    return 'Numerology is skipped until a self-supplied number is provided. It is never calculated from a birth date.'
  }
  return skipReason(lens)
}

function skipReason(lens: ReportSectionId): string {
  switch (lens) {
    case 'energyOverview':
    case 'decisionSupport':
    case 'focusActionPlan':
      return 'This lens stays available without extra profile fields.'
    case 'westernAstrology':
      return 'Western astrology is skipped until a self-supplied placement is provided. Optional signs are never inferred.'
    case 'humanDesign':
      return 'Human Design is skipped until a Human Design type is provided. Authority and profile are never inferred.'
    case 'numerology':
      return 'Numerology is skipped until a Life Path number is provided. It is never calculated from a birth date.'
    case 'chineseElemental':
      return 'Chinese elemental guidance is skipped until an animal or element is provided. It is never inferred from a birth year.'
    case 'lifeAreas':
    case 'tarotOracle':
    case 'symbolicCodes':
    case 'higherSelfLetter':
      return 'This lens is skipped until cited http(s) evidence supports it. Generic copy is not used as a stand-in.'
  }
}
