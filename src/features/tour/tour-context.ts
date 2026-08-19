import { createContext } from 'react'

export interface TourContextValue {
  active: boolean
  start: () => void
  skip: () => void
  complete: () => void
}

export const TourContext = createContext<TourContextValue | null>(null)
