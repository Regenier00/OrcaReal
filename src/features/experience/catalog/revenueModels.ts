import { indicator } from './helpers.ts'
import type { IndicatorDef, QuestionOption } from '../types.ts'
import type { SegmentUnitCostDef } from './segmentUnits.ts'

export const REVENUE_MODEL_QUESTION = 'revenue_model'

interface RevenueIndicatorSeed {
  indicatorCode: string
  indicatorName: string
  quantityNoun: string
  quantityNounSingular: string
  quantityPrompt: string
  quantityHelp: string
}

export interface RevenueModelDef {
  value: string
  label: string
  indicators: RevenueIndicatorSeed[]
}

function qty(
  indicatorCode: string,
  indicatorName: string,
  singular: string,
  plural: string,
  prompt: string,
  help: string
): RevenueIndicatorSeed {
  return {
    indicatorCode,
    indicatorName,
    quantityNounSingular: singular,
    quantityNoun: plural,
    quantityPrompt: prompt,
    quantityHelp: help,
  }
}

export const REVENUE_MODELS: RevenueModelDef[] = [
  {
    value: 'venda_de_produtos',
    label: 'Venda de produtos',
    indicators: [
      qty(
        'avg_sale_value',
        'Valor médio de venda',
        'venda',
        'vendas',
        'Quantas vendas foram realizadas no mês?',
        'Usamos a receita do mês dividida pelo número de vendas.'
      ),
      qty(
        'revenue_per_product_sold',
        'Receita por produto vendido',
        'produto vendido',
        'produtos vendidos',
        'Quantos produtos foram vendidos no mês?',
        'Usamos a receita do mês dividida pela quantidade de produtos vendidos.'
      ),
      qty(
        'product_avg_ticket',
        'Ticket médio de produto',
        'pedido',
        'pedidos',
        'Quantos pedidos de produto houve no mês?',
        'Usamos a receita do mês dividida pelo número de pedidos.'
      ),
    ],
  },
  {
    value: 'prestacao_de_servicos',
    label: 'Prestação de serviços',
    indicators: [
      qty(
        'avg_service_value',
        'Valor médio do serviço',
        'serviço',
        'serviços',
        'Quantos serviços foram realizados no mês?',
        'Usamos a receita do mês dividida pelo número de serviços.'
      ),
      qty(
        'revenue_per_service_client',
        'Receita por cliente de serviço',
        'cliente',
        'clientes',
        'Quantos clientes de serviço foram atendidos no mês?',
        'Usamos a receita do mês dividida pelos clientes atendidos.'
      ),
      qty(
        'revenue_per_service_hour',
        'Receita por hora de serviço',
        'hora de serviço',
        'horas de serviço',
        'Quantas horas de serviço foram prestadas no mês?',
        'Usamos a receita do mês dividida pelas horas prestadas.'
      ),
    ],
  },
  {
    value: 'receita_recorrente',
    label: 'Receita recorrente / assinatura',
    indicators: [
      qty(
        'revenue_per_subscriber',
        'Receita por assinante',
        'assinante',
        'assinantes',
        'Quantos assinantes ativos a empresa teve no mês?',
        'Usamos a receita do mês dividida pelos assinantes ativos.'
      ),
      qty(
        'avg_recurring_ticket',
        'Ticket recorrente médio',
        'assinatura',
        'assinaturas',
        'Quantas assinaturas ativas houve no mês?',
        'Usamos a receita do mês dividida pelo número de assinaturas.'
      ),
      qty(
        'revenue_per_recurring_client',
        'Receita por cliente recorrente',
        'cliente recorrente',
        'clientes recorrentes',
        'Quantos clientes recorrentes a empresa atendeu no mês?',
        'Usamos a receita do mês dividida pelos clientes recorrentes.'
      ),
    ],
  },
  {
    value: 'contratos',
    label: 'Contratos',
    indicators: [
      qty(
        'avg_contract_value',
        'Valor médio do contrato',
        'contrato',
        'contratos',
        'Quantos contratos geraram receita no mês?',
        'Usamos a receita do mês dividida pelo número de contratos.'
      ),
      qty(
        'revenue_per_active_contract',
        'Receita por contrato ativo',
        'contrato ativo',
        'contratos ativos',
        'Quantos contratos estavam ativos no mês?',
        'Usamos a receita do mês dividida pelos contratos ativos.'
      ),
      qty(
        'revenue_per_contract_client',
        'Receita por cliente contratado',
        'cliente contratado',
        'clientes contratados',
        'Quantos clientes contratados a empresa atendeu no mês?',
        'Usamos a receita do mês dividida pelos clientes com contrato.'
      ),
    ],
  },
  {
    value: 'producao_e_comercializacao',
    label: 'Produção e comercialização',
    indicators: [
      qty(
        'avg_production_sale_price',
        'Preço médio de venda',
        'unidade vendida',
        'unidades vendidas',
        'Quantas unidades foram vendidas no mês?',
        'Usamos a receita do mês dividida pelo volume vendido.'
      ),
      qty(
        'revenue_per_produced_unit_sale',
        'Receita por unidade produzida',
        'unidade produzida',
        'unidades produzidas',
        'Quantas unidades foram produzidas no mês?',
        'Usamos a receita do mês dividida pela produção do período.'
      ),
      qty(
        'revenue_per_production_batch',
        'Receita por lote',
        'lote',
        'lotes',
        'Quantos lotes foram comercializados no mês?',
        'Usamos a receita do mês dividida pelos lotes vendidos.'
      ),
    ],
  },
  {
    value: 'ecommerce_e_marketplace',
    label: 'E-commerce e marketplace',
    indicators: [
      qty(
        'ecommerce_avg_ticket',
        'Ticket médio online',
        'pedido online',
        'pedidos online',
        'Quantos pedidos online houve no mês?',
        'Usamos a receita do mês dividida pelo número de pedidos.'
      ),
      qty(
        'revenue_per_online_item',
        'Receita por item vendido online',
        'item vendido',
        'itens vendidos',
        'Quantos itens foram vendidos online no mês?',
        'Usamos a receita do mês dividida pelos itens vendidos.'
      ),
      qty(
        'revenue_per_online_customer',
        'Receita por cliente online',
        'cliente online',
        'clientes online',
        'Quantos clientes compraram online no mês?',
        'Usamos a receita do mês dividida pelos clientes online.'
      ),
    ],
  },
  {
    value: 'locacao_e_aluguel',
    label: 'Locação e aluguel',
    indicators: [
      qty(
        'avg_rental_value',
        'Valor médio de locação',
        'contrato de locação',
        'contratos de locação',
        'Quantos contratos de locação geraram receita no mês?',
        'Usamos a receita do mês dividida pelos contratos de locação.'
      ),
      qty(
        'revenue_per_rented_asset',
        'Receita por bem locado',
        'bem locado',
        'bens locados',
        'Quantos bens estavam locados no mês?',
        'Usamos a receita do mês dividida pelos bens locados.'
      ),
      qty(
        'revenue_per_rental_day',
        'Receita por diária de locação',
        'diária',
        'diárias',
        'Quantas diárias de locação houve no mês?',
        'Usamos a receita do mês dividida pelas diárias realizadas.'
      ),
    ],
  },
  {
    value: 'comissao_e_intermediacao',
    label: 'Comissão e intermediação',
    indicators: [
      qty(
        'avg_commission_value',
        'Comissão média',
        'operação',
        'operações',
        'Quantas operações comissionadas houve no mês?',
        'Usamos a receita do mês dividida pelas operações.'
      ),
      qty(
        'revenue_per_closed_deal',
        'Receita por negócio fechado',
        'negócio fechado',
        'negócios fechados',
        'Quantos negócios foram fechados no mês?',
        'Usamos a receita do mês dividida pelos negócios fechados.'
      ),
      qty(
        'revenue_per_intermediated_client',
        'Receita por cliente intermediado',
        'cliente intermediado',
        'clientes intermediados',
        'Quantos clientes foram intermediados no mês?',
        'Usamos a receita do mês dividida pelos clientes intermediados.'
      ),
    ],
  },
  {
    value: 'licenciamento_e_royalties',
    label: 'Licenciamento e royalties',
    indicators: [
      qty(
        'revenue_per_license',
        'Receita por licença',
        'licença',
        'licenças',
        'Quantas licenças geraram receita no mês?',
        'Usamos a receita do mês dividida pelo número de licenças.'
      ),
      qty(
        'avg_royalty_value',
        'Royalty médio',
        'contrato de royalty',
        'contratos de royalty',
        'Quantos contratos de royalty houve no mês?',
        'Usamos a receita do mês dividida pelos contratos de royalty.'
      ),
      qty(
        'revenue_per_licensed_client',
        'Receita por cliente licenciado',
        'cliente licenciado',
        'clientes licenciados',
        'Quantos clientes licenciados a empresa atendeu no mês?',
        'Usamos a receita do mês dividida pelos clientes licenciados.'
      ),
    ],
  },
  {
    value: 'publicidade_e_midia',
    label: 'Publicidade e mídia',
    indicators: [
      qty(
        'revenue_per_ad_campaign',
        'Receita por campanha',
        'campanha',
        'campanhas',
        'Quantas campanhas geraram receita no mês?',
        'Usamos a receita do mês dividida pelas campanhas.'
      ),
      qty(
        'avg_media_sale',
        'Ticket médio de mídia',
        'venda de mídia',
        'vendas de mídia',
        'Quantas vendas de mídia houve no mês?',
        'Usamos a receita do mês dividida pelas vendas de mídia.'
      ),
      qty(
        'revenue_per_advertiser',
        'Receita por anunciante',
        'anunciante',
        'anunciantes',
        'Quantos anunciantes geraram receita no mês?',
        'Usamos a receita do mês dividida pelos anunciantes.'
      ),
    ],
  },
  {
    value: 'eventos_e_ingressos',
    label: 'Eventos e ingressos',
    indicators: [
      qty(
        'avg_ticket_price',
        'Preço médio do ingresso',
        'ingresso',
        'ingressos',
        'Quantos ingressos foram vendidos no mês?',
        'Usamos a receita do mês dividida pelos ingressos vendidos.'
      ),
      qty(
        'revenue_per_event_sale',
        'Receita por evento',
        'evento',
        'eventos',
        'Quantos eventos geraram receita no mês?',
        'Usamos a receita do mês dividida pelos eventos.'
      ),
      qty(
        'revenue_per_attendee',
        'Receita por participante',
        'participante',
        'participantes',
        'Quantos participantes houve no mês?',
        'Usamos a receita do mês dividida pelos participantes.'
      ),
    ],
  },
  {
    value: 'franquias',
    label: 'Franquias',
    indicators: [
      qty(
        'revenue_per_franchise',
        'Receita por franquia',
        'franquia',
        'franquias',
        'Quantas franquias geraram receita no mês?',
        'Usamos a receita do mês dividida pelas franquias.'
      ),
      qty(
        'avg_franchise_fee',
        'Taxa média de franquia',
        'contrato de franquia',
        'contratos de franquia',
        'Quantos contratos de franquia houve no mês?',
        'Usamos a receita do mês dividida pelos contratos de franquia.'
      ),
      qty(
        'revenue_per_franchise_unit',
        'Receita por unidade franqueada',
        'unidade franqueada',
        'unidades franqueadas',
        'Quantas unidades franqueadas operaram no mês?',
        'Usamos a receita do mês dividida pelas unidades franqueadas.'
      ),
    ],
  },
  {
    value: 'revenda_e_distribuicao',
    label: 'Revenda e distribuição',
    indicators: [
      qty(
        'avg_resale_ticket',
        'Ticket médio de revenda',
        'pedido de revenda',
        'pedidos de revenda',
        'Quantos pedidos de revenda houve no mês?',
        'Usamos a receita do mês dividida pelos pedidos de revenda.'
      ),
      qty(
        'revenue_per_resale_item',
        'Receita por item revendido',
        'item revendido',
        'itens revendidos',
        'Quantos itens foram revendidos no mês?',
        'Usamos a receita do mês dividida pelos itens revendidos.'
      ),
      qty(
        'revenue_per_distribution_client',
        'Receita por cliente de distribuição',
        'cliente de distribuição',
        'clientes de distribuição',
        'Quantos clientes de distribuição a empresa atendeu no mês?',
        'Usamos a receita do mês dividida pelos clientes de distribuição.'
      ),
    ],
  },
  {
    value: 'mista',
    label: 'Mista',
    indicators: [
      qty(
        'mixed_avg_ticket',
        'Ticket médio',
        'transação',
        'transações',
        'Quantas transações geraram receita no mês?',
        'Usamos a receita do mês dividida pelo número de transações.'
      ),
      qty(
        'mixed_revenue_per_client',
        'Receita por cliente',
        'cliente',
        'clientes',
        'Quantos clientes geraram receita no mês?',
        'Usamos a receita do mês dividida pelos clientes.'
      ),
      qty(
        'mixed_avg_sale_value',
        'Valor médio por venda',
        'venda',
        'vendas',
        'Quantas vendas foram realizadas no mês?',
        'Usamos a receita do mês dividida pelo número de vendas.'
      ),
    ],
  },
]

