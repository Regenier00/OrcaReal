import { useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { setupCompanyEnvironment } from '@/features/company/companyService'
import { clearCompanyOnboardingFlag } from '@/features/company/onboardingFlag'
import {
  isSegmentCode,
  type SegmentCode,
} from '@/features/company/segmentOptions'
import {
  CompanySetupForm,
  type CompanySetupValues,
} from '@/components/company/CompanySetupForm'
import { FullPageStatus } from '@/components/ui/FullPageStatus'

export function CompanySetupPage() {
  const navigate = useNavigate()
  const { activeCompany, companyProfile, segments, refresh, loading } =
    useCompany()
  const submittingRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const segmentCode = useMemo<SegmentCode>(() => {
    const matched = segments.find((item) => item.id === companyProfile?.segment_id)
    if (matched && isSegmentCode(matched.code)) return matched.code
    return 'other'
  }, [segments, companyProfile])

  const initial = useMemo<CompanySetupValues>(() => {
    return {
      name: activeCompany?.name ?? '',
      segmentCode,
      customSegment: companyProfile?.custom_segment ?? '',
      departments: [],
      costCenters: [],
    }
  }, [activeCompany, companyProfile, segmentCode])

  if (loading && !activeCompany) {
    return <FullPageStatus title="Carregando..." />
  }

  if (!activeCompany) {
    return <Navigate to="/app/criar-empresa" replace />
  }

  const finish = async (skip: boolean, values?: CompanySetupValues) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError('')

    const result = await setupCompanyEnvironment({
      companyId: activeCompany.id,
      skip,
      name: values?.name,
      segmentCode: values?.segmentCode,
      customSegment: values?.customSegment,
      departments: values?.departments,
      costCenters: values?.costCenters,
    })

    if (!result.ok) {
      submittingRef.current = false
      setSubmitting(false)
      setError(result.message)
      return
    }

    clearCompanyOnboardingFlag()
    await refresh()
    navigate('/app', { replace: true })
  }

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
        Configuração inicial
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        Configure seu ambiente
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist sm:text-base">
        Defina o essencial para começar. Nada aqui é obrigatório — você pode
        ajustar departamentos e centros de custo depois.
      </p>

      <div className="mt-8">
        <CompanySetupForm
          key={`${activeCompany.id}-${segmentCode}`}
          initial={initial}
          submitting={submitting}
          error={error}
          onSubmit={(values) => void finish(false, values)}
          onSkip={() => void finish(true)}
        />
      </div>
    </div>
  )
}
