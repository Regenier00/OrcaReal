import type {
  AnswerValue,
  EvaluationContext,
  ExperienceCondition,
} from '@/features/experience/types'

function asList(value: AnswerValue): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.map(String)
  return [String(value)]
}

export function hasAnswer(value: AnswerValue): boolean {
  if (value == null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim() !== ''
  return true
}

export function evaluateCondition(
  condition: ExperienceCondition | undefined,
  ctx: EvaluationContext
): boolean {
  if (!condition) return true

  if ('all' in condition) {
    return condition.all.every((item) => evaluateCondition(item, ctx))
  }
  if ('any' in condition) {
    return condition.any.some((item) => evaluateCondition(item, ctx))
  }
  if ('not' in condition) {
    return !evaluateCondition(condition.not, ctx)
  }
  if ('eq' in condition) {
    const current = ctx.answers[condition.eq.answer]
    if (Array.isArray(current)) {
      return current.map(String).includes(String(condition.eq.value))
    }
    return current != null && String(current) === String(condition.eq.value)
  }
  if ('in' in condition) {
    const current = ctx.answers[condition.in.answer]
    const allowed = condition.in.values.map(String)
    return asList(current).some((item) => allowed.includes(item))
  }
  if ('includes' in condition) {
    return asList(ctx.answers[condition.includes.answer]).includes(
      condition.includes.value
    )
  }
  if ('hasUnit' in condition) {
    return ctx.analysisUnitCodes.includes(condition.hasUnit)
  }
  if ('segmentIn' in condition) {
    const codes = [ctx.segmentCode, ...ctx.extraSegmentCodes]
    return condition.segmentIn.some((code) => codes.includes(code))
  }
  if ('answerMissing' in condition) {
    return !hasAnswer(ctx.answers[condition.answerMissing])
  }

  return true
}

export function extraSegmentCodesFromAnswers(
  answers: EvaluationContext['answers']
): string[] {
  return asList(answers.extra_segments).filter(Boolean)
}

export function analysisUnitCodesFromAnswers(
  answers: EvaluationContext['answers'],
  fallback: string[] = []
): string[] {
  const selected = asList(answers.analysis_units).filter(Boolean)
  return selected.length > 0 ? selected : fallback
}

export function buildContext(input: {
  segmentCode: string
  answers: EvaluationContext['answers']
  fallbackUnits?: string[]
}): EvaluationContext {
  const extraSegmentCodes = extraSegmentCodesFromAnswers(input.answers)
  return {
    segmentCode: input.segmentCode,
    extraSegmentCodes,
    answers: input.answers,
    analysisUnitCodes: analysisUnitCodesFromAnswers(
      input.answers,
      input.fallbackUnits ?? []
    ),
  }
}
