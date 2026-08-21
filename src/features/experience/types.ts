export type AnswerType = 'single' | 'multiple' | 'text' | 'number' | 'scale'

export type IndicatorCategory = 'financial' | 'operational' | 'strategic'

export type DashboardSectionId =
  | 'financial'
  | 'operational'
  | 'budget_vs_actual'
  | 'profitability'

export type OptionSource =
  | 'static'
  | 'analysis_units'
  | 'segments'
  | 'operation_indicators'
  | 'sector_products'
  | 'sector_products_query'

export interface QuestionOption {
  value: string
  label: string
}

export type ExperienceCondition =
  | { all: ExperienceCondition[] }
  | { any: ExperienceCondition[] }
  | { not: ExperienceCondition }
  | { eq: { answer: string; value: string | number | boolean } }
  | { in: { answer: string; values: Array<string | number> } }
  | { includes: { answer: string; value: string } }
  | { hasUnit: string }
  | { segmentIn: string[] }
  | { answerMissing: string }

export type AnswerValue = string | number | string[] | null

export interface ExperienceAnswers {
  [questionCode: string]: AnswerValue
}

export interface ExperienceQuestion {
  code: string
  prompt: string
  helpText?: string
  answerType: AnswerType
  options?: QuestionOption[]
  optionSource?: OptionSource
  segmentCode?: string | null
  showWhen?: ExperienceCondition
  mapsTo?: string
  sortOrder: number
  optional?: boolean
  continuous?: boolean
  optionLayout?: 'chips' | 'cards'
}

export interface AnalysisUnitDef {
  code: string
  name: string
  description?: string
  segments: string[]
}

export interface IndicatorDef {
  code: string
  name: string
  description: string
  category: IndicatorCategory
  unit: string
  formula: string
  segments: string[] | null
  activation?: ExperienceCondition
  unless?: ExperienceCondition
  requiredData?: string[]
  periodicity: string
  dashboardSection: DashboardSectionId
  sortOrder: number
}

export interface StructureTemplate {
  extraDepartments: string[]
  extraCostCenters: string[]
  extraCategories: Array<{ name: string; type: 'revenue' | 'expense' | 'cost' }>
  oxrDimensions: string[]
  defaultUnitCodes: string[]
}

export interface ExperienceCatalog {
  analysisUnits: AnalysisUnitDef[]
  questions: ExperienceQuestion[]
  indicators: IndicatorDef[]
  structures: Record<string, StructureTemplate>
}

export interface EvaluationContext {
  segmentCode: string
  extraSegmentCodes: string[]
  answers: ExperienceAnswers
  analysisUnitCodes: string[]
}

export interface DashboardLayout {
  sections: Array<{
    id: DashboardSectionId
    title: string
    indicatorCodes: string[]
  }>
  favorites: string[]
  hidden: string[]
  order: string[]
}

export interface AppliedExperience {
  answers: ExperienceAnswers
  profile: {
    company_size: string | null
    employee_count: number | null
    employee_count_range: string | null
    state: string | null
    city: string | null
    operation_model: string | null
    revenue_model: string | null
    primary_activity: string | null
    profile_facts: Record<string, unknown>
    profile_summary: string
  }
  analysisUnitCodes: string[]
  extraOperations: Array<{ segmentCode: string; name: string }>
  indicatorCodes: string[]
  dashboard: DashboardLayout
  extraDepartments: string[]
  extraCostCenters: string[]
  extraCategories: Array<{ name: string; type: 'revenue' | 'expense' | 'cost' }>
  oxrDimensions: string[]
}

export interface CompanyOperation {
  id: string
  company_id: string
  segment_id: string | null
  name: string
  is_primary: boolean
  profile_facts: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CompanyAnalysisUnit {
  id: string
  company_id: string
  operation_id: string | null
  analysis_unit_id: string
  is_primary: boolean
  unit?: AnalysisUnitDef
}

export interface CompanyIndicatorRow {
  id: string
  company_id: string
  indicator_id: string
  enabled: boolean
  is_favorite: boolean
  sort_order: number
  target_value: number | null
  dashboard_visible: boolean
  operation_id: string | null
  indicator?: IndicatorDef & { id?: string }
}

export const DASHBOARD_SECTION_TITLES: Record<DashboardSectionId, string> = {
  financial: 'Visão financeira',
  operational: 'Visão operacional',
  budget_vs_actual: 'Orçado × Realizado',
  profitability: 'Visão de rentabilidade',
}
