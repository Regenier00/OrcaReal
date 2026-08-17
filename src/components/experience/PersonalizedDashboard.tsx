import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { listCompanyBudgets } from '@/features/budget/budgetService'
import { lineTotal } from '@/features/budget/model'
import { monthsBetween } from '@/features/budget/period'
import { formatBRL, formatPct } from '@/lib/money'
import {
  getCompanyDashboard,
  getCompanyExperienceAnswers,
  listEnabledCompanyIndicators,
  toggleCompanyIndicator,
  updateCompanyDashboardLayout,
} from '@/features/experience/experienceService'
import { builtinCatalog } from '@/features/experience/catalog'
import { continuousQuestions } from '@/features/experience/questionnaire'
import { buildContext } from '@/features/experience/conditions'
import { isSegmentCode } from '@/features/company/segmentOptions'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { DashboardLayout, ExperienceAnswers } from '@/features/experience/types'
import { DASHBOARD_SECTION_TITLES } from '@/features/experience/types'

interface IndicatorView {
  rowId: string
  code: string
  name: string
  description: string
  formula: string
  unit: string
  category: string
  section: string
  favorite: boolean
  visible: boolean
}

export function PersonalizedDashboard() {
  const { activeCompany, companyProfile, segments } = useCompany()
  const [indicators, setIndicators] = useState<IndicatorView[]>([])
  const [layout, setLayout] = useState<DashboardLayout | null>(null)
  const [answers, setAnswers] = useState<ExperienceAnswers>({})
  const [metrics, setMetrics] = useState<{
    revenue: number
    costs: number
    expenses: number
    budgeted: number
  } | null>(null)
  const [error, setError] = useState('')

  const segmentCode = useMemo(() => {
    const matched = segments.find((item) => item.id === companyProfile?.segment_id)
    return matched && isSegmentCode(matched.code) ? matched.code : 'other'
  }, [segments, companyProfile])

  useEffect(() => {
    if (!activeCompany) return
    let mounted = true
    void Promise.all([
      listEnabledCompanyIndicators(activeCompany.id),
      getCompanyDashboard(activeCompany.id),
      getCompanyExperienceAnswers(activeCompany.id),
      listCompanyBudgets(activeCompany.id).catch(() => []),
    ]).then(([inds, dash, ans, budgets]) => {
      if (!mounted) return
      if (!inds.ok) {
        setError(inds.message)
        return
      }
      setIndicators(
        inds.data.map((row) => {
          const raw = row.indicator as Record<string, unknown> | Record<string, unknown>[] | null
          const item = Array.isArray(raw) ? raw[0] : raw
          const code = String(item?.code ?? '')
          const fallback = builtinCatalog.indicators.find((def) => def.code === code)
          return {
            rowId: String(row.id),
            code,
            name: String(item?.name ?? fallback?.name ?? code),
            description: String(item?.description ?? fallback?.description ?? ''),
            formula: String(item?.formula ?? item?.formula_hint ?? fallback?.formula ?? ''),
            unit: String(item?.unit ?? fallback?.unit ?? 'R$'),
            category: String(item?.category ?? fallback?.category ?? 'financial'),
            section: String(
              item?.dashboard_section ?? fallback?.dashboardSection ?? 'financial'
            ),
            favorite: Boolean(row.is_favorite),
            visible: row.dashboard_visible !== false,
          }
        })
      )
      if (dash.ok && dash.data?.layout && typeof dash.data.layout === 'object') {
        setLayout(dash.data.layout as DashboardLayout)
      }
      if (ans.ok) setAnswers(ans.data)

      const budgetList = Array.isArray(budgets) ? budgets : []
      const active =
        budgetList.find((item) => item.status === 'active') ?? budgetList[0] ?? null
      if (active) {
        const months = monthsBetween(active.startDate, active.endDate)
        let revenue = 0
        let costs = 0
        let expenses = 0
        for (const item of active.items) {
          const total = lineTotal(item, months)
          if (item.categoryType === 'revenue') revenue += total
          else if (item.categoryType === 'cost') costs += total
          else expenses += total
        }
        setMetrics({
          revenue,
          costs,
          expenses,
          budgeted: revenue + costs + expenses,
        })
      }
    })
    return () => {
      mounted = false
    }
  }, [activeCompany])

  const prompts = useMemo(() => {
    const ctx = buildContext({ segmentCode, answers })
    return continuousQuestions(builtinCatalog, ctx).slice(0, 1)
  }, [segmentCode, answers])

  const grouped = useMemo(() => {
    const visible = indicators.filter((item) => item.visible)
    const sections = layout?.sections?.length
      ? layout.sections
      : Object.entries(DASHBOARD_SECTION_TITLES).map(([id, title]) => ({
          id: id as keyof typeof DASHBOARD_SECTION_TITLES,
          title,
          indicatorCodes: visible
            .filter((item) => item.section === id)
            .map((item) => item.code),
        }))

    return sections
      .map((section) => ({
        ...section,
        items: visible.filter((item) => section.indicatorCodes.includes(item.code)),
      }))
      .filter((section) => section.items.length > 0)
  }, [indicators, layout])

  const persistLayout = async (next: IndicatorView[]) => {
    if (!activeCompany) return
    const nextLayout: DashboardLayout = {
      sections: (layout?.sections ?? []).map((section) => ({
        ...section,
        indicatorCodes: next
          .filter((item) => item.visible && item.section === section.id)
          .map((item) => item.code),
      })),
      favorites: next.filter((item) => item.favorite).map((item) => item.code),
      hidden: next.filter((item) => !item.visible).map((item) => item.code),
      order: next.map((item) => item.code),
    }
    setLayout(nextLayout)
    await updateCompanyDashboardLayout({
      companyId: activeCompany.id,
      layout: nextLayout,
    })
  }

  const handleFavorite = async (item: IndicatorView) => {
    const next = indicators.map((current) =>
      current.rowId === item.rowId
        ? { ...current, favorite: !current.favorite }
        : current
    )
    setIndicators(next)
    await toggleCompanyIndicator({
      companyId: activeCompany!.id,
      indicatorId: item.rowId,
      isFavorite: !item.favorite,
    })
    await persistLayout(next)
  }

  const handleHide = async (item: IndicatorView) => {
    const next = indicators.map((current) =>
      current.rowId === item.rowId ? { ...current, visible: false } : current
    )
    setIndicators(next)
    await toggleCompanyIndicator({
      companyId: activeCompany!.id,
      indicatorId: item.rowId,
      dashboardVisible: false,
    })
    await persistLayout(next)
  }

  const profit = metrics ? metrics.revenue - metrics.costs - metrics.expenses : null
  const margin =
    metrics && metrics.revenue ? profit! / metrics.revenue : null

  return (
    <div className="mt-8 space-y-8">
      {prompts[0] ? (
        <section className="rounded-2xl border border-paper-muted bg-white p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
            Continuar personalização
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold text-navy">
            {prompts[0].prompt}
          </h2>
          <p className="mt-1 text-sm text-mist">
            Se fizer sentido para o negócio, o indicador entra no dashboard.
          </p>
          <Link to="/app/conhecer-empresa" className="mt-4 inline-flex">
            <Button variant="secondary">Responder agora</Button>
          </Link>
        </section>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {grouped.map((section) => (
        <section key={section.id}>
          <h2 className="font-display text-xl font-semibold text-navy">{section.title}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {section.items.map((item) => {
              const value = metricFor(item.code, metrics, profit, margin)
              return (
                <article
                  key={item.rowId}
                  className={cn(
                    'rounded-2xl border border-paper-muted bg-white p-4',
                    item.favorite && 'ring-1 ring-navy/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-mist">
                        {item.category}
                      </p>
                      <h3 className="mt-1 font-display text-lg font-semibold text-ink">
                        {item.name}
                      </h3>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 text-xs text-mist hover:bg-paper hover:text-navy"
                        onClick={() => void handleFavorite(item)}
                      >
                        {item.favorite ? 'Favorito' : 'Favoritar'}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 text-xs text-mist hover:bg-paper hover:text-navy"
                        onClick={() => void handleHide(item)}
                      >
                        Ocultar
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 font-display text-2xl font-semibold text-ink">
                    {value ?? 'Aguardando dados'}
                  </p>
                  <p className="mt-2 text-sm text-mist">{item.description}</p>
                  <p className="mt-3 font-mono text-[11px] text-mist">{item.formula}</p>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      {grouped.length === 0 ? (
        <p className="text-sm text-mist">
          Nenhum indicador personalizado ainda.{' '}
          <Link to="/app/conhecer-empresa" className="font-medium text-navy-bright">
            Completar o perfil da empresa
          </Link>
        </p>
      ) : null}
    </div>
  )
}

function metricFor(
  code: string,
  metrics: { revenue: number; costs: number; expenses: number } | null,
  profit: number | null,
  margin: number | null
): string | null {
  if (!metrics) return null
  if (code === 'revenue') return formatBRL(metrics.revenue)
  if (code === 'costs') return formatBRL(metrics.costs)
  if (code === 'expenses') return formatBRL(metrics.expenses)
  if (code === 'profit' || code === 'operating_result') {
    return profit == null ? null : formatBRL(profit)
  }
  if (code === 'margin' || code === 'profitability') {
    return margin == null ? null : formatPct(margin)
  }
  return null
}
