import type { BudgetMonth } from '@/features/budget/period'
import type { DraftBudgetItem } from '@/features/budget/model'
import {
  grandTotal,
  isDestinationItem,
  itemGroupLabel,
  lineTotal,
  monthTotal,
} from '@/features/budget/model'
import { formatMoney } from '@/features/budget/money'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface StructureLabels {
  businessUnit: (id: string) => string
  department: (id: string) => string
  costCenter: (id: string) => string
}

interface BudgetItemsTableProps {
  items: DraftBudgetItem[]
  months: BudgetMonth[]
  labels: StructureLabels
  readOnly?: boolean
  emptyMessage?: string
  totalLabel?: string
  onEdit?: (localId: string) => void
  onDuplicate?: (localId: string) => void
  onDelete?: (localId: string) => void
}

export function BudgetItemsTable({
  items,
  months,
  labels,
  readOnly,
  emptyMessage,
  totalLabel = 'Total do orçamento',
  onEdit,
  onDuplicate,
  onDelete,
}: BudgetItemsTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-paper-muted bg-white px-5 py-10 text-center text-sm text-mist">
        {emptyMessage ??
          'Nenhum destino neste orçamento. Defina os grupos e crie destinos para começar.'}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-paper-muted bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-paper text-[11px] uppercase tracking-wide text-mist">
          <tr>
            <th className="sticky left-0 z-10 bg-paper px-3 py-2.5 font-medium">
              Destino
            </th>
            {months.map((month) => (
              <th key={month.key} className="px-3 py-2.5 text-right font-medium">
                {month.label}/{String(month.year).slice(2)}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-medium">Total</th>
            {!readOnly ? (
              <th className="px-3 py-2.5 text-right font-medium">Ações</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.localId} className="border-t border-paper-muted">
              <td className="sticky left-0 z-10 bg-white px-3 py-3 align-top">
                {isDestinationItem(item) ? (
                  <>
                    <p className="font-medium text-ink">{item.destinationName}</p>
                    <p className="mt-0.5 text-xs text-mist">
                      {itemGroupLabel(item)}
                      {item.isDetailed || (item.accounts?.length ?? 0) > 0
                        ? ' · detalhado por conta'
                        : ''}
                    </p>
                    {(item.accounts?.length ?? 0) > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-[11px] text-mist">
                        {item.accounts!.map((account) => (
                          <li key={account.localId}>
                            {account.accountCode} — {account.accountName}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="font-medium text-ink">
                      {labels.department(item.departmentId) || 'Departamento'}
                    </p>
                    <p className="mt-0.5 text-xs text-mist">
                      {[
                        labels.businessUnit(item.businessUnitId),
                        labels.costCenter(item.costCenterId),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </>
                )}
              </td>
              {months.map((month) => (
                <td
                  key={month.key}
                  className="px-3 py-3 text-right tabular-nums text-ink-soft/80"
                >
                  {formatMoney(item.amounts[month.key] ?? 0)}
                </td>
              ))}
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-ink">
                {formatMoney(lineTotal(item, months))}
              </td>
              {!readOnly ? (
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      className="!px-2.5 !py-1.5 !text-xs"
                      onClick={() => onEdit?.(item.localId)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="!px-2.5 !py-1.5 !text-xs"
                      onClick={() => onDuplicate?.(item.localId)}
                    >
                      Duplicar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="!px-2.5 !py-1.5 !text-xs text-danger"
                      onClick={() => onDelete?.(item.localId)}
                    >
                      Excluir
                    </Button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-paper-muted bg-paper">
            <td className="sticky left-0 z-10 bg-paper px-3 py-3 font-semibold text-ink">
              {totalLabel}
            </td>
            {months.map((month) => (
              <td
                key={month.key}
                className="px-3 py-3 text-right font-semibold tabular-nums text-ink"
              >
                {formatMoney(monthTotal(items, month.key))}
              </td>
            ))}
            <td
              className={cn(
                'px-3 py-3 text-right font-bold tabular-nums text-navy'
              )}
            >
              {formatMoney(grandTotal(items, months))}
            </td>
            {!readOnly ? <td /> : null}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
