import { useState, type Dispatch, type SetStateAction } from 'react'
import {
  CHINESE_ELEMENTS,
  CHINESE_ZODIAC_ANIMALS,
  HUMAN_DESIGN_AUTHORITIES,
  HUMAN_DESIGN_PROFILES,
  HUMAN_DESIGN_TYPES,
  LIFE_PATH_NUMBERS,
  ZODIAC_SIGNS,
} from '../../domain/cosmic.ts'
import {
  HEAVENLY_STEMS,
  HUMAN_DESIGN_STRATEGIES,
  hasBeliefModule,
  patchBeliefLeaf,
  type BeliefLeaf,
  type ModularBeliefs,
} from '../../domain/profile.ts'
import type { AppAction } from '../../domain/loop.ts'

export type BeliefLensId =
  | 'western'
  | 'numerology'
  | 'chinese'
  | 'bazi'
  | 'humanDesign'

type LensOption = { id: string | number; label: string }

type LensField = {
  leaf: BeliefLeaf
  legend: string
  name: string
  options: readonly LensOption[]
  dense?: boolean
}

type BeliefLensRow = {
  id: BeliefLensId
  title: string
  blurb: string
  fields: readonly LensField[]
}

const ZODIAC_OPTIONS = ZODIAC_SIGNS.map((id) => ({
  id,
  label: titleLabel(id),
}))

const HD_TYPE_OPTIONS = HUMAN_DESIGN_TYPES.map((id) => ({
  id,
  label: titleLabel(id),
}))

const HD_AUTHORITY_OPTIONS = HUMAN_DESIGN_AUTHORITIES.map((id) => ({
  id,
  label: titleLabel(id),
}))

const HD_PROFILE_OPTIONS = HUMAN_DESIGN_PROFILES.map((id) => ({
  id,
  label: id,
}))

const HD_STRATEGY_OPTIONS = HUMAN_DESIGN_STRATEGIES.map((id) => ({
  id,
  label: titleLabel(id),
}))

const STEM_OPTIONS = HEAVENLY_STEMS.map((id) => ({
  id,
  label: titleLabel(id),
}))

const CORE_NUMBER_OPTIONS = LIFE_PATH_NUMBERS.map((id) => ({
  id,
  label: String(id),
}))

const ANIMAL_OPTIONS = CHINESE_ZODIAC_ANIMALS.map((id) => ({
  id,
  label: titleLabel(id),
}))

const ELEMENT_OPTIONS = CHINESE_ELEMENTS.map((id) => ({
  id,
  label: titleLabel(id),
}))

const BIRTHDAY_OPTIONS: readonly LensOption[] = Array.from(
  { length: 31 },
  (_, index) => {
    const id = index + 1
    return { id, label: String(id) }
  },
)

