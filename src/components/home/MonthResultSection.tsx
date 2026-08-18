import { OperationalIndicatorCard } from '@/components/indicators/OperationalIndicatorCard'
import { formatMoney } from '@/features/budget/money'
import { KpiCard } from '@/components/home/KpiCard'
import { SectionHeading } from '@/components/home/FinancialSummary'
import { WalletIcon } from '@/components/home/DashboardIcons'
import { useOperationalIndicators } from '@/features/experience/useOperationalIndicators'
import type { HomeDashboardData } from '@/features/experience/useUnitCostCards'

export function MonthResultSection({ data }: { data: HomeDashboardData }) {
  const operational = useOperationalIndicators(
    data.months.length > 0
      ? { months: data.months, preferredMonth: data.monthKey }
      : undefined
  )

  if (data.loading && data.cards.length === 0 && !data.currentFinancials && operational.loading) {
    return <p className="text-sm text-mist">Carregando o resultado do mês...</p>
  }

  return (
    <section>
      {data.error || operational.error ? (
        <p className="mb-3 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
          {data.error || operational.error}
        </p>
      ) : null}

      <SectionHeading
        kicker="Indicadores"
        title="Resultado operacional do mês"
        subtitle="O consolidado e os indicadores do modelo de operação, com variação frente ao mês anterior."
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          to="/app/orcado-realizado"
          kicker="Consolidado"
          title="Total realizado"
          value={formatMoney(data.totalCost)}
          hint={
            data.previousMonthLabel
              ? `Custos e despesas de ${data.monthLabel || 'mês atual'}`
              : 'Custos e despesas do mês'
          }
          change={data.costChange}
          invertChange
          icon={<WalletIcon />}
          tone="danger"
          surface="cost"
        />

        {operational.cards.map((card) => (
          <OperationalIndicatorCard
            key={card.def.code}
            card={card}
            saving={operational.savingCode === card.def.code}
            onSave={(values, monthKey) =>
              operational.saveInputs(card.def.code, values, monthKey)
            }
          />
        ))}
      </div>

      {operational.cards.length === 0 && !operational.loading ? (
        <p className="mt-3 text-sm text-mist">
          Nenhum indicador operacional selecionado. Escolha as informações no
          questionário ou no perfil da empresa.
        </p>
      ) : null}
    </section>
  )
}
