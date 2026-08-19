import { Link } from 'react-router-dom'
import { useComparisonData } from '@/features/comparison/useComparison'
import { CompanyRequired } from '@/components/company/CompanyRequired'
import { PeriodFilter } from '@/components/comparison/PeriodFilter'
import { IndicatorsSubnav } from '@/components/indicators/IndicatorsSubnav'
import { OperationalIndicatorCard } from '@/components/indicators/OperationalIndicatorCard'
import { useOperationalIndicators } from '@/features/experience/useOperationalIndicators'
import { Button } from '@/components/ui/Button'

export function IndicatorsPage() {
  const data = useComparisonData()
  const operational = useOperationalIndicators(
    data.months.length > 0
      ? {
          months: data.months,
          preferredMonth: data.month,
          actual: data.pair?.actual ?? null,
          classified: data.pair?.classifiedActuals ?? [],
        }
      : undefined
  )

  if (!data.companyLoading && !data.company) {
    return (
      <div data-tour="indicators">
        <h1 className="font-display text-3xl font-bold text-ink">Indicadores operacionais</h1>
        <IndicatorsSubnav />
        <div className="mt-6">
          <CompanyRequired message="Os indicadores operacionais usam o realizado da empresa ativa." />
        </div>
      </div>
    )
  }

  if (data.loading || data.companyLoading || operational.loading) {
    return <p className="text-sm text-mist">Carregando indicadores operacionais...</p>
  }

  return (
    <div className="flex flex-col gap-6" data-tour="indicators">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">
            Indicadores operacionais
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-mist">
            {operational.model
              ? `Selecionados para ${operational.model.label}. Cada card mostra a fórmula; clique para informar os dados que faltam e ver o cálculo.`
              : 'Depois de informar o modelo de operação, escolha os indicadores que a empresa quer acompanhar.'}
          </p>
        </div>
        {data.months.length > 0 ? (
          <PeriodFilter months={data.months} value={data.month} onChange={data.setMonth} />
        ) : null}
      </div>

      <IndicatorsSubnav />

      {operational.error || data.error ? (
        <p className="rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {operational.error || data.error}
        </p>
      ) : null}

      {operational.cards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
      ) : (
        <div className="rounded-2xl border border-dashed border-paper-muted bg-white px-6 py-12 text-center">
          <p className="font-display text-xl font-semibold text-ink">
            Nenhum indicador operacional selecionado
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist">
            Escolha as informações mais importantes no cadastro da empresa ou acrescente
            depois no perfil operacional.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/app/conhecer-empresa">
              <Button variant="secondary">Abrir questionário</Button>
            </Link>
            <Link to="/app/empresa">
              <Button>Configurar no perfil</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
