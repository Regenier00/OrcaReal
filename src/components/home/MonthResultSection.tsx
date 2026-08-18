import { Link } from 'react-router-dom'
import { UnitCostCard } from '@/components/indicators/UnitCostCard'
import { useUnitCostCards } from '@/features/experience/useUnitCostCards'
import { formatMoney } from '@/features/budget/money'
import { cn } from '@/lib/utils'

export function MonthResultSection() {
  const data = useUnitCostCards()

  if (data.loading && data.cards.length === 0) {
    return <p className="text-sm text-mist">Carregando o resultado do mês...</p>
  }

  return (
    <section>
      {data.error ? (
        <p className="mb-3 rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {data.error}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Link
          to="/app/orcado-realizado"
          className={cn(
            'flex w-full cursor-pointer flex-col rounded-2xl border border-paper-muted bg-white px-4 py-4 text-left transition',
            'hover:border-ink/20 hover:shadow-soft'
          )}
        >
          <p className="text-[11px] uppercase tracking-wide text-mist">
            Consolidado
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink">
            Total realizado consolidado
          </h3>
          <p className="mt-3 font-numeric text-2xl font-semibold text-ink">
            {formatMoney(data.totalCost)}
          </p>
          <p className="mt-1 text-sm text-mist">Custos e despesas do mês</p>
          <p className="mt-3 text-xs text-mist">
            Mês: {data.monthLabel || 'selecione no realizado'}
          </p>
        </Link>

        {data.cards.map((card) => (
          <UnitCostCard
            key={card.def.indicatorCode}
            card={card}
            months={data.months}
            kicker="Unidade de custo"
            saving={data.savingCode === card.def.indicatorCode}
            onSave={(quantity, monthKey) =>
              data.saveQuantity(card.def.indicatorCode, quantity, monthKey)
            }
          />
        ))}
      </div>
    </section>
  )
}
