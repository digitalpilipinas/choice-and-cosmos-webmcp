import type { Dispatch } from 'react'
import type { AppAction } from '../../domain/loop.ts'
import type { AppState } from '../../domain/types.ts'

export interface PhaseProps {
  state: AppState
  dispatch: Dispatch<AppAction>
}
