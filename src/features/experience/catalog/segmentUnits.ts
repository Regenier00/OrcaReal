import type { SegmentCode } from '../../company/segmentOptions'

export interface SegmentUnitCostDef {
  segmentCode: SegmentCode
  indicatorCode: string
  indicatorName: string
  unitCode: string
  unitName: string
  displayUnit: string
  quantityPrompt: string
  quantityHelp: string
  quantityNoun: string
  quantityNounSingular: string
}

const defs: SegmentUnitCostDef[] = [
  {
    segmentCode: 'agro',
    indicatorCode: 'cost_per_hectare',
    indicatorName: 'Custo por hectare',
    unitCode: 'hectare',
    unitName: 'Hectare',
    displayUnit: 'R$/hectare',
    quantityPrompt: 'Quantos hectares foram utilizados no mês?',
    quantityHelp: 'Informe a área produtiva do mês para calcular o custo por hectare.',
    quantityNoun: 'hectares',
    quantityNounSingular: 'hectare',
  },
  {
    segmentCode: 'livestock',
    indicatorCode: 'cost_per_head',
    indicatorName: 'Custo por cabeça',
    unitCode: 'head',
    unitName: 'Cabeça',
    displayUnit: 'R$/cabeça',
    quantityPrompt: 'Qual a quantidade de cabeças de gado no mês?',
    quantityHelp: 'Usamos o rebanho do mês para calcular o custo por cabeça.',
    quantityNoun: 'cabeças',
    quantityNounSingular: 'cabeça',
  },
  {
    segmentCode: 'fishing',
    indicatorCode: 'cost_per_kg_fish',
    indicatorName: 'Custo por kg produzido',
    unitCode: 'kg',
    unitName: 'Kg produzido',
    displayUnit: 'R$/kg produzido',
    quantityPrompt: 'Quantos kg foram produzidos no mês?',
    quantityHelp: 'Informe o volume produzido no mês para calcular o custo por kg.',
    quantityNoun: 'kg produzidos',
    quantityNounSingular: 'kg produzido',
  },
  {
    segmentCode: 'commerce',
    indicatorCode: 'cost_per_sold_unit',
    indicatorName: 'Custo por produto vendido',
    unitCode: 'sold_unit',
    unitName: 'Produto vendido',
    displayUnit: 'R$/produto vendido',
    quantityPrompt: 'Quantos produtos foram vendidos no mês?',
    quantityHelp: 'Informe a quantidade vendida no mês para calcular o custo por produto.',
    quantityNoun: 'produtos vendidos',
    quantityNounSingular: 'produto vendido',
  },
  {
    segmentCode: 'industry',
    indicatorCode: 'cost_per_unit',
    indicatorName: 'Custo por unidade produzida',
    unitCode: 'produced_unit',
    unitName: 'Unidade produzida',
    displayUnit: 'R$/unidade produzida',
    quantityPrompt: 'Quantas unidades foram produzidas no mês?',
    quantityHelp: 'Informe o volume fabricado no mês para calcular o custo por unidade.',
    quantityNoun: 'unidades produzidas',
    quantityNounSingular: 'unidade produzida',
  },
  {
    segmentCode: 'construction',
    indicatorCode: 'cost_per_sqm',
    indicatorName: 'Custo por m² construído',
    unitCode: 'sqm',
    unitName: 'm² construído',
    displayUnit: 'R$/m² construído',
    quantityPrompt: 'Quantos m² foram construídos no mês?',
    quantityHelp: 'Informe a área construída no mês para calcular o custo por m².',
    quantityNoun: 'm² construídos',
    quantityNounSingular: 'm² construído',
  },
  {
    segmentCode: 'services',
    indicatorCode: 'cost_per_hour',
    indicatorName: 'Custo por hora trabalhada',
    unitCode: 'worked_hour',
    unitName: 'Hora trabalhada',
    displayUnit: 'R$/hora trabalhada',
    quantityPrompt: 'Quantas horas foram trabalhadas no mês?',
    quantityHelp: 'Informe as horas da operação no mês para calcular o custo por hora.',
    quantityNoun: 'horas trabalhadas',
    quantityNounSingular: 'hora trabalhada',
  },
  {
    segmentCode: 'tech',
    indicatorCode: 'cost_per_project_tech',
    indicatorName: 'Custo por projeto',
    unitCode: 'project',
    unitName: 'Projeto',
    displayUnit: 'R$/projeto',
    quantityPrompt: 'Quantos projetos foram realizados no mês?',
    quantityHelp: 'Informe os projetos do mês para calcular o custo por projeto.',
    quantityNoun: 'projetos',
    quantityNounSingular: 'projeto',
  },
  {
    segmentCode: 'tech',
    indicatorCode: 'cost_per_hour_tech',
    indicatorName: 'Custo por hora',
    unitCode: 'worked_hour',
    unitName: 'Hora trabalhada',
    displayUnit: 'R$/hora',
    quantityPrompt: 'Quantas horas foram trabalhadas no mês?',
    quantityHelp: 'Informe as horas da equipe no mês para calcular o custo por hora.',
    quantityNoun: 'horas trabalhadas',
    quantityNounSingular: 'hora trabalhada',
  },
  {
    segmentCode: 'transport_logistics',
    indicatorCode: 'cost_per_km',
    indicatorName: 'Custo por km rodado',
    unitCode: 'km',
    unitName: 'Km rodado',
    displayUnit: 'R$/km rodado',
    quantityPrompt: 'Quantos quilômetros foram rodados no mês?',
    quantityHelp: 'Informe a quilometragem do mês para calcular o custo por km.',
    quantityNoun: 'km rodados',
    quantityNounSingular: 'km rodado',
  },
  {
    segmentCode: 'food',
    indicatorCode: 'cost_per_meal',
    indicatorName: 'Custo por refeição',
    unitCode: 'meal',
    unitName: 'Refeição',
    displayUnit: 'R$/refeição',
    quantityPrompt: 'Quantas refeições foram servidas no mês?',
    quantityHelp: 'Informe as refeições do mês para calcular o custo por refeição.',
    quantityNoun: 'refeições',
    quantityNounSingular: 'refeição',
  },
  {
    segmentCode: 'hospitality',
    indicatorCode: 'cost_per_night',
    indicatorName: 'Custo por diária',
    unitCode: 'night',
    unitName: 'Diária',
    displayUnit: 'R$/diária',
    quantityPrompt: 'Quantas diárias foram realizadas no mês?',
    quantityHelp: 'Informe as diárias do mês para calcular o custo por diária.',
    quantityNoun: 'diárias',
    quantityNounSingular: 'diária',
  },
  {
    segmentCode: 'health',
    indicatorCode: 'cost_per_health_attendance',
    indicatorName: 'Custo por atendimento',
    unitCode: 'attendance',
    unitName: 'Atendimento',
    displayUnit: 'R$/atendimento',
    quantityPrompt: 'Quantos atendimentos foram realizados no mês?',
    quantityHelp: 'Informe os atendimentos do mês para calcular o custo por atendimento.',
    quantityNoun: 'atendimentos',
    quantityNounSingular: 'atendimento',
  },
  {
    segmentCode: 'education',
    indicatorCode: 'cost_per_student',
    indicatorName: 'Custo por aluno',
    unitCode: 'student',
    unitName: 'Aluno',
    displayUnit: 'R$/aluno',
    quantityPrompt: 'Quantos alunos a operação atendeu no mês?',
    quantityHelp: 'Informe o número de alunos do mês para calcular o custo por aluno.',
    quantityNoun: 'alunos',
    quantityNounSingular: 'aluno',
  },
  {
    segmentCode: 'real_estate',
    indicatorCode: 'cost_per_property',
    indicatorName: 'Custo por imóvel',
    unitCode: 'property',
    unitName: 'Imóvel',
    displayUnit: 'R$/imóvel',
    quantityPrompt: 'Quantos imóveis fizeram parte da operação no mês?',
    quantityHelp: 'Informe os imóveis do mês para calcular o custo por imóvel.',
    quantityNoun: 'imóveis',
    quantityNounSingular: 'imóvel',
  },
  {
    segmentCode: 'financial',
    indicatorCode: 'cost_per_operation',
    indicatorName: 'Custo por operação',
    unitCode: 'operation',
    unitName: 'Operação',
    displayUnit: 'R$/operação',
    quantityPrompt: 'Quantas operações foram realizadas no mês?',
    quantityHelp: 'Informe as operações financeiras do mês para calcular o custo por operação.',
    quantityNoun: 'operações',
    quantityNounSingular: 'operação',
  },
  {
    segmentCode: 'automotive',
    indicatorCode: 'cost_per_service',
    indicatorName: 'Custo por serviço realizado',
    unitCode: 'service',
    unitName: 'Serviço realizado',
    displayUnit: 'R$/serviço realizado',
    quantityPrompt: 'Quantos serviços foram realizados no mês?',
    quantityHelp: 'Informe os serviços do mês para calcular o custo por serviço.',
    quantityNoun: 'serviços realizados',
    quantityNounSingular: 'serviço realizado',
  },
  {
    segmentCode: 'energy',
    indicatorCode: 'cost_per_kwh',
    indicatorName: 'Custo por kWh produzido',
    unitCode: 'kwh',
    unitName: 'kWh produzido',
    displayUnit: 'R$/kWh produzido',
    quantityPrompt: 'Quantos kWh foram produzidos no mês?',
    quantityHelp: 'Informe a energia gerada no mês para calcular o custo por kWh.',
    quantityNoun: 'kWh produzidos',
    quantityNounSingular: 'kWh produzido',
  },
  {
    segmentCode: 'mining',
    indicatorCode: 'cost_per_ton_min',
    indicatorName: 'Custo por tonelada extraída',
    unitCode: 'ton',
    unitName: 'Tonelada extraída',
    displayUnit: 'R$/tonelada extraída',
    quantityPrompt: 'Quantas toneladas foram extraídas no mês?',
    quantityHelp: 'Informe o volume extraído no mês para calcular o custo por tonelada.',
    quantityNoun: 'toneladas extraídas',
    quantityNounSingular: 'tonelada extraída',
  },
  {
    segmentCode: 'media',
    indicatorCode: 'cost_per_campaign',
    indicatorName: 'Custo por campanha',
    unitCode: 'campaign',
    unitName: 'Campanha',
    displayUnit: 'R$/campanha',
    quantityPrompt: 'Quantas campanhas foram realizadas no mês?',
    quantityHelp: 'Informe as campanhas do mês para calcular o custo por campanha.',
    quantityNoun: 'campanhas',
    quantityNounSingular: 'campanha',
  },
  {
    segmentCode: 'marketing',
    indicatorCode: 'cost_per_project_media',
    indicatorName: 'Custo por projeto',
    unitCode: 'project',
    unitName: 'Projeto',
    displayUnit: 'R$/projeto',
    quantityPrompt: 'Quantos projetos foram realizados no mês?',
    quantityHelp: 'Informe os projetos do mês para calcular o custo por projeto.',
    quantityNoun: 'projetos',
    quantityNounSingular: 'projeto',
  },
  {
    segmentCode: 'entertainment',
    indicatorCode: 'cost_per_event',
    indicatorName: 'Custo por evento',
    unitCode: 'event',
    unitName: 'Evento',
    displayUnit: 'R$/evento',
    quantityPrompt: 'Quantos eventos foram realizados no mês?',
    quantityHelp: 'Informe os eventos do mês para calcular o custo por evento.',
    quantityNoun: 'eventos',
    quantityNounSingular: 'evento',
  },
  {
    segmentCode: 'sports',
    indicatorCode: 'cost_per_client_play',
    indicatorName: 'Custo por cliente',
    unitCode: 'client',
    unitName: 'Cliente',
    displayUnit: 'R$/cliente',
    quantityPrompt: 'Quantos clientes foram atendidos no mês?',
    quantityHelp: 'Informe os clientes do mês para calcular o custo por cliente.',
    quantityNoun: 'clientes',
    quantityNounSingular: 'cliente',
  },
  {
    segmentCode: 'beauty',
    indicatorCode: 'cost_per_attendance',
    indicatorName: 'Custo por atendimento',
    unitCode: 'attendance',
    unitName: 'Atendimento',
    displayUnit: 'R$/atendimento',
    quantityPrompt: 'Quantos atendimentos foram realizados no mês?',
    quantityHelp: 'Informe os atendimentos do mês para calcular o custo por atendimento.',
    quantityNoun: 'atendimentos',
    quantityNounSingular: 'atendimento',
  },
  {
    segmentCode: 'professional',
    indicatorCode: 'cost_per_hour',
    indicatorName: 'Custo por hora trabalhada',
    unitCode: 'worked_hour',
    unitName: 'Hora trabalhada',
    displayUnit: 'R$/hora trabalhada',
    quantityPrompt: 'Quantas horas foram trabalhadas no mês?',
    quantityHelp: 'Informe as horas da operação no mês para calcular o custo por hora.',
    quantityNoun: 'horas trabalhadas',
    quantityNounSingular: 'hora trabalhada',
  },
  {
    segmentCode: 'environment',
    indicatorCode: 'cost_per_ton_env',
    indicatorName: 'Custo por tonelada processada',
    unitCode: 'ton',
    unitName: 'Tonelada processada',
    displayUnit: 'R$/tonelada processada',
    quantityPrompt: 'Quantas toneladas foram processadas no mês?',
    quantityHelp: 'Informe o volume processado no mês para calcular o custo por tonelada.',
    quantityNoun: 'toneladas processadas',
    quantityNounSingular: 'tonelada processada',
  },
  {
    segmentCode: 'public_admin',
    indicatorCode: 'cost_per_service_pub',
    indicatorName: 'Custo por serviço realizado',
    unitCode: 'public_service',
    unitName: 'Serviço realizado',
    displayUnit: 'R$/serviço realizado',
    quantityPrompt: 'Quantos serviços foram realizados no mês?',
    quantityHelp: 'Informe os serviços do mês para calcular o custo por serviço.',
    quantityNoun: 'serviços realizados',
    quantityNounSingular: 'serviço realizado',
  },
  {
    segmentCode: 'other',
    indicatorCode: 'cost_per_operation_unit',
    indicatorName: 'Custo por unidade de operação',
    unitCode: 'operation_unit',
    unitName: 'Unidade de operação',
    displayUnit: 'R$/unidade de operação',
    quantityPrompt: 'Qual a quantidade de unidades de operação no mês?',
    quantityHelp: 'Informe as unidades usadas para medir a operação neste mês.',
    quantityNoun: 'unidades de operação',
    quantityNounSingular: 'unidade de operação',
  },
]

export const SEGMENT_UNIT_COSTS: SegmentUnitCostDef[] = defs

export const UNIT_COST_INDICATOR_CODES = new Set(
  defs.map((item) => item.indicatorCode)
)

export function unitCostsForSegments(segmentCodes: string[]): SegmentUnitCostDef[] {
  const wanted = new Set(segmentCodes.filter(Boolean))
  const seen = new Set<string>()
  const result: SegmentUnitCostDef[] = []

  for (const def of defs) {
    if (!wanted.has(def.segmentCode)) continue
    if (seen.has(def.indicatorCode)) continue
    seen.add(def.indicatorCode)
    result.push(def)
  }

  return result
}

export function defaultUnitCodesForSegments(segmentCodes: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const def of unitCostsForSegments(segmentCodes)) {
    if (seen.has(def.unitCode)) continue
    seen.add(def.unitCode)
    result.push(def.unitCode)
  }
  return result
}

export function unitCostByIndicator(code: string): SegmentUnitCostDef | undefined {
  return defs.find((item) => item.indicatorCode === code)
}