const BELIEF_LENS_CATALOG: readonly BeliefLensRow[] = [
  {
    id: 'western',
    title: 'Western Astrology',
    blurb: 'Sun, Moon, or Rising. Any one placement supplies this lens.',
    fields: [
      { leaf: 'sun', legend: 'Sun sign', name: 'sun', options: ZODIAC_OPTIONS },
      { leaf: 'moon', legend: 'Moon sign', name: 'moon', options: ZODIAC_OPTIONS },
      {
        leaf: 'rising',
        legend: 'Rising sign',
        name: 'rising',
        options: ZODIAC_OPTIONS,
      },
    ],
  },
  {
    id: 'numerology',
    title: 'Numerology',
    blurb: 'Life Path, Expression, Soul Urge, Personality, Maturity, or birthday number 1 to 31.',
    fields: [
      {
        leaf: 'lifePath',
        legend: 'Life Path',
        name: 'lifePath',
        options: CORE_NUMBER_OPTIONS,
      },
      {
        leaf: 'expression',
        legend: 'Expression',
        name: 'expression',
        options: CORE_NUMBER_OPTIONS,
      },
      {
        leaf: 'soulUrge',
        legend: 'Soul Urge',
        name: 'soulUrge',
        options: CORE_NUMBER_OPTIONS,
      },
      {
        leaf: 'personality',
        legend: 'Personality',
        name: 'personality',
        options: CORE_NUMBER_OPTIONS,
      },
      {
        leaf: 'maturity',
        legend: 'Maturity',
        name: 'maturity',
        options: CORE_NUMBER_OPTIONS,
      },
      {
        leaf: 'birthday',
        legend: 'Birthday number',
        name: 'birthday',
        options: BIRTHDAY_OPTIONS,
        dense: true,
      },
    ],
  },
  {
    id: 'chinese',
    title: 'Chinese Astrology',
    blurb: 'Animal and element. Either one supplies this lens.',
    fields: [
      {
        leaf: 'animal',
        legend: 'Chinese zodiac animal',
        name: 'animal',
        options: ANIMAL_OPTIONS,
      },
      {
        leaf: 'element',
        legend: 'Chinese element',
        name: 'element',
        options: ELEMENT_OPTIONS,
      },
    ],
  },
  {
    id: 'bazi',
    title: 'BaZi',
    blurb: 'Day Master supplies this lens.',
    fields: [
      {
        leaf: 'dayMaster',
        legend: 'BaZi Day Master',
        name: 'dayMaster',
        options: STEM_OPTIONS,
      },
    ],
  },
  {
    id: 'humanDesign',
    title: 'Human Design',
    blurb: 'Type supplies this lens. Strategy, authority, and profile are optional.',
    fields: [
      {
        leaf: 'hdType',
        legend: 'Human Design type',
        name: 'hdType',
        options: HD_TYPE_OPTIONS,
      },
      {
        leaf: 'hdStrategy',
        legend: 'Human Design strategy (optional)',
        name: 'hdStrategy',
        options: HD_STRATEGY_OPTIONS,
      },
      {
        leaf: 'hdAuthority',
        legend: 'Human Design authority (optional)',
        name: 'hdAuthority',
        options: HD_AUTHORITY_OPTIONS,
      },
      {
        leaf: 'hdProfile',
        legend: 'Human Design profile (optional)',
        name: 'hdProfile',
        options: HD_PROFILE_OPTIONS,
      },
    ],
  },
]

export function CosmicFields({
  beliefs,
  dispatch,
}: {
  beliefs: ModularBeliefs
  dispatch: Dispatch<AppAction>
}) {
  const [pendingLenses, setPendingLenses] = useState<ReadonlySet<BeliefLensId>>(
    () => new Set(),
  )
  const selectedIds = selectedLensIds(beliefs, pendingLenses)
  const selectedRows = BELIEF_LENS_CATALOG.filter((row) => selectedIds.has(row.id))
  const activeRows = BELIEF_LENS_CATALOG.filter(
    (row) => beliefs[row.id] !== undefined,
  )

  return (
    <fieldset className="lens-catalog">
      <legend>Belief-system lenses (required)</legend>
      <p>
        Check each lens you already know. At least one self-supplied value is
        required to continue. Fields appear only for selected lenses. Unchecking
        a lens clears its values. The app never infers a value from a birth date.
      </p>
      {BELIEF_LENS_CATALOG.map((row) => {
        const selected = selectedIds.has(row.id)
        return (
          <article
            key={row.id}
            className={selected ? 'lens-card is-selected' : 'lens-card'}
          >
            <label className="lens-card-head">
              <input
                type="checkbox"
                checked={selected}
                onChange={(event) =>
                  toggleLens(
                    row.id,
                    event.target.checked,
                    beliefs,
                    dispatch,
                    setPendingLenses,
                  )
                }
              />
              <span className="lens-card-copy">
                <span className="choice-card-title">{row.title}</span>
                <span className="choice-chip-hint">{row.blurb}</span>
                <span className="lens-card-action">Use this lens</span>
              </span>
            </label>
            {selected ? (
              <div className="lens-card-fields">
                {row.fields.map((field) => (
                  <EnumField
                    key={field.name}
                    legend={field.legend}
                    name={field.name}
                    value={leafValue(beliefs, field.leaf)}
                    options={field.options}
                    dense={field.dense}
                    onChange={(value) =>
                      setLeaf(dispatch, beliefs, field.leaf, value)
                    }
                  />
                ))}
              </div>
            ) : null}
          </article>
        )
      })}
      <p className="lens-summary">
        {lensSummary(selectedRows, activeRows, hasBeliefModule(beliefs))}
      </p>
    </fieldset>
  )
}

function selectedLensIds(
  beliefs: ModularBeliefs,
  pending: ReadonlySet<BeliefLensId>,
): ReadonlySet<BeliefLensId> {
  const selected = new Set(pending)
  for (const row of BELIEF_LENS_CATALOG) {
    if (beliefs[row.id] !== undefined) {
      selected.add(row.id)
    }
  }
  return selected
}

