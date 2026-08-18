import { ANALYSIS_UNITS } from './units'
import { QUESTIONS } from './questions'
import { INDICATORS } from './indicators'
import { STRUCTURES, structureFor } from './structures'
import {
  SEGMENT_UNIT_COSTS,
  defaultUnitCodesForSegments,
  unitCostsForSegments,
} from './segmentUnits'
import { EMPLOYEE_HEADCOUNT_COSTS } from './employeeHeadcount'
import { REVENUE_MODEL_OPTIONS } from './revenueModels'
import type { ExperienceCatalog } from '../types'

export const builtinCatalog: ExperienceCatalog = {
  analysisUnits: ANALYSIS_UNITS,
  questions: QUESTIONS,
  indicators: INDICATORS,
  structures: STRUCTURES,
}

export {
  ANALYSIS_UNITS,
  QUESTIONS,
  INDICATORS,
  STRUCTURES,
  structureFor,
  SEGMENT_UNIT_COSTS,
  EMPLOYEE_HEADCOUNT_COSTS,
  REVENUE_MODEL_OPTIONS,
  defaultUnitCodesForSegments,
  unitCostsForSegments,
}
