import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { getCompanyExperienceAnswers } from '@/features/experience/experienceService'
import { builtinCatalog } from '@/features/experience/catalog'
import { continuousQuestions } from '@/features/experience/questionnaire'
import { buildContext } from '@/features/experience/conditions'
import { isSegmentCode } from '@/features/company/segmentOptions'
import { Button } from '@/components/ui/Button'
import { MonthResultSection } from '@/components/home/MonthResultSection'
import { FinancialSummary } from '@/components/home/FinancialSummary'
import { EvolutionChart } from '@/components/home/EvolutionChart'
import { FinancialInsights } from '@/components/home/FinancialInsights'
import type { HomeDashboardData } from '@/features/experience/useUnitCostCards'
import type { ExperienceAnswers } from '@/features/experience/types'

export function PersonalizedDashboard({
  data,
  greeting,
}: {
  data: HomeDashboardData
  greeting?: string
}) {
  const { activeCompany, companyProfile, segments } = useCompany()
  const dashboard = data
  const [answers, setAnswers] = useState<ExperienceAnswers>({})
  const [error, setError] = useState('')

  const segmentCode = useMemo(() => {
    const matched = segments.find((item) => item.id === companyProfile?.segment_id)
    return matched && isSegmentCode(matched.code) ? matched.code : 'other'
  }, [segments, companyProfile])

  useEffect(() => {
    if (!activeCompany) return
    let mounted = true
    void getCompanyExperienceAnswers(activeCompany.id).then((ans) => {
      if (!mounted) return
      if (!ans.ok) {
        setError(ans.message)
        return
      }
      setAnswers(ans.data)
      setError('')
    })
    return () => {
      mounted = false
    }
  }, [activeCompany])

  const prompts = useMemo(() => {
    const ctx = buildContext({ segmentCode, answers })
    return continuousQuestions(builtinCatalog, ctx).slice(0, 1)
  }, [segmentCode, answers])

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <FinancialSummary
        current={dashboard.currentFinancials}
        previous={dashboard.previousFinancials}
        monthLabel={dashboard.monthLabel}
        greeting={greeting}
        loading={dashboard.loading}
      />

      <div
        className={
          dashboard.insights.length > 0
            ? 'grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)]'
            : undefined
        }
      >
        <EvolutionChart series={dashboard.series} loading={dashboard.loading} />
        <FinancialInsights insights={dashboard.insights} />
      </div>

      <MonthResultSection data={dashboard} />

      {prompts[0] ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-paper-muted bg-white px-5 py-4 shadow-card">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-bright">
              Personalizar
            </p>
            <h2 className="mt-1 font-display text-base font-semibold text-navy">
              {prompts[0].prompt}
            </h2>
          </div>
          <Link to="/app/conhecer-empresa" className="inline-flex">
            <Button variant="secondary">Responder</Button>
          </Link>
        </section>
      ) : null}
    </div>
  )
}
