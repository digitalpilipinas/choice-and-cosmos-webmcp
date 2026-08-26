import type { HorizonDefinition, HorizonId } from '../domain/types.ts'

const daily: HorizonDefinition = {
  id: 'daily',
  label: 'Signal',
  tagline: 'One short window. One move you can actually make.',
  windowDescription: 'Today into tomorrow morning',
}

const weekly: HorizonDefinition = {
  id: 'weekly',
  label: 'Compass',
  tagline: 'A seven-day bearing you can steer, not a script to obey.',
  windowDescription: 'This week through the coming weekend',
}

const yearly: HorizonDefinition = {
  id: 'yearly',
  label: 'Constellation',
  tagline: 'A slow pattern across the year, held lightly in your hands.',
  windowDescription: 'This calendar year as a long arc',
}

export const HORIZON_BY_ID: Record<HorizonId, HorizonDefinition> = {
  daily,
  weekly,
  yearly,
}

export const HORIZONS: readonly HorizonDefinition[] = [daily, weekly, yearly]
