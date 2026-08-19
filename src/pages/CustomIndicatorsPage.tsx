import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useComparisonData } from '@/features/comparison/useComparison'
import { listSystemIndicators } from '@/features/comparison/comparisonService'
import { formatMoney } from '@/features/budget/money'
import { formatPct, formatSignedPct } from '@/lib/money'
import { Button } from '@/components/ui/Button'
import { CompanyRequired } from '@/components/company/CompanyRequired'
import { IndicatorPeriodFilter } from '@/components/indicators/IndicatorPeriodFilter'
import { ComparisonBudgetSelect } from '@/components/comparison/ComparisonBudgetSelect'
import { UnitCostSection } from '@/components/indicators/UnitCostSection'
import { IndicatorsSubnav } from '@/components/indicators/IndicatorsSubnav'
import { moneySideCardClass } from '@/components/indicators/moneySideStyle'
import { FormulaChip } from '@/components/indicators/FormulaChip'
import { useCompany } from '@/features/company/useCompany'
import { cn } from '@/lib/utils'
import type { SystemIndicator } from '@/types/database'
import type { MoneySide } from '@/features/indicators/formula'

export function CustomIndicatorsPage() {
  const data = useComparisonData()
  const { activeMembership } = useCompany()
  const [indicators, setIndicators] = useState<SystemIndicator[]>([])
  const [creating, setCreating] = useState(false)
  const canCreate = activeMembership?.role !== 'viewer'

  useEffect(() => {
    let mounted = true
    void listSystemIndicators().then((items) => {
      if (mounted) setIndicators(items)
    })
    return () => {
      mounted = false
    }
  }, [])

  const byCode = (code: string) => indicators.find((item) => item.code === code)

  if (!data.companyLoading && !data.company) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">
          Indicadores personalizados
        </h1>
        <IndicatorsSubnav />
        <div className="mt-6">
          <CompanyRequired message="Os indicadores usam o orçamento e o realizado da empresa ativa." />
        </div>
      </div>
    )
  }

  if (data.loading || data.companyLoading) {
    return <p className="text-sm text-mist">Carregando indicadores...</p>
  }

  if (data.budgets.length === 0) {
    return (
      <div className="flex flex-col gap-6" data-tour="indicators">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">
              Indicadores personalizados
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-mist">
              O custo por unidade vem do ramo da empresa. Crie indicadores com
              unidades da empresa e um cálculo só com o realizado: receitas e custos
              separados, mês a mês.
            </p>
          </div>
          {canCreate ? (
            <Button type="button" onClick={() => setCreating(true)}>
              Criar indicador
            </Button>
          ) : null}
        </div>
        <IndicatorsSubnav />
        <UnitCostSection
          allowCreate
          creating={creating}
          onCreatingChange={setCreating}
        />
        <div className="rounded-2xl border border-dashed border-paper-muted bg-white px-6 py-12 text-center">
          <p className="font-display text-xl font-semibold text-ink">
            Sem orçamento para os demais indicadores
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist">
            Crie um orçamento e aproprie os lançamentos do extrato para ver
            desvio e concentração com a fórmula à vista.
          </p>
          <Link to="/app/orcamentos/novo" className="mt-6 inline-block">
            <Button>Novo orçamento</Button>
          </Link>
        </div>
      </div>
    )
  }

  const variance = byCode('budget_variance')
  const variancePct = byCode('budget_variance_pct')
  const concentration = byCode('cost_concentration')

  return (
    <div className="flex flex-col gap-6" data-tour="indicators">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">
            Indicadores personalizados
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-mist">
            A unidade de operação vem do ramo, e você também pode criar unidades
            da empresa. O cálculo personalizado usa só o realizado: receitas e
            custos separados, mês a mês. A fórmula de cada
            indicador fica visível no card.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canCreate ? (
            <Button type="button" onClick={() => setCreating(true)}>
              Criar indicador
            </Button>
          ) : null}
        </div>
      </div>

      <IndicatorsSubnav />

      {data.months.length > 0 ? (
        <IndicatorPeriodFilter
          months={data.months}
          value={data.month}
          onChange={data.setMonth}
        />
      ) : null}

      {data.error ? (
        <p className="rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {data.error}
        </p>
      ) : null}

      <ComparisonBudgetSelect
        budgets={data.budgets}
        value={data.selectedBudgetId}
        onChange={data.setBudgetId}
        hasActual={data.hasClassifiedOrActual}
        actualHref="/app/realizado/nao-apropriados"
        createActualHref="/app/realizado/nao-apropriados"
      />

      {!data.hasRealized ? (
        <p className="rounded-xl border border-paper-muted bg-white px-4 py-3 text-sm text-mist">
          Sem saídas apropriadas, o desvio considera realizado zero. As entradas
          entram na receita e nos demais indicadores; apropie as saídas para ver
          o desvio completo.
        </p>
      ) : null}

      <UnitCostSection
        allowCreate
        creating={creating}
        onCreatingChange={setCreating}
        months={data.months}
        preferredMonth={data.month}
        actual={data.pair?.actual ?? null}
        classified={data.pair?.classifiedActuals ?? []}
      />

      <dl className="grid gap-3 sm:grid-cols-3">
        <IndicatorCard
          label={variance?.name ?? 'Desvio orçamentário'}
          hint={variance?.formula_hint ?? 'realizado − orçado'}
          value={formatMoney(data.summary.variance)}
          surface="cost"
        />
        <IndicatorCard
          label={variancePct?.name ?? 'Desvio orçamentário %'}
          hint={variancePct?.formula_hint ?? '(realizado − orçado) / orçado'}
          value={formatSignedPct(data.summary.variancePct)}
          surface="cost"
        />
        <IndicatorCard
          label={concentration?.name ?? 'Concentração de custos'}
          hint={concentration?.formula_hint ?? 'dois maiores / custo total'}
          value={formatPct(data.concentration)}
          surface="cost"
        />
      </dl>

      <div className="rounded-2xl border border-paper-muted bg-white p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-mist">
          Simulação
        </p>
        <h3 className="mt-2 font-display text-lg font-semibold text-ink">
          E se o realizado cair {data.cut}%?
        </h3>
        <p className="mt-1 text-sm text-ink-soft/70">
          Aplica o corte em todas as linhas do realizado e recalcula o desvio. Não
          altera os lançamentos salvos.
        </p>

        <input
          type="range"
          min={2}
          max={20}
          step={1}
          value={data.cut}
          onChange={(event) => data.setCut(Number(event.target.value))}
          className="mt-5 w-full accent-navy"
          aria-label="Percentual de corte no realizado"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={data.applySimulation}>Aplicar no resultado</Button>
          {data.appliedCut > 0 ? (
            <Button variant="secondary" onClick={data.clearSimulation}>
              Remover cenário
            </Button>
          ) : null}
          <p className="text-xs text-mist">
            {data.appliedCut > 0
              ? `Cenário ativo: −${data.appliedCut}% no realizado.`
              : 'Nenhum cenário aplicado ainda.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function IndicatorCard({
  label,
  hint,
  value,
  surface = null,
}: {
  label: string
  hint: string
  value: string
  surface?: MoneySide | null
}) {
  return (
    <div className={cn('rounded-2xl border px-4 py-4', moneySideCardClass(surface))}>
      <dt className="text-[11px] uppercase tracking-wide text-mist">{label}</dt>
      <dd className="mt-1 font-numeric text-xl font-semibold text-ink">{value}</dd>
      <FormulaChip name={label} formula={hint} />
    </div>
  )
}
