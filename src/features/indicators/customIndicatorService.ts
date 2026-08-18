import { supabase } from '@/lib/supabase'
import { mapCompanyError } from '@/features/company/companyErrors'
import type { ServiceResult } from '@/features/company/companyService'
import { slug } from '@/features/experience/catalog/helpers'
import {
  defaultCustomFormula,
  isCustomFormula,
  type CustomFormula,
} from '@/features/indicators/formula'
import type { CompanyCustomIndicator, CompanyCustomUnit } from '@/types/database'

function fail(error: unknown): ServiceResult<never> {
  return { ok: false, message: mapCustomIndicatorError(error) }
}

function mapCustomIndicatorError(error: unknown) {
  const message = mapCompanyError(error)
  if (error && typeof error === 'object' && 'message' in error) {
    const raw = String((error as { message?: unknown }).message ?? '').toLowerCase()
    if (raw.includes('company_custom_units') && raw.includes('unique')) {
      return 'Já existe uma unidade com esse nome nesta empresa.'
    }
  }
  if (message === 'Esta empresa já está cadastrada.') {
    return 'Já existe uma unidade com esse nome nesta empresa.'
  }
  return message
}

function asUnit(row: Record<string, unknown>): CompanyCustomUnit {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    code: String(row.code),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    quantity_noun: String(row.quantity_noun),
    quantity_noun_singular: String(row.quantity_noun_singular),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

function asIndicator(row: Record<string, unknown>): CompanyCustomIndicator {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    unit_source: row.unit_source === 'catalog' ? 'catalog' : 'custom',
    unit_code: String(row.unit_code),
    unit_name: String(row.unit_name),
    quantity_noun: String(row.quantity_noun),
    quantity_noun_singular: String(row.quantity_noun_singular),
    custom_unit_id: (row.custom_unit_id as string | null) ?? null,
    formula: row.formula,
    display_unit: String(row.display_unit),
    is_active: Boolean(row.is_active),
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

export function customIndicatorVolumeCode(indicatorId: string) {
  return `custom:${indicatorId}`
}

export function isCustomIndicatorCode(code: string) {
  return code.startsWith('custom:')
}

export async function listCompanyCustomUnits(
  companyId: string
): Promise<ServiceResult<CompanyCustomUnit[]>> {
  const { data, error } = await supabase
    .from('company_custom_units')
    .select(
      'id, company_id, code, name, description, quantity_noun, quantity_noun_singular, created_at, updated_at'
    )
    .eq('company_id', companyId)
    .order('name', { ascending: true })

  if (error) return fail(error)
  return { ok: true, data: (data ?? []).map((row) => asUnit(row as Record<string, unknown>)) }
}

export async function listCompanyCustomIndicators(
  companyId: string
): Promise<ServiceResult<CompanyCustomIndicator[]>> {
  const { data, error } = await supabase
    .from('company_custom_indicators')
    .select(
      'id, company_id, name, description, unit_source, unit_code, unit_name, quantity_noun, quantity_noun_singular, custom_unit_id, formula, display_unit, is_active, created_by, created_at, updated_at'
    )
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) return fail(error)
  return {
    ok: true,
    data: (data ?? []).map((row) => asIndicator(row as Record<string, unknown>)),
  }
}

export async function createCompanyCustomUnit(input: {
  companyId: string
  name: string
  quantityNoun: string
  quantityNounSingular: string
  description?: string
}): Promise<ServiceResult<CompanyCustomUnit>> {
  const name = input.name.trim()
  const quantityNoun = input.quantityNoun.trim()
  const quantityNounSingular = input.quantityNounSingular.trim()
  if (!name) return { ok: false, message: 'Informe o nome da unidade.' }
  if (!quantityNounSingular || !quantityNoun) {
    return { ok: false, message: 'Informe o nome da unidade no singular e no plural.' }
  }

  const baseCode = slug(name) || 'unidade'
  let code = baseCode
  for (let attempt = 2; attempt < 20; attempt += 1) {
    const existing = await supabase
      .from('company_custom_units')
      .select('id')
      .eq('company_id', input.companyId)
      .eq('code', code)
      .maybeSingle()
    if (!existing.data) break
    code = `${baseCode}_${attempt}`
  }

  const { data, error } = await supabase
    .from('company_custom_units')
    .insert({
      company_id: input.companyId,
      code,
      name,
      description: input.description?.trim() || null,
      quantity_noun: quantityNoun,
      quantity_noun_singular: quantityNounSingular,
    })
    .select(
      'id, company_id, code, name, description, quantity_noun, quantity_noun_singular, created_at, updated_at'
    )
    .single()

  if (error) return fail(error)
  return { ok: true, data: asUnit(data as Record<string, unknown>) }
}

export async function createCompanyCustomIndicator(input: {
  companyId: string
  name: string
  description?: string
  unitSource: 'catalog' | 'custom'
  unitCode: string
  unitName: string
  quantityNoun: string
  quantityNounSingular: string
  customUnitId?: string | null
  formula?: CustomFormula
  displayUnit: string
}): Promise<ServiceResult<CompanyCustomIndicator>> {
  const name = input.name.trim()
  if (!name) return { ok: false, message: 'Informe o nome do indicador.' }
  if (!input.unitName.trim() || !input.unitCode.trim()) {
    return { ok: false, message: 'Selecione ou crie a unidade de operação.' }
  }

  const formula = input.formula ?? defaultCustomFormula()
  if (!isCustomFormula(formula)) {
    return { ok: false, message: 'A fórmula do indicador é inválida.' }
  }

  const { data: session } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('company_custom_indicators')
    .insert({
      company_id: input.companyId,
      name,
      description: input.description?.trim() || null,
      unit_source: input.unitSource,
      unit_code: input.unitCode,
      unit_name: input.unitName.trim(),
      quantity_noun: input.quantityNoun.trim(),
      quantity_noun_singular: input.quantityNounSingular.trim(),
      custom_unit_id: input.unitSource === 'custom' ? input.customUnitId ?? null : null,
      formula,
      display_unit: input.displayUnit.trim() || 'R$',
      created_by: session.user?.id ?? null,
    })
    .select(
      'id, company_id, name, description, unit_source, unit_code, unit_name, quantity_noun, quantity_noun_singular, custom_unit_id, formula, display_unit, is_active, created_by, created_at, updated_at'
    )
    .single()

  if (error) return fail(error)
  return { ok: true, data: asIndicator(data as Record<string, unknown>) }
}

export async function deleteCompanyCustomIndicator(
  companyId: string,
  indicatorId: string
): Promise<ServiceResult<true>> {
  const { error } = await supabase
    .from('company_custom_indicators')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .eq('id', indicatorId)

  if (error) return fail(error)
  return { ok: true, data: true }
}

export function parseIndicatorFormula(value: unknown): CustomFormula {
  return isCustomFormula(value) ? value : defaultCustomFormula()
}
