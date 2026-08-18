import { useMemo, useState } from 'react'
import {
  applyPersonnelCut,
  demoLines,
  groupCosts,
  totals,
  type MonthKey,
} from '@/content/demoCompany'
import { formatBRL, formatPct, formatSignedPct } from '@/lib/money'
import { MonthFilter } from '@/components/demo/MonthFilter'
import { Button } from '@/components/ui/Button'
import type { DemoGate } from '@/content/demoCompany'

interface IndicatorsPanelProps {
  month: MonthKey
  onMonthChange: (month: MonthKey) => void
  onGate: (gate: DemoGate) => void
  simulationsRemaining: number
  onSimulate: () => boolean
}

export function IndicatorsPanel({
  month,
  onMonthChange,
  onGate,
  simulationsRemaining,
  onSimulate,
}: IndicatorsPanelProps) {
  const [cut, setCut] = useState(8)
  const [appliedCut, setAppliedCut] = useState(0)

  const lines = useMemo(
    () => (appliedCut > 0 ? applyPersonnelCut(demoLines, appliedCut) : demoLines),
    [appliedCut]
  )
  const summary = useMemo(() => totals(lines, month), [lines, month])
  const concentration = useMemo(() => {
    const rows = groupCosts(lines, month, 'category')
    return rows.slice(0, 2).reduce((total, row) => total + row.share, 0)
  }, [lines, month])

  const handleApply = () => {
    if (!onSimulate()) {
      onGate('simulation')
      return
    }
    setAppliedCut(cut)
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Indicadores</h2>
          <p className="mt-1 max-w-xl text-sm text-ink-soft/70">
            A fórmula fica à vista. Consultar é livre; aplicar um cenário consome
            uma das duas simulações da demonstração.
          </p>
        </div>
        <MonthFilter value={month} onChange={onMonthChange} />
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Indicator
          label="Desvio orçamentário"
          hint="realizado − orçado"
          value={formatBRL(summary.variance)}
        />
        <Indicator
          label="Desvio orçamentário %"
          hint="(realizado − orçado) / orçado"
          value={formatSignedPct(summary.variancePct)}
        />
        <Indicator
          label="Concentração de custos"
          hint="dois maiores / custo total"
          value={formatPct(concentration)}
        />
      </dl>

      <div className="mt-6 rounded-2xl border border-paper-muted bg-white p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-mist">
          Simulação
        </p>
        <h3 className="mt-2 font-display text-lg font-semibold text-ink">
          E se o custo de pessoal cair {cut}%?
        </h3>
        <p className="mt-1 text-sm text-ink-soft/70">
          Aplica o corte só no realizado de Pessoal e recalcula o desvio. Não altera a
          empresa de exemplo de forma permanente.
        </p>

        <input
          type="range"
          min={2}
          max={20}
          step={1}
          value={cut}
          onChange={(event) => setCut(Number(event.target.value))}
          className="mt-5 w-full accent-navy"
          aria-label="Percentual de corte em pessoal"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={handleApply}>Aplicar no resultado</Button>
          <p className="text-xs text-mist">
            {appliedCut > 0
              ? `Cenário ativo: −${appliedCut}% em pessoal.`
              : 'Nenhum cenário aplicado ainda.'}{' '}
            {simulationsRemaining > 0
              ? `${simulationsRemaining} ${simulationsRemaining === 1 ? 'aplicação restante' : 'aplicações restantes'}.`
              : 'Limite da demonstração atingido.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function Indicator({
  label,
  hint,
  value,
}: {
  label: string
  hint: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-paper-muted bg-white px-4 py-4">
      <dt className="text-[11px] uppercase tracking-wide text-mist">{label}</dt>
      <dd className="mt-1 font-numeric text-xl font-semibold text-ink">{value}</dd>
      <p className="mt-2 font-mono text-[11px] text-mist">{hint}</p>
    </div>
  )
}
