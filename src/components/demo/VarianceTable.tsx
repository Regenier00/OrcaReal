import { cn } from '@/lib/utils'
import { formatBRL, formatSignedPct } from '@/lib/money'

interface VarianceRow {
  label: string
  detail?: string
  budget: number
  actual: number
}

interface VarianceTableProps {
  rows: VarianceRow[]
  className?: string
}

export function VarianceTable({ rows, className }: VarianceTableProps) {
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
            const over = variance > 0
            return (
              <tr key={row.label} className="border-t border-paper-muted bg-white">
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
                <td
                  className={cn(
                    'px-4 py-3 text-right tabular-nums',
                    over ? 'text-danger' : 'text-ok'
                  )}
                >
                  {formatBRL(variance)}
                  <span className="ml-1 text-xs opacity-70">
                    {formatSignedPct(row.budget === 0 ? 0 : variance / row.budget)}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
