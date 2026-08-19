import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { features, type FeatureId } from '@/content/features'
import { demoCompany, demoFeatureOrder, type DemoGate, type MonthKey } from '@/content/demoCompany'
import { useGuestSession } from '@/features/guest/useGuestSession'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/Button'
import { AuthGateModal } from '@/components/demo/AuthGateModal'
import { DemoBanner } from '@/components/demo/DemoBanner'
import { BudgetVsActualPanel } from '@/components/demo/BudgetVsActualPanel'
import { CostAnalysisPanel } from '@/components/demo/CostAnalysisPanel'
import { BudgetPanel } from '@/components/demo/BudgetPanel'
import { IndicatorsPanel } from '@/components/demo/IndicatorsPanel'
import { cn } from '@/lib/utils'

function isFeatureId(value: string | null): value is FeatureId {
  return demoFeatureOrder.includes(value as FeatureId)
}

export function DemoPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { simulationsRemaining, exploredAll, markFeatureViewed, trySimulate } =
    useGuestSession()
  const [month, setMonth] = useState<MonthKey>('ytd')
  const [gate, setGate] = useState<DemoGate | null>(null)

  const feature: FeatureId = isFeatureId(params.get('f'))
    ? (params.get('f') as FeatureId)
    : 'budget-vs-actual'

  useEffect(() => {
    markFeatureViewed(feature)
  }, [feature, markFeatureViewed])

  const setFeature = (id: FeatureId) => {
    const next = new URLSearchParams(params)
    next.set('f', id)
    setParams(next, { replace: true })
  }

  const goSignUp = () => {
    navigate('/cadastro', { state: { from: '/demo', gate } })
  }

  return (
    <div className="min-h-svh bg-paper">
      <div className="border-b border-paper-muted bg-white">
        <PublicHeader />
        <div className="mx-auto max-w-6xl px-6 pb-8 pt-4 sm:px-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brand">
            Demonstração · {demoCompany.segment}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
            Experimente o essencial, sem conta.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist sm:text-base">
            Dados da {demoCompany.name}, {demoCompany.period}. Você navega à vontade.
            Importar, salvar, exportar e simular sem limite pedem cadastro — é aí que
            o produto passa a ser o da sua empresa.
          </p>
        </div>
      </div>

      <DemoBanner simulationsRemaining={simulationsRemaining} />

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-10">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Funcionalidades">
          {features.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === feature}
              onClick={() => setFeature(item.id)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-medium transition',
                item.id === feature
                  ? 'border-brand bg-brand text-white'
                  : 'border-paper-muted bg-white text-ink-soft/75 hover:border-brand/30'
              )}
            >
              {item.title}
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-paper-muted bg-white p-5 shadow-[var(--shadow-soft)] sm:p-8">
          {feature === 'budget-vs-actual' ? (
            <BudgetVsActualPanel month={month} onMonthChange={setMonth} onGate={setGate} />
          ) : null}
          {feature === 'cost-analysis' ? (
            <CostAnalysisPanel month={month} onMonthChange={setMonth} onGate={setGate} />
          ) : null}
          {feature === 'budget' ? (
            <BudgetPanel month={month} onMonthChange={setMonth} onGate={setGate} />
          ) : null}
          {feature === 'indicators' ? (
            <IndicatorsPanel
              month={month}
              onMonthChange={setMonth}
              onGate={setGate}
              simulationsRemaining={simulationsRemaining}
              onSimulate={trySimulate}
            />
          ) : null}
        </div>

        {exploredAll ? (
          <div className="mt-6 rounded-2xl border border-ink/10 bg-white px-5 py-5">
            <p className="font-display text-lg font-semibold text-ink">
              Você já viu as quatro frentes.
            </p>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft/70">
              O próximo passo útil é trazer os números da sua empresa. A demonstração
              não substitui o Excel — a conta, sim.
            </p>
            <div className="mt-4">
              <Button onClick={() => setGate('save')}>Usar com meus dados</Button>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/cadastro">
            <Button>Criar conta</Button>
          </Link>
          <Link to="/">
            <Button variant="secondary">Voltar à Home</Button>
          </Link>
        </div>
      </section>

      {gate ? (
        <AuthGateModal gate={gate} onClose={() => setGate(null)} onSignUp={goSignUp} />
      ) : null}
    </div>
  )
}
