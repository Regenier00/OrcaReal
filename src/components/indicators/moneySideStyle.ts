import { cn } from '@/lib/utils'
import type { MoneySide } from '@/features/indicators/formula'

export function moneySideCardClass(side: MoneySide | null | undefined, interactive = false) {
  return cn(
    'border border-paper-muted bg-white',
    side === 'revenue' && 'border-l-4 border-l-revenue',
    side === 'cost' && 'border-l-4 border-l-cost',
    interactive && 'hover:-translate-y-0.5 hover:shadow-soft',
    interactive && side === 'revenue' && 'hover:border-revenue hover:border-l-revenue',
    interactive && side === 'cost' && 'hover:border-cost hover:border-l-cost',
    interactive && !side && 'hover:border-brand/25'
  )
}

export function moneySideIconClass(side: MoneySide | null | undefined) {
  return cn(
    side === 'revenue' && 'bg-revenue text-ink',
    side === 'cost' && 'bg-cost text-ink',
    !side && 'bg-brand-soft text-brand'
  )
}

/** Faixa de título no estilo dashboard (ex.: card Orçado × Realizado). */
export function moneySideHeaderClass(side: MoneySide | null | undefined) {
  return cn(
    side === 'revenue' && 'bg-revenue text-ink',
    side === 'cost' && 'bg-cost text-ink',
    !side && 'bg-brand text-white'
  )
}
