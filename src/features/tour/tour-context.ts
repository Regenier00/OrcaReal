import { createContext } from 'react'
import type { TourStep } from '@/features/tour/steps'

export interface TourContextValue {
  active: boolean
  index: number
  step: TourStep
  pageMode: boolean
  stepNumber: number
  stepCount: number
  isLast: boolean
  nextLabel: string
  skipLabel: string
  start: () => void
  startPage: (pathname?: string) => void
  skip: () => void
  complete: () => void
  goNext: () => void
  goBack: () => void
}

export const TourContext = createContext<TourContextValue | null>(null)