function toggleLens(
  id: BeliefLensId,
  on: boolean,
  beliefs: ModularBeliefs,
  dispatch: Dispatch<AppAction>,
  setPendingLenses: Dispatch<SetStateAction<ReadonlySet<BeliefLensId>>>,
) {
  setPendingLenses((current) => {
    const next = new Set(current)
    if (on) {
      next.add(id)
    } else {
      next.delete(id)
    }
    return next
  })
  if (on || beliefs[id] === undefined) {
    return
  }
  const nextBeliefs: ModularBeliefs = { ...beliefs }
  delete nextBeliefs[id]
  dispatch({ type: 'SET_BELIEFS', beliefs: nextBeliefs })
}

function lensSummary(
  selectedRows: readonly BeliefLensRow[],
  activeRows: readonly BeliefLensRow[],
  hasModule: boolean,
): string {
  if (selectedRows.length === 0) {
    return 'No lenses selected.'
  }
  const selectedTitles = selectedRows.map((row) => row.title).join(', ')
  if (!hasModule) {
    return `Selected lenses: ${selectedTitles}. Enter at least one self-supplied value.`
  }
  const activeTitles = activeRows.map((row) => row.title).join(', ')
  return `Active lenses: ${activeTitles}. Selected: ${selectedTitles}.`
}

function leafValue(
  beliefs: ModularBeliefs,
  leaf: BeliefLeaf,
): string | number | undefined {
  switch (leaf) {
    case 'sun':
      return beliefs.western?.sun
    case 'moon':
      return beliefs.western?.moon
    case 'rising':
      return beliefs.western?.rising
    case 'lifePath':
      return beliefs.numerology?.lifePath
    case 'expression':
      return beliefs.numerology?.expression
    case 'soulUrge':
      return beliefs.numerology?.soulUrge
    case 'personality':
      return beliefs.numerology?.personality
    case 'maturity':
      return beliefs.numerology?.maturity
    case 'birthday':
      return beliefs.numerology?.birthday
    case 'animal':
      return beliefs.chinese?.animal
    case 'element':
      return beliefs.chinese?.element
    case 'dayMaster':
      return beliefs.bazi?.dayMaster
    case 'hdType':
      return beliefs.humanDesign?.type
    case 'hdStrategy':
      return beliefs.humanDesign?.strategy
    case 'hdAuthority':
      return beliefs.humanDesign?.authority
    case 'hdProfile':
      return beliefs.humanDesign?.profile
    default: {
      const _exhaustive: never = leaf
      return _exhaustive
    }
  }
}

function EnumField<T extends string | number>({
  legend,
  name,
  value,
  options,
  dense,
  onChange,
}: {
  legend: string
  name: string
  value: T | undefined
  options: readonly { id: T; label: string }[]
  dense?: boolean
  onChange: (next: T | undefined) => void
}) {
  return (
    <fieldset className={dense === true ? 'picker-row picker-dense' : 'picker-row'}>
      <legend>{legend}</legend>
      <NotProvidedChip
        name={name}
        selected={value === undefined}
        onSelect={() => onChange(undefined)}
      />
      {options.map((option) => (
        <Chip
          key={String(option.id)}
          name={name}
          option={option}
          selected={value === option.id}
          onSelect={() => onChange(option.id)}
        />
      ))}
    </fieldset>
  )
}

function NotProvidedChip({
  name,
  selected,
  onSelect,
}: {
  name: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <label className={selected ? 'choice-chip is-selected' : 'choice-chip'}>
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
      />
      <span className="choice-chip-title">Not provided</span>
    </label>
  )
}

function Chip<T extends string | number>({
  name,
  option,
  selected,
  onSelect,
}: {
  name: string
  option: { id: T; label: string }
  selected: boolean
  onSelect: () => void
}) {
  return (
    <label className={selected ? 'choice-chip is-selected' : 'choice-chip'}>
      <input
        type="radio"
        name={name}
        value={String(option.id)}
        checked={selected}
        onChange={onSelect}
      />
      <span className="choice-chip-title">{option.label}</span>
    </label>
  )
}

function setLeaf(
  dispatch: Dispatch<AppAction>,
  beliefs: ModularBeliefs,
  leaf: BeliefLeaf,
  value: unknown,
) {
  const next = patchBeliefLeaf(beliefs, leaf, value)
  if (next === null) {
    return
  }
  dispatch({ type: 'SET_BELIEFS', beliefs: next })
}

function titleLabel(id: string): string {
  return id
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase())
}
