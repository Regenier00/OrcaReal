import type { SegmentCode } from '@/features/company/segmentOptions'

export interface CostCenterSuggestion {
  name: string
  code: string
}

export interface StructureSuggestion {
  departments: string[]
  costCenters: CostCenterSuggestion[]
}

const SUGGESTIONS: Record<SegmentCode, StructureSuggestion> = {
  agro: {
    departments: [
      'Administrativo',
      'Pecuária',
      'Agrícola',
      'Financeiro',
      'Operacional',
    ],
    costCenters: [
      { name: 'Administrativo', code: 'ADM' },
      { name: 'Pecuária', code: 'PEC' },
      { name: 'Agrícola', code: 'AGR' },
      { name: 'Financeiro', code: 'FIN' },
      { name: 'Operacional', code: 'OPE' },
    ],
  },
  commerce: {
    departments: [
      'Administrativo',
      'Comercial',
      'Estoque',
      'Financeiro',
      'Operacional',
    ],
    costCenters: [
      { name: 'Administrativo', code: 'ADM' },
      { name: 'Comercial', code: 'COM' },
      { name: 'Estoque', code: 'EST' },
      { name: 'Financeiro', code: 'FIN' },
      { name: 'Operacional', code: 'OPE' },
    ],
  },
  industry: {
    departments: [
      'Administrativo',
      'Produção',
      'Qualidade',
      'Financeiro',
      'Logística',
    ],
    costCenters: [
      { name: 'Administrativo', code: 'ADM' },
      { name: 'Produção', code: 'PRD' },
      { name: 'Qualidade', code: 'QLD' },
      { name: 'Financeiro', code: 'FIN' },
      { name: 'Logística', code: 'LOG' },
    ],
  },
  services: {
    departments: [
      'Administrativo',
      'Comercial',
      'Operações',
      'Financeiro',
      'Pessoas',
    ],
    costCenters: [
      { name: 'Administrativo', code: 'ADM' },
      { name: 'Comercial', code: 'COM' },
      { name: 'Operações', code: 'OPE' },
      { name: 'Financeiro', code: 'FIN' },
      { name: 'Pessoas', code: 'RH' },
    ],
  },
  other: {
    departments: ['Administrativo', 'Financeiro', 'Operacional'],
    costCenters: [
      { name: 'Administrativo', code: 'ADM' },
      { name: 'Financeiro', code: 'FIN' },
      { name: 'Operacional', code: 'OPE' },
    ],
  },
}

export function structureSuggestionsFor(
  code: SegmentCode | string | null | undefined
): StructureSuggestion {
  if (code && code in SUGGESTIONS) {
    return SUGGESTIONS[code as SegmentCode]
  }
  return SUGGESTIONS.other
}
