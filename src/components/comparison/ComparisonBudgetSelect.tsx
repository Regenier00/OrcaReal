import { Link } from 'react-router-dom'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { LoadedBudget } from '@/features/budget/model'

interface ComparisonBudgetSelectProps {
  budgets: LoadedBudget[]
  value: string
  onChange: (budgetId: string) => void
  actualHref?: string | null
  createActualHref?: string | null
  hasActual?: boolean
}

export function ComparisonBudgetSelect({
  budgets,
  value,
  onChange,
  actualHref,
  createActualHref,
  hasActual,
}: ComparisonBudgetSelectProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <Select
          label="Orçamento vinculado"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {budgets.length === 0 ? (
            <option value="">Nenhum orçamento</option>
          ) : (
            budgets.map((budget) => (
              <option key={budget.id} value={budget.id}>
                {budget.name}
              </option>
            ))
          )}
        </Select>
      </div>
      {hasActual && actualHref ? (
        <Link to={actualHref}>
          <Button variant="secondary">Ver lançamentos</Button>
        </Link>
      ) : null}
      {!hasActual && createActualHref ? (
        <Link to={createActualHref}>
          <Button>Apropriar lançamentos</Button>
        </Link>
      ) : null}
    </div>
  )
}
