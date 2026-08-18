import { supabase } from '@/lib/supabase'
import { mapCompanyError } from '@/features/company/companyErrors'
import type { ServiceResult } from '@/features/company/companyService'
import type { OperationModelId } from '@/features/experience/catalog/operationModels'

export type MonthlyNamedInputs = Record<string, Record<string, number>>

export function operationInputQuestionCode(modelId: OperationModelId) {
  return `indicator_input:${modelId}`
}

export function isOperationInputQuestion(code: string) {
  return code.startsWith('indicator_input:')
}

export function parseMonthlyNamedInputs(value: unknown): MonthlyNamedInputs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: MonthlyNamedInputs = {}
  for (const [month, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const entry: Record<string, number> = {}
    for (const [key, amount] of Object.entries(raw as Record<string, unknown>)) {
      const parsed = typeof amount === 'number' ? amount : Number(amount)
      if (Number.isFinite(parsed) && parsed >= 0) entry[key] = parsed
    }
    if (Object.keys(entry).length > 0) result[month] = entry
  }
  return result
}

function fail(error: unknown): ServiceResult<never> {
  return { ok: false, message: mapCompanyError(error) }
}

function unwrapAnswer(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'value' in payload) {
    return (payload as { value: unknown }).value
  }
  return payload
}

export async function listOperationInputs(
  companyId: string,
  modelIds: OperationModelId[]
): Promise<ServiceResult<Record<OperationModelId, MonthlyNamedInputs>>> {
  const empty = Object.fromEntries(modelIds.map((id) => [id, {}])) as Record<
    OperationModelId,
    MonthlyNamedInputs
  >
  if (modelIds.length === 0) return { ok: true, data: empty }

  const codes = modelIds.map(operationInputQuestionCode)
  const { data, error } = await supabase
    .from('company_profile_answers')
    .select('question_code, answer')
    .eq('company_id', companyId)
    .in('question_code', codes)

  if (error) return fail(error)

  const result = { ...empty }
  for (const row of data ?? []) {
    const modelId = String(row.question_code).slice('indicator_input:'.length) as OperationModelId
    result[modelId] = parseMonthlyNamedInputs(unwrapAnswer(row.answer))
  }
  return { ok: true, data: result }
}

export async function saveOperationInputs(input: {
  companyId: string
  modelId: OperationModelId
  monthKey: string
  values: Record<string, number>
  current: MonthlyNamedInputs
}): Promise<ServiceResult<MonthlyNamedInputs>> {
  const next: MonthlyNamedInputs = {
    ...input.current,
    [input.monthKey]: {
      ...(input.current[input.monthKey] ?? {}),
      ...input.values,
    },
  }

  const { error } = await supabase.from('company_profile_answers').upsert(
    {
      company_id: input.companyId,
      question_code: operationInputQuestionCode(input.modelId),
      answer: { value: next },
      operation_id: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,question_code' }
  )

  if (error) return fail(error)
  return { ok: true, data: next }
}