export const REVENUE_MODEL_OPTIONS: QuestionOption[] = REVENUE_MODELS.map((item) => ({
  value: item.value,
  label: item.label,
}))

const MODEL_BY_VALUE = new Map(REVENUE_MODELS.map((item) => [item.value, item]))

export const REVENUE_MODEL_INDICATOR_CODES = new Set(
  REVENUE_MODELS.flatMap((model) => model.indicators.map((item) => item.indicatorCode))
)

export function isRevenueModelIndicator(code: string) {
  return REVENUE_MODEL_INDICATOR_CODES.has(code)
}

export function revenueModelLabel(value: string) {
  return MODEL_BY_VALUE.get(value)?.label ?? value.replace(/_/g, ' ')
}

export function parseRevenueModelValues(value: unknown): string[] {
  if (value == null) return []
  const raw = Array.isArray(value)
    ? value.map(String)
    : String(value)
        .split(',')
        .map((item) => item.trim())
  return raw.filter((item) => MODEL_BY_VALUE.has(item) || item === 'mista')
}

export function selectedRevenueModels(
  answers: Record<string, unknown>,
  profileRevenueModel?: string | null
): string[] {
  const fromAnswers = parseRevenueModelValues(answers[REVENUE_MODEL_QUESTION])
  if (fromAnswers.length > 0) return unique(fromAnswers)
  return unique(parseRevenueModelValues(profileRevenueModel))
}

