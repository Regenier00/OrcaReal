import { cn } from '@/lib/utils'
import { formatBRL, formatSignedPct, sum } from '@/lib/money'

interface VarianceRow {
  key?: string
  label: string
  detail?: string
  budget: number
  actual: number
}

interface VarianceTableProps {
  rows: VarianceRow[]
  className?: string
}

function VarianceAmount({
  variance,
  budget,
  emphasize,
}: {
  variance: number
  budget: number
  emphasize?: boolean
}) {
  const over = variance > 0
  return (
    <td
      className={cn(
        'px-4 py-3 text-right tabular-nums',
        emphasize && 'font-semibold',
        over ? 'text-danger' : 'text-ok'
      )}
    >
      {formatBRL(variance)}
      <span className="ml-1 text-xs opacity-70">
        {formatSignedPct(budget === 0 ? Number.NaN : variance / budget)}
      </span>
    </td>
  )
}

export function VarianceTable({ rows, className }: VarianceTableProps) {
  const totalBudget = sum(rows.map((row) => row.budget))
  const totalActual = sum(rows.map((row) => row.actual))

  return (
    <div className={cn('overflow-hidden rounded-xl border border-paper-muted', className)}>
      <table className="w-full text-left text-sm">
        <thead className="bg-paper text-[11px] uppercase tracking-wide text-mist">
          <tr>
            <th className="px-4 py-2.5 font-medium">Recorte</th>
            <th className="px-4 py-2.5 text-right font-medium">Orçado</th>
            <th className="px-4 py-2.5 text-right font-medium">Realizado</th>
            <th className="px-4 py-2.5 text-right font-medium">Desvio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const variance = row.actual - row.budget
            return (
              <tr key={row.key ?? row.label} className="border-t border-paper-muted bg-white">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{row.label}</p>
                  {row.detail ? <p className="text-xs text-mist">{row.detail}</p> : null}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink-soft/80">
                  {formatBRL(row.budget)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">
                  {formatBRL(row.actual)}
                </td>
                <VarianceAmount variance={variance} budget={row.budget} />
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink/15 bg-paper">
            <td className="px-4 py-3 font-semibold text-ink">Total</td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
              {formatBRL(totalBudget)}
            </td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
              {formatBRL(totalActual)}
            </td>
            <VarianceAmount
              variance={totalActual - totalBudget}
              budget={totalBudget}
              emphasize
            />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
