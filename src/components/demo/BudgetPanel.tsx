import { demoLines, sliceByMonth, type MonthKey } from '@/content/demoCompany'
import { formatBRL } from '@/lib/money'
import { MonthFilter } from '@/components/demo/MonthFilter'
import { Button } from '@/components/ui/Button'
import type { DemoGate } from '@/content/demoCompany'

interface BudgetPanelProps {
  month: MonthKey
  onMonthChange: (month: MonthKey) => void
  onGate: (gate: DemoGate) => void
}

export function BudgetPanel({ month, onMonthChange, onGate }: BudgetPanelProps) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Orçamento</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-soft/70">
            Estrutura padronizada em departamento, centro de custo e categoria. Na
            demonstração você só consulta — importar ou editar pede conta.
          </p>
        </div>
        <MonthFilter value={month} onChange={onMonthChange} />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-paper-muted">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper text-[11px] uppercase tracking-wide text-mist">
            <tr>
              <th className="px-4 py-2.5 font-medium">Departamento</th>
              <th className="px-4 py-2.5 font-medium">Centro de custo</th>
              <th className="px-4 py-2.5 font-medium">Categoria</th>
              <th className="px-4 py-2.5 text-right font-medium">Orçado</th>
            </tr>
          </thead>
          <tbody>
            {demoLines.map((line) => (
              <tr
                key={`${line.department}-${line.costCenter}-${line.category}`}
                className="border-t border-paper-muted bg-white"
              >
                <td className="px-4 py-3 text-ink">{line.department}</td>
                <td className="px-4 py-3 text-ink-soft/80">{line.costCenter}</td>
                <td className="px-4 py-3 text-ink-soft/80">{line.category}</td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">
                  {formatBRL(sliceByMonth(line.budget, month))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={() => onGate('import')}>Importar minha planilha</Button>
        <Button variant="secondary" onClick={() => onGate('save')}>
          Editar valores
        </Button>
      </div>
    </div>
  )
}
