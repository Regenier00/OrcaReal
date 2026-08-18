import { UnitCostCard } from '@/components/indicators/UnitCostCard'
import { formatMoney } from '@/features/budget/money'
import { KpiCard } from '@/components/home/KpiCard'
import { SectionHeading } from '@/components/home/FinancialSummary'
import { WalletIcon } from '@/components/home/DashboardIcons'
import type { HomeDashboardData } from '@/features/experience/useUnitCostCards'

export function MonthResultSection({ data }: { data: HomeDashboardData }) {
  if (data.loading && data.cards.length === 0 && !data.currentFinancials) {
    return <p className="text-sm text-mist">Carregando o resultado do mês...</p>
  }

  return (
    <section>
      {data.error ? (
        <p className="mb-3 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
          {data.error}
        </p>
      ) : null}

      <SectionHeading
        kicker="Indicadores"
        title="Resultado operacional do mês"
        subtitle="O consolidado e os indicadores por unidade, com variação frente ao mês anterior."
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
          tone="warn"
          surface="cost"
        />

        {data.cards.map((card) => (
          <UnitCostCard
            key={card.def.indicatorCode}
            card={card}
            months={data.months}
            kicker={card.kind === 'custom' ? 'Personalizado' : 'Unidade de custo'}
            saving={data.savingCode === card.def.indicatorCode}
            onSave={(quantity, monthKey) =>
              data.saveQuantity(card.def.indicatorCode, quantity, monthKey)
            }
          />
        ))}
      </div>

      {data.cards.length === 0 && !data.loading ? (
        <p className="mt-3 text-sm text-mist">
          Sem unidade de custo para o ramo. Você ainda pode acompanhar o consolidado em
          Orçado × Realizado.
        </p>
      ) : null}
    </section>
  )
}
