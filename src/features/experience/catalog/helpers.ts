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
    answerType: 'single',
    optional: false,
    continuous: false,
    segmentCode: partial.segmentCode ?? null,
    ...partial,
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
