import { SEGMENT_UNIT_COSTS } from '@/features/experience/catalog/segmentUnits'
import { ANALYSIS_UNITS } from '@/features/experience/catalog/units'

export interface PickerUnit {
  key: string
  source: 'catalog' | 'custom'
  code: string
  name: string
  quantityNoun: string
  quantityNounSingular: string
  quantityPrompt: string
  quantityHelp: string
}

export function nounsForAnalysisUnit(code: string, fallbackName: string) {
  const fromSegment = SEGMENT_UNIT_COSTS.find((item) => item.unitCode === code)
  if (fromSegment) {
    return {
      singular: fromSegment.quantityNounSingular,
      plural: fromSegment.quantityNoun,
      prompt: fromSegment.quantityPrompt,
      help: fromSegment.quantityHelp,
    }
  }
  const name = fallbackName.trim() || 'unidade'
  const lower = name.toLowerCase()
  return {
    singular: lower,
    plural: lower,
    prompt: `Qual a quantidade de ${lower} no mês?`,
    help: `Informe a quantidade de ${lower} do mês para calcular o indicador.`,
  }
}

export function catalogPickerUnits(): PickerUnit[] {
  const seen = new Set<string>()
  const result: PickerUnit[] = []
  for (const unit of ANALYSIS_UNITS) {
    if (seen.has(unit.code)) continue
    seen.add(unit.code)
    const nouns = nounsForAnalysisUnit(unit.code, unit.name)
    result.push({
      key: `catalog:${unit.code}`,
      source: 'catalog',
      code: unit.code,
      name: unit.name,
      quantityNoun: nouns.plural,
      quantityNounSingular: nouns.singular,
      quantityPrompt: nouns.prompt,
      quantityHelp: nouns.help,
    })
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export function customIndicatorDefFromUnit(unit: {
  code: string
  name: string
  quantityNoun: string
  quantityNounSingular: string
  indicatorName: string
  displayUnit: string
  indicatorCode: string
}) {
  const lower = unit.quantityNoun
  return {
    indicatorCode: unit.indicatorCode,
    indicatorName: unit.indicatorName,
    displayUnit: unit.displayUnit,
    quantityPrompt: `Qual a quantidade de ${lower} no mês?`,
    quantityHelp: `Informe as ${lower} do mês para calcular o indicador.`,
    quantityNoun: unit.quantityNoun,
    quantityNounSingular: unit.quantityNounSingular,
  }
}