export function revenueUnitCostsFor(modelValues: string[]): SegmentUnitCostDef[] {
  const seen = new Set<string>()
  const result: SegmentUnitCostDef[] = []
  for (const value of modelValues) {
    const model = MODEL_BY_VALUE.get(value)
    if (!model) continue
    for (const item of model.indicators) {
      if (seen.has(item.indicatorCode)) continue
      seen.add(item.indicatorCode)
      result.push({
        segmentCode: 'other',
        indicatorCode: item.indicatorCode,
        indicatorName: item.indicatorName,
        unitCode: item.quantityNounSingular.replace(/\s+/g, '_'),
        unitName: item.quantityNounSingular,
        displayUnit: `R$/${item.quantityNounSingular}`,
        quantityPrompt: item.quantityPrompt,
        quantityHelp: item.quantityHelp,
        quantityNoun: item.quantityNoun,
        quantityNounSingular: item.quantityNounSingular,
      })
    }
  }
  return result
}

export function revenueIndicatorGroupLabel(indicatorCode: string): string | null {
  for (const model of REVENUE_MODELS) {
    if (model.indicators.some((item) => item.indicatorCode === indicatorCode)) {
      return model.label
    }
  }
  return null
}

export const REVENUE_MODEL_INDICATORS: IndicatorDef[] = REVENUE_MODELS.flatMap((model, modelIndex) =>
  model.indicators.map((item, index) =>
    indicator(
      {
        code: item.indicatorCode,
        name: item.indicatorName,
        description: `${item.quantityHelp} Ativado quando a empresa gera receita por ${model.label.toLowerCase()}.`,
        category: 'financial',
        unit: `R$/${item.quantityNounSingular}`,
        formula: `receita / ${item.quantityNoun}`,
        segments: null,
        activation: { eq: { answer: REVENUE_MODEL_QUESTION, value: model.value } },
        dashboardSection: 'profitability',
      },
      2700 + modelIndex * 30 + index * 10
    )
  )
)

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}
