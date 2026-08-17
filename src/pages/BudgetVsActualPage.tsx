import { Link } from 'react-router-dom'
import { useComparisonData } from '@/features/comparison/useComparison'
import { Button } from '@/components/ui/Button'
import { CompanyRequired } from '@/components/company/CompanyRequired'
import { PeriodFilter } from '@/components/comparison/PeriodFilter'
import { ComparisonStats } from '@/components/comparison/ComparisonStats'
import { ComparisonBudgetSelect } from '@/components/comparison/ComparisonBudgetSelect'
import { VarianceTable } from '@/components/demo/VarianceTable'
import { cn } from '@/lib/utils'

export function BudgetVsActualPage() {
  const data = useComparisonData()

  if (!data.companyLoading && !data.company) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">
          Orçado × Realizado
        </h1>
        <div className="mt-6">
          <CompanyRequired message="A comparação usa o orçamento e o realizado da empresa ativa." />
        </div>
      </div>
    )
  }

  if (data.loading || data.companyLoading) {
    return <p className="text-sm text-mist">Carregando comparação...</p>
  }

  if (data.budgets.length === 0) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">
          Orçado × Realizado
        </h1>
        <div className="mt-8 rounded-2xl border border-dashed border-paper-muted bg-white px-6 py-12 text-center">
          <p className="font-display text-xl font-semibold text-ink">
            Crie um orçamento para comparar
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist">
            O vínculo Orçado × Realizado parte do plano. Depois você lança o
            realizado no mesmo recorte.
          </p>
          <Link to="/app/orcamentos/novo" className="mt-6 inline-block">
            <Button>Novo orçamento</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">
            Orçado × Realizado
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-mist">
            O desvio aparece no mesmo recorte do orçamento vinculado — período,
            departamento e centro de custo.
          </p>
        </div>
        <PeriodFilter months={data.months} value={data.month} onChange={data.setMonth} />
      </div>

      {data.error ? (
        <p className="rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {data.error}
        </p>
      ) : null}

      <ComparisonBudgetSelect
        budgets={data.budgets}
        value={data.selectedBudgetId}
        onChange={data.setBudgetId}
        hasActual={Boolean(data.pair?.actual)}
        actualHref={
          data.pair?.actual ? `/app/realizado/${data.pair.actual.id}` : null
        }
        createActualHref={
          data.selectedBudgetId
            ? `/app/realizado/novo?orcamento=${data.selectedBudgetId}`
            : '/app/realizado/novo'
        }
      />

      {!data.pair?.actual ? (
        <div className="rounded-2xl border border-dashed border-paper-muted bg-white px-5 py-6">
          <p className="font-display text-lg font-semibold text-ink">
            Este orçamento ainda não tem realizado
          </p>
          <p className="mt-1 max-w-xl text-sm text-mist">
            Lance o realizado com a mesma estrutura para fechar o vínculo e ver o
            desvio.
          </p>
        </div>
      ) : null}

      <ComparisonStats summary={data.summary} />

      <div className="flex flex-wrap gap-1.5">
        <GroupToggle
          active={data.groupBy === 'line'}
          label="Por linha"
          onClick={() => data.setGroupBy('line')}
        />
        <GroupToggle
          active={data.groupBy === 'department'}
          label="Por departamento"
          onClick={() => data.setGroupBy('department')}
        />
        <GroupToggle
          active={data.groupBy === 'costCenter'}
          label="Por centro de custo"
          onClick={() => data.setGroupBy('costCenter')}
        />
      </div>

      {data.rows.length === 0 ? (
        <p className="rounded-2xl border border-paper-muted bg-white px-5 py-8 text-center text-sm text-mist">
          Não há linhas para comparar neste recorte.
        </p>
      ) : (
        <VarianceTable rows={data.rows} />
      )}
    </div>
  )
}

function GroupToggle({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition',
        active
          ? 'border-ink/30 bg-ink text-paper'
          : 'border-paper-muted bg-white text-ink-soft/70 hover:border-ink/20'
      )}
    >
      {label}
    </button>
  )
}
