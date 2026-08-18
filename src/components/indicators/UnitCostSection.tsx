import { UnitCostCard } from '@/components/indicators/UnitCostCard'
import { useUnitCostCards } from '@/features/experience/useUnitCostCards'
import type { ClassifiedActualSlice, LoadedActual } from '@/features/actual/model'
import type { BudgetMonth } from '@/features/budget/period'

export function UnitCostSection({
  months,
  preferredMonth,
  actual,
  classified,
}: {
  months?: BudgetMonth[]
  preferredMonth?: string | null
  actual?: LoadedActual | null
  classified?: ClassifiedActualSlice[]
}) {
  const data = useUnitCostCards({
    months,
    preferredMonth,
    actual,
    classified,
  })

  if (data.loading && data.cards.length === 0) {
    return <p className="text-sm text-mist">Carregando indicadores do ramo...</p>
  }

  if (data.cards.length === 0) return null

  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-navy">
        Custo por unidade de operação
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-mist">
        A unidade vem do ramo da empresa. Clique no card, informe a quantidade do
        mês e o sistema divide o custo total realizado pelo volume da operação.
      </p>
      {data.error ? (
        <p className="mt-3 rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {data.error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.cards.map((card) => (
          <UnitCostCard
            key={card.def.indicatorCode}
            card={card}
            months={data.months}
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
