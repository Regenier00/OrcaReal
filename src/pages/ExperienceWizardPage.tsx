import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { isSegmentCode, segmentLabel, type SegmentCode } from '@/features/company/segmentOptions'
import { applyExperience } from '@/features/experience/apply'
import { buildContext } from '@/features/experience/conditions'
import {
  applyCompanyExperience,
  getCompanyExperienceAnswers,
  loadExperienceCatalog,
  saveExperienceProgress,
} from '@/features/experience/experienceService'
import {
  nextQuestion,
  questionProgress,
  resolveQuestionOptions,
} from '@/features/experience/questionnaire'
import { structureFor } from '@/features/experience/catalog'
import { readStoredCompanyLocation } from '@/features/company/onboardingFlag'
import { QuestionCard } from '@/components/experience/QuestionCard'
import { ExperienceProgress } from '@/components/experience/ExperienceProgress'
import { Button } from '@/components/ui/Button'
import { FullPageStatus } from '@/components/ui/FullPageStatus'
import type {
  ExperienceAnswers,
  ExperienceCatalog,
  ExperienceQuestion,
} from '@/features/experience/types'

export function ExperienceWizardPage() {
  const navigate = useNavigate()
  const { activeCompany, companyProfile, segments, loading, refresh } = useCompany()
  const [catalog, setCatalog] = useState<ExperienceCatalog | null>(null)
  const [answers, setAnswers] = useState<ExperienceAnswers>({})
  const [history, setHistory] = useState<string[]>([])
  const [current, setCurrent] = useState<ExperienceQuestion | null>(null)
  const [started, setStarted] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)

  const segmentCode = useMemo<SegmentCode>(() => {
    const matched = segments.find((item) => item.id === companyProfile?.segment_id)
    if (matched && isSegmentCode(matched.code)) return matched.code
    return 'other'
  }, [segments, companyProfile])

  useEffect(() => {
    if (!activeCompany) return
    let mounted = true
    void Promise.all([
      loadExperienceCatalog(),
      getCompanyExperienceAnswers(activeCompany.id),
    ]).then(([nextCatalog, answersResult]) => {
      if (!mounted) return
      setCatalog(nextCatalog)
      const location = readStoredCompanyLocation()
      const loaded = answersResult.ok ? answersResult.data : {}
      const initial: ExperienceAnswers = {
        ...(location.state && !loaded.state ? { state: location.state } : {}),
        ...(location.city && !loaded.city ? { city: location.city } : {}),
        ...loaded,
      }
      setAnswers(initial)
      setReady(true)
    })
    return () => {
      mounted = false
    }
  }, [activeCompany])

  const ctx = useMemo(() => {
    if (!catalog) return null
    return buildContext({
      segmentCode,
      answers,
      fallbackUnits: structureFor(segmentCode).defaultUnitCodes,
    })
  }, [catalog, segmentCode, answers])

  if (loading && !activeCompany) {
    return <FullPageStatus title="Carregando..." />
  }

  if (!activeCompany) {
    return <Navigate to="/app/criar-empresa" replace />
  }

  if (!ready || !catalog || !ctx) {
    return <FullPageStatus title="Preparando suas perguntas..." />
  }

  const progress = questionProgress(catalog, ctx)
  const options = current
    ? resolveQuestionOptions(current, catalog, ctx)
    : []

  const persist = async (nextAnswers: ExperienceAnswers) => {
    await saveExperienceProgress({
      companyId: activeCompany.id,
      answers: nextAnswers,
    })
  }

  const finish = async (nextAnswers: ExperienceAnswers) => {
    setSaving(true)
    setError('')
    const experience = applyExperience(
      catalog,
      buildContext({
        segmentCode,
        answers: nextAnswers,
        fallbackUnits: structureFor(segmentCode).defaultUnitCodes,
      })
    )
    const saved = await applyCompanyExperience({
      companyId: activeCompany.id,
      experience,
      complete: true,
    })
    setSaving(false)
    if (!saved.ok) {
      setError(saved.message)
      return
    }
    await refresh()
    navigate('/app/ambiente-pronto', { replace: true })
  }

  const handleContinue = async () => {
    if (!current) {
      await finish(answers)
      return
    }

    const value = answers[current.code]
    const missing =
      value == null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)

    if (missing && !current.optional) {
      setError('Escolha uma opção para continuar.')
      return
    }

    setError('')
    const nextAnswers = { ...answers }
    if (missing) {
      nextAnswers[current.code] = '__skipped__'
      setAnswers(nextAnswers)
    }
    await advance(nextAnswers)
  }

  const handleSkip = async () => {
    if (!current) return
    const nextAnswers = {
      ...answers,
      [current.code]: answers[current.code] ?? '__skipped__',
    }
    setAnswers(nextAnswers)
    await advance(nextAnswers)
  }

  const advance = async (nextAnswers: ExperienceAnswers) => {
    if (current) {
      setHistory((currentHistory) =>
        currentHistory.includes(current.code)
          ? currentHistory
          : [...currentHistory, current.code]
      )
    }
    await persist(nextAnswers)
    const following = nextQuestion(
      catalog,
      buildContext({
        segmentCode,
        answers: nextAnswers,
        fallbackUnits: structureFor(segmentCode).defaultUnitCodes,
      }),
      { includeContinuous: Boolean(companyProfile?.questionnaire_completed) }
    )
    if (!following || following.code === current?.code) {
      await finish(nextAnswers)
      return
    }
    setCurrent(following)
  }

  const handleBack = () => {
    const previousCode = history[history.length - 1]
    if (!previousCode) {
      setStarted(false)
      setCurrent(null)
      return
    }
    setHistory((currentHistory) => currentHistory.slice(0, -1))
    const previous = catalog.questions.find((item) => item.code === previousCode) ?? null
    setCurrent(previous)
  }

  if (!started) {
    return (
      <div className="rounded-2xl border border-paper-muted bg-white px-6 py-10 sm:px-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
          Vamos conhecer sua empresa
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">
          Como a {activeCompany.trade_name || activeCompany.name} opera?
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist sm:text-base">
          O ramo {segmentLabel(segmentCode) || 'informado'} já define a unidade
          de operação. Em seguida, vamos entender como vocês geram receita e
          quais custos importam para o dashboard.
        </p>
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void finish(answers)}
          >
            Fazer isso depois
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => {
              setStarted(true)
              setCurrent(
                nextQuestion(catalog, ctx, {
                  includeContinuous: Boolean(companyProfile?.questionnaire_completed),
                })
              )
            }}
          >
            Começar
          </Button>
        </div>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="rounded-2xl border border-paper-muted bg-white px-6 py-10 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">
          Perfeito. Com essas informações, vamos preparar sua estrutura personalizada.
        </h1>
        <p className="mt-3 text-sm text-mist">
          Indicadores, centros de custo e o dashboard serão montados a partir do
          perfil da empresa.
        </p>
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        <Button className="mt-8" disabled={saving} onClick={() => void finish(answers)}>
          {saving ? 'Preparando...' : 'Preparar meu ambiente'}
        </Button>
      </div>
    )
  }

  return (
    <div>
      <ExperienceProgress current={progress.current} total={progress.total} />
      <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
        {segmentLabel(segmentCode)}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        {current.prompt}
      </h1>
      {current.helpText ? (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist">{current.helpText}</p>
      ) : null}

      <div className="mt-8 rounded-2xl border border-paper-muted bg-white p-5 sm:p-7">
        <QuestionCard
          question={current}
          options={options}
          value={answers[current.code] ?? null}
          onChange={(value) => {
            setError('')
            setAnswers((currentAnswers) => ({
              ...currentAnswers,
              [current.code]: value,
            }))
          }}
        />
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="secondary" onClick={handleBack} disabled={saving}>
          Voltar
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row">
          {current.optional ? (
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => void handleSkip()}
            >
              Pular
            </Button>
          ) : null}
          <Button type="button" disabled={saving} onClick={() => void handleContinue()}>
            {saving ? 'Salvando...' : 'Continuar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
