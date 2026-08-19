import { useContext } from 'react'
import { TourContext } from '@/features/tour/tour-context'

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) {
    throw new Error('useTour precisa estar dentro de TourProvider')
  }
  return ctx
}
