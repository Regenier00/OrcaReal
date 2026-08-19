import { useState } from 'react'
import { UnitCostCard } from '@/components/indicators/UnitCostCard'
import { CreateIndicatorDialog } from '@/components/indicators/CreateIndicatorDialog'
import { useUnitCostCards } from '@/features/experience/useUnitCostCards'
import { useCompany } from '@/features/company/useCompany'
import { Button } from '@/components/ui/Button'
import type { ClassifiedActualSlice, LoadedActual } from '@/features/actual/model'
import type { BudgetMonth } from '@/features/budget/period'
import type { ComparisonMonthKey } from '@/features/comparison/model'

export function UnitCostSection({
  months,
  preferredMonth,
  actual,
  classified,
  allowCreate,
  creating,
  onCreatingChange,
}: {
  months?: BudgetMonth[]
  preferredMonth?: ComparisonMonthKey | string | null
  actual?: LoadedActual | null
  classified?: ClassifiedActualSlice[]
  allowCreate?: boolean
  creating?: boolean
  onCreatingChange?: (open: boolean) => void
}) {
  const { activeCompany, activeMembership } = useCompany()
  const data = useUnitCostCards({
    months,
    preferredMonth,
    actual,
    classified,
  })
  const [localCreating, setLocalCreating] = useState(false)
  const open = creating ?? localCreating
  const setOpen = onCreatingChange ?? setLocalCreating
  const canCreate =
    Boolean(allowCreate) &&
    Boolean(activeCompany) &&
    activeMembership?.role !== 'viewer'

  const catalogCards = data.cards.filter((card) => card.kind === 'catalog')
  const customCards = data.cards.filter((card) => card.kind === 'custom')
  const showCreateButton = canCreate && !onCreatingChange

  const dialog =
    open && activeCompany ? (
      <CreateIndicatorDialog
        open={open}
        companyId={activeCompany.id}
        customUnits={data.customUnits}
        preview={data.formulaContext}
        onClose={() => setOpen(false)}
        onCreated={() => data.reloadCustom()}
      />
    ) : null

  if (data.loading && data.cards.length === 0) {
    return (
      <div>
        <p className="text-sm text-mist">Carregando indicadores do ramo...</p>
        {dialog}
      </div>
    )
  }

  return (
    <section className="space-y-8">
      {data.error ? (
        <p className="rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {data.error}
        </p>
      ) : null}

      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-navy">
              Custo por unidade
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-mist">
              Unidades padrão do ramo. Clique no card e informe a quantidade do mês.
            </p>
          </div>
          {showCreateButton ? (
            <Button type="button" onClick={() => setOpen(true)}>
              Criar indicador
            </Button>
          ) : null}
        </div>
        {catalogCards.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {catalogCards.map((card) => (
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
        ) : (
          <p className="mt-3 text-sm text-mist">
            Sem unidade padrão para o ramo. Crie um indicador com a unidade da
            empresa.
          </p>
        )}
      </div>

      {customCards.length > 0 || canCreate ? (
        <div>
          <h2 className="font-display text-lg font-semibold text-navy">
            Indicadores da empresa
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-mist">
            Cálculo personalizado com receitas e custos realizados, mês a mês.
          </p>
          {customCards.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {customCards.map((card) => (
                <UnitCostCard
                  key={card.def.indicatorCode}
                  card={card}
                  months={data.months}
                  kicker="Personalizado"
                  saving={data.savingCode === card.def.indicatorCode}
                  onSave={(quantity, monthKey) =>
                    data.saveQuantity(card.def.indicatorCode, quantity, monthKey)
                  }
                  onDelete={
                    card.customId && canCreate
                      ? () => data.deleteCustom(card.customId as string)
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-mist">
              Nenhum indicador personalizado ainda.
            </p>
          )}
        </div>
      ) : null}
        {dialog}
    </section>
  )
}
