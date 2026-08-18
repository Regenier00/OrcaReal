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
import type { ExperienceAnswers } from '@/features/experience/types'

export function PersonalizedDashboard() {
  const { activeCompany, companyProfile, segments } = useCompany()
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
    <div className="mt-5 space-y-8">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <MonthResultSection />

      {prompts[0] ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-paper-muted bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-mist">
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
