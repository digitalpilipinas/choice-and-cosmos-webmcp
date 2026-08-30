import { useState, type Dispatch } from 'react'
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
  patchBeliefLeaf,
  type BeliefLeaf,
  type ModularBeliefs,
} from '../../domain/profile.ts'
import type { AppAction } from '../../domain/loop.ts'

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

export function CosmicFields({
  beliefs,
  dispatch,
}: {
  beliefs: ModularBeliefs
  dispatch: Dispatch<AppAction>
}) {
  return (
    <>
      <p>
        At least one self-supplied belief-system module is needed later for
        personalized research. This legacy fixture loop still continues without
        one. The app never infers a value from a birth date.
      </p>
      <EnumField
        legend="Sun sign"
        name="sun"
        value={beliefs.western?.sun}
        options={ZODIAC_OPTIONS}
        onChange={(value) => setLeaf(dispatch, beliefs, 'sun', value)}
      />

      <OptionalCosmicDetails beliefs={beliefs} dispatch={dispatch} />
    </>
  )
}

function OptionalCosmicDetails({
  beliefs,
  dispatch,
}: {
  beliefs: ModularBeliefs
  dispatch: Dispatch<AppAction>
}) {
  const [open, setOpen] = useState(false)

  return (
    <details
      className="report-section"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="report-title">Optional cosmic details</span>
        <span className="report-lens">Entered by you, never inferred</span>
      </summary>
      {open ? (
        <>
          <EnumField
            legend="Moon sign"
            name="moon"
            value={beliefs.western?.moon}
            options={ZODIAC_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'moon', value)}
          />
          <EnumField
            legend="Rising sign"
            name="rising"
            value={beliefs.western?.rising}
            options={ZODIAC_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'rising', value)}
          />
          <EnumField
            legend="Human Design type"
            name="hdType"
            value={beliefs.humanDesign?.type}
            options={HD_TYPE_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'hdType', value)}
          />
          <EnumField
            legend="Human Design strategy"
            name="hdStrategy"
            value={beliefs.humanDesign?.strategy}
            options={HD_STRATEGY_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'hdStrategy', value)}
          />
          <EnumField
            legend="Human Design authority"
            name="hdAuthority"
            value={beliefs.humanDesign?.authority}
            options={HD_AUTHORITY_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'hdAuthority', value)}
          />
          <EnumField
            legend="Human Design profile"
            name="hdProfile"
            value={beliefs.humanDesign?.profile}
            options={HD_PROFILE_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'hdProfile', value)}
          />
          <EnumField
            legend="Life Path"
            name="lifePath"
            value={beliefs.numerology?.lifePath}
            options={CORE_NUMBER_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'lifePath', value)}
          />
          <EnumField
            legend="Expression"
            name="expression"
            value={beliefs.numerology?.expression}
            options={CORE_NUMBER_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'expression', value)}
          />
          <EnumField
            legend="Soul Urge"
            name="soulUrge"
            value={beliefs.numerology?.soulUrge}
            options={CORE_NUMBER_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'soulUrge', value)}
          />
          <EnumField
            legend="Personality"
            name="personality"
            value={beliefs.numerology?.personality}
            options={CORE_NUMBER_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'personality', value)}
          />
          <EnumField
            legend="Maturity"
            name="maturity"
            value={beliefs.numerology?.maturity}
            options={CORE_NUMBER_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'maturity', value)}
          />
          <EnumField
            legend="Chinese zodiac animal"
            name="animal"
            value={beliefs.chinese?.animal}
            options={ANIMAL_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'animal', value)}
          />
          <EnumField
            legend="Chinese element"
            name="element"
            value={beliefs.chinese?.element}
            options={ELEMENT_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'element', value)}
          />
          <EnumField
            legend="BaZi Day Master"
            name="dayMaster"
            value={beliefs.bazi?.dayMaster}
            options={STEM_OPTIONS}
            onChange={(value) => setLeaf(dispatch, beliefs, 'dayMaster', value)}
          />
        </>
      ) : null}
    </details>
  )
}

function EnumField<T extends string | number>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string
  name: string
  value: T | undefined
  options: readonly { id: T; label: string }[]
  onChange: (next: T | undefined) => void
}) {
  return (
    <fieldset className="picker-row">
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