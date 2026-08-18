import { cn } from '@/lib/utils'
import type { MoneySide } from '@/features/indicators/formula'

export function moneySideCardClass(side: MoneySide | null | undefined, interactive = false) {
  return cn(
    side === 'revenue' && 'border-ok/20 bg-revenue-soft',
    side === 'cost' && 'border-warn/20 bg-cost-soft',
    !side && 'border-paper-muted bg-white',
    interactive && 'hover:-translate-y-0.5 hover:shadow-soft',
    interactive && side === 'revenue' && 'hover:border-ok/35',
    interactive && side === 'cost' && 'hover:border-warn/35',
    interactive && !side && 'hover:border-navy/15'
  )
}

export function moneySideIconClass(side: MoneySide | null | undefined) {
  return cn(
    side === 'revenue' && 'bg-ok-soft text-ok',
    side === 'cost' && 'bg-warn-soft text-warn',
    !side && 'bg-navy-soft text-navy'
  )
}
