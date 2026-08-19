import { pageTourStepIndices, PAGE_TOUR_TRIGGER_LABEL } from '@/features/tour/steps'
import { useTour } from '@/features/tour/useTour'
import { useLocation } from 'react-router-dom'

export function PageTourButton() {
  const { pathname } = useLocation()
  const { active, startPage } = useTour()
  const hasTour = pageTourStepIndices(pathname).length > 0

  if (active || !hasTour) return null

  return (
    <div className="mt-12 flex justify-center border-t border-paper-muted pt-6">
      <button
        type="button"
        onClick={() => startPage(pathname)}
        className="rounded-full border border-paper-muted bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft/70 transition hover:border-navy/25 hover:text-navy"
      >
        {PAGE_TOUR_TRIGGER_LABEL}
      </button>
    </div>
  )
}
