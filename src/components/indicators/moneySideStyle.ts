import { cn } from '@/lib/utils'
import type { MoneySide } from '@/features/indicators/formula'

export function moneySideCardClass(side: MoneySide | null | undefined, interactive = false) {
  return cn(
    side === 'revenue' && 'border-navy/20 bg-navy-soft',
    side === 'cost' && 'border-danger/20 bg-danger-soft',
    !side && 'border-paper-muted bg-white',
    interactive && 'hover:-translate-y-0.5 hover:shadow-soft',
    interactive && side === 'revenue' && 'hover:border-navy/35',
    interactive && side === 'cost' && 'hover:border-danger/35',
    interactive && !side && 'hover:border-navy/15'
  )
}

export function moneySideIconClass(side: MoneySide | null | undefined) {
  return cn(
    side === 'revenue' && 'bg-navy text-paper',
    side === 'cost' && 'bg-white text-danger',
    !side && 'bg-navy-soft text-navy'
  )
}
