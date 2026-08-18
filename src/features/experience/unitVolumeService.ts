import { supabase } from '@/lib/supabase'
import { mapCompanyError } from '@/features/company/companyErrors'
import type { ServiceResult } from '@/features/company/companyService'
import {
  parseMonthlyVolumes,
  unitVolumeQuestionCode,
  type MonthlyVolumes,
} from '@/features/experience/unitCost'

function fail(error: unknown): ServiceResult<never> {
  return { ok: false, message: mapCompanyError(error) }
}

export async function getUnitVolumes(
  companyId: string,
  indicatorCode: string
): Promise<ServiceResult<MonthlyVolumes>> {
  const { data, error } = await supabase
    .from('company_profile_answers')
    .select('answer')
    .eq('company_id', companyId)
    .eq('question_code', unitVolumeQuestionCode(indicatorCode))
    .maybeSingle()

  if (error) return fail(error)
  const payload = data?.answer as { value?: unknown } | unknown
  const value =
    payload && typeof payload === 'object' && 'value' in payload
      ? (payload as { value: unknown }).value
      : payload
  return { ok: true, data: parseMonthlyVolumes(value) }
}

export async function listUnitVolumes(
  companyId: string,
  indicatorCodes: string[]
): Promise<ServiceResult<Record<string, MonthlyVolumes>>> {
  if (indicatorCodes.length === 0) return { ok: true, data: {} }

  const codes = indicatorCodes.map(unitVolumeQuestionCode)
  const { data, error } = await supabase
    .from('company_profile_answers')
    .select('question_code, answer')
    .eq('company_id', companyId)
    .in('question_code', codes)

  if (error) return fail(error)

  const result: Record<string, MonthlyVolumes> = {}
  for (const code of indicatorCodes) result[code] = {}
  for (const row of data ?? []) {
    const indicatorCode = String(row.question_code).slice(unitVolumeQuestionCode('').length)
    const payload = row.answer as { value?: unknown } | unknown
    const value =
      payload && typeof payload === 'object' && 'value' in payload
        ? (payload as { value: unknown }).value
        : payload
    result[indicatorCode] = parseMonthlyVolumes(value)
  }
  return { ok: true, data: result }
}

export async function saveUnitVolume(input: {
  companyId: string
  indicatorCode: string
  monthKey: string
  quantity: number
  current: MonthlyVolumes
}): Promise<ServiceResult<MonthlyVolumes>> {
  const next = {
    ...input.current,
    [input.monthKey]: input.quantity,
  }

  const { error } = await supabase.from('company_profile_answers').upsert(
    {
      company_id: input.companyId,
      question_code: unitVolumeQuestionCode(input.indicatorCode),
      answer: { value: next },
      operation_id: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,question_code' }
  )

  if (error) return fail(error)
  return { ok: true, data: next }
}
