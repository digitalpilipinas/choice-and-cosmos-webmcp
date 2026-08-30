import { describe, expect, it } from 'vitest'
import {
  parseModularProfile,
  patchBeliefLeaf,
  beliefsFromLegacyCosmic,
  cosmicFromBeliefs,
  hasBeliefModule,
} from '../../src/domain/profile.ts'

describe('parseModularProfile', () => {
  it('accepts nested nonempty modules and rejects empty module objects', () => {
    expect(parseModularProfile({})).toEqual({})
    expect(parseModularProfile({ western: { sun: 'leo' } })).toEqual({
      western: { sun: 'leo' },
    })
    expect(parseModularProfile({ western: { moon: 'cancer' } })).toEqual({
      western: { moon: 'cancer' },
    })
    expect(parseModularProfile({ western: {} })).toBeNull()
    expect(parseModularProfile({ numerology: {} })).toBeNull()
    expect(parseModularProfile({ chinese: {} })).toBeNull()
    expect(parseModularProfile({ bazi: {} })).toBeNull()
    expect(parseModularProfile({ humanDesign: {} })).toBeNull()
  })

  it('rejects forbidden birth, account, and chart keys', () => {
    for (const key of [
      'birthDate',
      'dob',
      'fourPillars',
      'datetime',
      'account',
      'cloud',
      'chart',
      'natal',
    ]) {
      expect(parseModularProfile({ [key]: 'x', western: { sun: 'leo' } })).toBeNull()
    }
  })

  it('rejects a flat cosmic key bag', () => {
    expect(parseModularProfile({ sunSign: 'leo' })).toBeNull()
    expect(parseModularProfile({ sun: 'leo' })).toBeNull()
  })

  it('requires a Human Design type and a BaZi day master', () => {
    expect(parseModularProfile({ humanDesign: { strategy: 'inform' } })).toBeNull()
    expect(
      parseModularProfile({ humanDesign: { type: 'generator' } }),
    ).toEqual({ humanDesign: { type: 'generator' } })
    expect(parseModularProfile({ bazi: { elementCounts: { wood: 2 } } })).toBeNull()
    expect(parseModularProfile({ bazi: { dayMaster: 'jia' } })).toEqual({
      bazi: { dayMaster: 'jia' },
    })
  })
})

describe('patchBeliefLeaf', () => {
  it('sets and clears a western sun without leaving an empty module', () => {
    const withSun = patchBeliefLeaf({}, 'sun', 'leo')
    expect(withSun).toEqual({ western: { sun: 'leo' } })
    expect(patchBeliefLeaf(withSun ?? {}, 'sun', undefined)).toEqual({})
  })
})

describe('beliefsFromLegacyCosmic', () => {
  it('maps a V2 cosmic bag into nested modules', () => {
    expect(
      beliefsFromLegacyCosmic({
        sunSign: 'virgo',
        lifePath: 7,
        humanDesignType: 'projector',
      }),
    ).toEqual({
      western: { sun: 'virgo' },
      numerology: { lifePath: 7 },
      humanDesign: { type: 'projector' },
    })
    expect(hasBeliefModule(beliefsFromLegacyCosmic({}))).toBe(false)
  })
})

describe('cosmicFromBeliefs', () => {
  it('projects supplied leaves and omits absent ones', () => {
    expect(cosmicFromBeliefs({ western: { sun: 'leo' } })).toEqual({ sunSign: 'leo' })
    expect(
      cosmicFromBeliefs({
        western: { sun: 'virgo' },
        humanDesign: { type: 'projector', strategy: 'waitForInvitation' },
        bazi: { dayMaster: 'jia' },
      }),
    ).toEqual({
      sunSign: 'virgo',
      humanDesignType: 'projector',
    })
  })
})
