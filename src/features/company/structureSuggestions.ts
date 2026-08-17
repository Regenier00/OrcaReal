import type { SegmentCode } from '@/features/company/segmentOptions'

export interface StructureSuggestion {
  departments: string[]
  costCenters: string[]
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
      'Administrativo',
      'Pecuária',
      'Agrícola',
      'Financeiro',
      'Operacional',
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
      'Administrativo',
      'Comercial',
      'Estoque',
      'Financeiro',
      'Operacional',
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
      'Administrativo',
      'Produção',
      'Qualidade',
      'Financeiro',
      'Logística',
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
      'Administrativo',
      'Comercial',
      'Operações',
      'Financeiro',
      'Pessoas',
    ],
  },
  other: {
    departments: ['Administrativo', 'Financeiro', 'Operacional'],
    costCenters: ['Administrativo', 'Financeiro', 'Operacional'],
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

export function sequentialCostCenterCode(index: number): string {
  const next = index + 1
  return String(next).padStart(Math.max(3, String(next).length), '0')
}
