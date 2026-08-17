import { formatMoney } from '@/features/budget/money'
import type { BudgetMonth } from '@/features/budget/period'
import { formatPeriodRange } from '@/features/budget/period'
import type { DraftBudget } from '@/features/budget/model'
import { grandTotal, monthTotal } from '@/features/budget/model'

interface BudgetSummaryBarProps {
  draft: DraftBudget
  months: BudgetMonth[]
  companyName?: string
  fallbackName?: string
  totalLabel?: string
}

export function BudgetSummaryBar({
  draft,
  months,
  companyName,
  fallbackName = 'Novo orçamento',
  totalLabel = 'Total orçado',
}: BudgetSummaryBarProps) {
  const total = grandTotal(draft.items, months)
  const currentMonthKey = months[0]?.key
  const firstMonthTotal = currentMonthKey
    ? monthTotal(draft.items, currentMonthKey)
    : 0

  return (
    <div className="rounded-2xl border border-paper-muted bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-mist">
            Editando
          </p>
          <h2 className="font-display text-2xl font-semibold text-ink">
            {draft.name.trim() || fallbackName}
          </h2>
          <p className="mt-1 text-sm text-mist">
            {draft.periodLabel} · {formatPeriodRange(draft.startDate, draft.endDate)}
            {companyName ? ` · ${companyName}` : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-mist">Itens</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {draft.items.length}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-mist">
              {months[0] ? months[0].label : 'Mês'}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {formatMoney(firstMonthTotal)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-mist">{totalLabel}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-navy">
              {formatMoney(total)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
