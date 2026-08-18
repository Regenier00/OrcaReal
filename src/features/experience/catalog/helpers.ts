import type {
  AnalysisUnitDef,
  ExperienceQuestion,
  IndicatorDef,
  QuestionOption,
  StructureTemplate,
} from '../types'

export function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function opts(...labels: string[]): QuestionOption[] {
  return labels.map((label) => ({ value: slug(label), label }))
}

export const YES_NO: QuestionOption[] = [
  { value: 'yes', label: 'Sim' },
  { value: 'no', label: 'Não' },
]

const EXCLUSIVE_SINGLE_CODES = new Set(['company_size', 'state', 'operation_model'])

function isYesNo(options: QuestionOption[] | undefined): boolean {
  if (options === YES_NO) return true
  if (!options || options.length !== 2) return false
  const values = new Set(options.map((option) => option.value))
  return values.has('yes') && values.has('no')
}

function defaultAnswerType(
  partial: Pick<ExperienceQuestion, 'code' | 'options' | 'optionSource'> & {
    answerType?: ExperienceQuestion['answerType']
  }
): ExperienceQuestion['answerType'] {
  if (partial.answerType) return partial.answerType
  const hasChoices = Boolean(partial.options?.length) || Boolean(partial.optionSource)
  if (!hasChoices) return 'single'
  if (isYesNo(partial.options) || EXCLUSIVE_SINGLE_CODES.has(partial.code)) return 'single'
  return 'multiple'
}

export const BRAZIL_STATES: QuestionOption[] = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
].map((value) => ({ value, label: value }))

export function q(
  partial: Omit<ExperienceQuestion, 'answerType' | 'sortOrder'> & {
    answerType?: ExperienceQuestion['answerType']
    sortOrder?: number
  },
  sortOrder: number
): ExperienceQuestion {
  return {
    optional: false,
    continuous: false,
    segmentCode: partial.segmentCode ?? null,
    ...partial,
    answerType: defaultAnswerType(partial),
    sortOrder: partial.sortOrder ?? sortOrder,
  }
}

export function unit(
  code: string,
  name: string,
  segments: string[],
  description?: string
): AnalysisUnitDef {
  return { code, name, segments, description }
}

export function indicator(
  partial: Omit<IndicatorDef, 'periodicity' | 'sortOrder' | 'requiredData'> & {
    periodicity?: string
    sortOrder?: number
    requiredData?: string[]
  },
  sortOrder: number
): IndicatorDef {
  return {
    periodicity: 'monthly',
    requiredData: [],
    ...partial,
    sortOrder: partial.sortOrder ?? sortOrder,
  }
}

export function structure(
  partial: Partial<StructureTemplate> & Pick<StructureTemplate, 'defaultUnitCodes'>
): StructureTemplate {
  return {
    extraDepartments: [],
    extraCostCenters: [],
    extraCategories: [],
    oxrDimensions: [],
    ...partial,
  }
}
