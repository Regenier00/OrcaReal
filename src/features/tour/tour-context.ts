import { createContext } from 'react'
import type { TourStep } from '@/features/tour/steps'

export interface TourContextValue {
  active: boolean
  index: number
  step: TourStep
  start: () => void
  skip: () => void
  complete: () => void
  goNext: () => void
  goBack: () => void
}

export const TourContext = createContext<TourContextValue | null>(null)
