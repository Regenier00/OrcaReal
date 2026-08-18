import { evaluateCondition, extraSegmentCodesFromAnswers } from '@/features/experience/conditions'
import type {
  AnalysisUnitDef,
  EvaluationContext,
  ExperienceCatalog,
  ExperienceQuestion,
  QuestionOption,
} from '@/features/experience/types'
import { SEGMENT_OPTIONS } from '@/features/company/segmentOptions'

export function applicableQuestions(
  catalog: ExperienceCatalog,
  ctx: EvaluationContext,
  options?: { includeContinuous?: boolean }
): ExperienceQuestion[] {
  const segments = new Set([ctx.segmentCode, ...ctx.extraSegmentCodes])

  return catalog.questions
    .filter((question) => {
      if (!options?.includeContinuous && question.continuous) return false
      if (question.code === 'analysis_units') return false
      if (question.segmentCode && !segments.has(question.segmentCode)) return false
      return evaluateCondition(question.showWhen, ctx)
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
}

export function nextQuestion(
  catalog: ExperienceCatalog,
  ctx: EvaluationContext,
  options?: { includeContinuous?: boolean }
): ExperienceQuestion | null {
  return (
    applicableQuestions(catalog, ctx, options).find((question) => {
      const value = ctx.answers[question.code]
      if (value == null) return true
      if (Array.isArray(value)) return value.length === 0
      if (typeof value === 'string') return value.trim() === ''
      return false
    }) ?? null
  )
}

export function questionProgress(
  catalog: ExperienceCatalog,
  ctx: EvaluationContext
): { current: number; total: number } {
  const questions = applicableQuestions(catalog, ctx)
  const answered = questions.filter((question) => {
    const value = ctx.answers[question.code]
    if (value == null) return false
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'string') return value.trim() !== ''
    return true
  }).length

  return { current: answered, total: questions.length }
}

export function resolveQuestionOptions(
  question: ExperienceQuestion,
  catalog: ExperienceCatalog,
  ctx: EvaluationContext
): QuestionOption[] {
  if (question.optionSource === 'analysis_units') {
    return unitsForSegments(catalog.analysisUnits, [
      ctx.segmentCode,
      ...ctx.extraSegmentCodes,
    ]).map((unit) => ({ value: unit.code, label: unit.name }))
  }

  if (question.optionSource === 'segments') {
    return SEGMENT_OPTIONS.filter((option) => option.code !== ctx.segmentCode).map(
      (option) => ({ value: option.code, label: option.label })
    )
  }

  return question.options ?? []
}

export function unitsForSegments(
  units: AnalysisUnitDef[],
  segmentCodes: string[]
): AnalysisUnitDef[] {
  const set = new Set(segmentCodes.filter(Boolean))
  return units.filter((unit) => unit.segments.some((code) => set.has(code)))
}

export function continuousQuestions(
  catalog: ExperienceCatalog,
  ctx: EvaluationContext
): ExperienceQuestion[] {
  return catalog.questions
    .filter((question) => {
      if (!question.continuous) return false
      const segments = new Set([
        ctx.segmentCode,
        ...extraSegmentCodesFromAnswers(ctx.answers),
      ])
      if (question.segmentCode && !segments.has(question.segmentCode)) return false
      if (ctx.answers[question.code] != null) return false
      return evaluateCondition(question.showWhen, ctx)
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}
