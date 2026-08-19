import { indicator } from './helpers.ts'
import type {
  ExperienceAnswers,
  ExperienceCondition,
  IndicatorDef,
  QuestionOption,
  StructureTemplate,
} from '../types.ts'

export const SALES_CHANNEL_QUESTION = 'com_channel'

export type SalesChannelId = 'fisica' | 'ecommerce' | 'marketplace'

export interface SalesChannelDef {
  id: SalesChannelId
  value: string
  aliases: string[]
  label: string
  structure: StructureTemplate
}

const PHYSICAL_VALUES = ['fisica', 'loja_fisica']
const ECOMMERCE_VALUES = ['ecommerce', 'e_commerce', 'online']
const MARKETPLACE_VALUES = ['marketplace']
const DIGITAL_VALUES = [...ECOMMERCE_VALUES, ...MARKETPLACE_VALUES]

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const key = value.trim()
    if (!key || seen.has(key.toLowerCase())) continue
    seen.add(key.toLowerCase())
    result.push(value)
  }
  return result
}

function uniqueBy<T>(values: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const value of values) {
    const key = keyOf(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function asList(value: unknown): string[] {
  if (value == null || value === '__skipped__') return []
  if (Array.isArray(value)) return value.map(String)
  const text = String(value).trim()
  if (!text) return []
  if (text.includes(',')) return text.split(',').map((item) => item.trim()).filter(Boolean)
  return [text]
}

function channelIn(values: string[]): ExperienceCondition {
  return { in: { answer: SALES_CHANNEL_QUESTION, values } }
}

export const SALES_CHANNELS: SalesChannelDef[] = [
  {
    id: 'fisica',
    value: 'fisica',
    aliases: ['loja_fisica'],
    label: 'Loja física',
    structure: {
      extraDepartments: ['Loja física'],
      extraCostCenters: ['Aluguel da loja', 'Energia da loja', 'Pessoal da loja'],
      extraCategories: [
        { name: 'Vendas loja física', type: 'revenue' },
        { name: 'Aluguel da loja', type: 'expense' },
        { name: 'Energia da loja', type: 'expense' },
        { name: 'Pessoal da loja', type: 'expense' },
      ],
      oxrDimensions: ['loja', 'canal'],
      defaultUnitCodes: ['store'],
    },
  },
  {
    id: 'ecommerce',
    value: 'ecommerce',
    aliases: ['e_commerce', 'online'],
    label: 'E-commerce',
    structure: {
      extraDepartments: ['E-commerce'],
      extraCostCenters: ['Frete e logística', 'Plataforma', 'Anúncios digitais'],
      extraCategories: [
        { name: 'Vendas e-commerce', type: 'revenue' },
        { name: 'Frete sobre vendas', type: 'expense' },
        { name: 'Plataforma', type: 'expense' },
        { name: 'Anúncios digitais', type: 'expense' },
      ],
      oxrDimensions: ['pedido', 'canal'],
      defaultUnitCodes: ['order'],
    },
  },
  {
    id: 'marketplace',
    value: 'marketplace',
    aliases: [],
    label: 'Marketplace',
    structure: {
      extraDepartments: ['Marketplace'],
      extraCostCenters: ['Taxas de marketplace', 'Comissões de marketplace'],
      extraCategories: [
        { name: 'Vendas marketplace', type: 'revenue' },
        { name: 'Taxas de marketplace', type: 'expense' },
        { name: 'Comissões de marketplace', type: 'expense' },
      ],
      oxrDimensions: ['marketplace', 'canal'],
      defaultUnitCodes: ['order'],
    },
  },
]

const OMNI_STRUCTURE: StructureTemplate = {
  extraDepartments: [],
  extraCostCenters: [],
  extraCategories: [],
  oxrDimensions: ['canal'],
  defaultUnitCodes: ['sales_channel'],
}

const CHANNEL_BY_VALUE = new Map<string, SalesChannelDef>()
for (const channel of SALES_CHANNELS) {
  CHANNEL_BY_VALUE.set(channel.value, channel)
  for (const alias of channel.aliases) CHANNEL_BY_VALUE.set(alias, channel)
}

export const SALES_CHANNEL_OPTIONS: QuestionOption[] = SALES_CHANNELS.map((channel) => ({
  value: channel.value,
  label: channel.label,
}))

export function salesChannelLabel(value: string): string {
  return CHANNEL_BY_VALUE.get(value)?.label ?? value.replace(/_/g, ' ')
}

export function selectedSalesChannels(value: unknown): SalesChannelId[] {
  const selected = new Set<SalesChannelId>()
  for (const raw of asList(value)) {
    const key = raw.trim().toLowerCase()
    const match = CHANNEL_BY_VALUE.get(key)
    if (match) selected.add(match.id)
  }
  return SALES_CHANNELS.map((channel) => channel.id).filter((id) => selected.has(id))
}

export function hasPhysicalSalesChannel(channels: SalesChannelId[]) {
  return channels.includes('fisica')
}

export function hasDigitalSalesChannel(channels: SalesChannelId[]) {
  return channels.includes('ecommerce') || channels.includes('marketplace')
}

export function isOmnichannelSales(channels: SalesChannelId[]) {
  return hasPhysicalSalesChannel(channels) && hasDigitalSalesChannel(channels)
}

export function formatSalesChannels(value: unknown): string {
  const labels = selectedSalesChannels(value).map((id) => {
    const channel = SALES_CHANNELS.find((item) => item.id === id)
    return channel?.label ?? id
  })
  return labels.join(', ')
}

export function salesChannelIndicatorsFor(value: unknown): IndicatorDef[] {
  const answers = asList(value)
  return SALES_CHANNEL_INDICATORS.filter((item) =>
    matchesChannelActivation(item.activation, answers)
  )
}

function matchesChannelActivation(
  condition: ExperienceCondition | undefined,
  answers: string[]
): boolean {
  if (!condition) return true
  if ('all' in condition) {
    return condition.all.every((item) => matchesChannelActivation(item, answers))
  }
  if ('any' in condition) {
    return condition.any.some((item) => matchesChannelActivation(item, answers))
  }
  if ('in' in condition) {
    const allowed = condition.in.values.map(String)
    return answers.some((item) => allowed.includes(item))
  }
  if ('eq' in condition) {
    return answers.includes(String(condition.eq.value))
  }
  return true
}

export function overlaySalesChannelStructure(
  structure: StructureTemplate,
  segmentCodes: string[],
  answers: ExperienceAnswers
): StructureTemplate {
  if (!segmentCodes.includes('commerce')) return structure
  const channels = selectedSalesChannels(answers[SALES_CHANNEL_QUESTION])
  if (channels.length === 0) return structure

  const overlays = channels
    .map((id) => SALES_CHANNELS.find((item) => item.id === id)?.structure)
    .filter((item): item is StructureTemplate => Boolean(item))
  if (isOmnichannelSales(channels)) overlays.push(OMNI_STRUCTURE)

  return {
    extraDepartments: unique([
      ...structure.extraDepartments,
      ...overlays.flatMap((item) => item.extraDepartments),
    ]),
    extraCostCenters: unique([
      ...structure.extraCostCenters,
      ...overlays.flatMap((item) => item.extraCostCenters),
    ]),
    extraCategories: uniqueBy(
      [...structure.extraCategories, ...overlays.flatMap((item) => item.extraCategories)],
      (item) => `${item.type}:${item.name.toLowerCase()}`
    ),
    oxrDimensions: unique([
      ...structure.oxrDimensions,
      ...overlays.flatMap((item) => item.oxrDimensions),
    ]),
    defaultUnitCodes: unique([
      ...structure.defaultUnitCodes,
      ...overlays.flatMap((item) => item.defaultUnitCodes),
    ]),
  }
}

function channelIndicator(
  partial: Omit<IndicatorDef, 'periodicity' | 'sortOrder' | 'requiredData' | 'segments' | 'category'> & {
    channels: string[]
    section?: IndicatorDef['dashboardSection']
    requiredData?: string[]
    extraActivation?: ExperienceCondition
  },
  sortOrder: number
): IndicatorDef {
  const channelActivation = channelIn(partial.channels)
  return indicator(
    {
      code: partial.code,
      name: partial.name,
      description: partial.description,
      category: 'operational',
      unit: partial.unit,
      formula: partial.formula,
      segments: ['commerce'],
      activation: partial.extraActivation
        ? { all: [channelActivation, partial.extraActivation] }
        : channelActivation,
      dashboardSection: partial.section ?? partial.dashboardSection ?? 'operational',
      requiredData: partial.requiredData,
    },
    sortOrder
  )
}

export const SALES_CHANNEL_INDICATORS: IndicatorDef[] = [
  channelIndicator(
    {
      code: 'store_revenue',
      name: 'Receita da loja física',
      description: 'Faturamento classificado no canal loja física.',
      unit: 'R$',
      formula: 'receita da loja física',
      channels: PHYSICAL_VALUES,
      section: 'financial',
    },
    5300
  ),
  channelIndicator(
    {
      code: 'store_operating_cost',
      name: 'Custo da loja física',
      description: 'Custos e despesas do ponto físico: aluguel, energia, pessoal e manutenção.',
      unit: 'R$',
      formula: 'aluguel + energia + pessoal da loja',
      channels: PHYSICAL_VALUES,
    },
    5310
  ),
  channelIndicator(
    {
      code: 'store_rent_cost',
      name: 'Aluguel da loja',
      description: 'Custo de aluguel do ponto de venda físico.',
      unit: 'R$',
      formula: 'aluguel da loja',
      channels: PHYSICAL_VALUES,
    },
    5320
  ),
  channelIndicator(
    {
      code: 'store_energy_cost',
      name: 'Energia da loja',
      description: 'Energia elétrica e utilidades do ponto físico.',
      unit: 'R$',
      formula: 'energia da loja',
      channels: PHYSICAL_VALUES,
    },
    5330
  ),
  channelIndicator(
    {
      code: 'store_margin',
      name: 'Margem da loja física',
      description: 'Resultado da loja física em relação à receita do canal.',
      unit: '%',
      formula: '(receita da loja − custos da loja) / receita da loja',
      channels: PHYSICAL_VALUES,
      section: 'profitability',
    },
    5340
  ),
  channelIndicator(
    {
      code: 'store_avg_ticket',
      name: 'Ticket médio da loja física',
      description: 'Receita da loja física dividida pelas vendas do ponto.',
      unit: 'R$',
      formula: 'receita da loja física / vendas físicas',
      channels: PHYSICAL_VALUES,
      section: 'profitability',
    },
    5350
  ),
  channelIndicator(
    {
      code: 'ecom_revenue',
      name: 'Receita do e-commerce',
      description: 'Faturamento das vendas no e-commerce próprio.',
      unit: 'R$',
      formula: 'receita do e-commerce',
      channels: ECOMMERCE_VALUES,
      section: 'financial',
    },
    5360
  ),
  channelIndicator(
    {
      code: 'ecom_margin',
      name: 'Margem do e-commerce',
      description: 'Resultado do e-commerce depois de frete, plataforma e anúncios.',
      unit: '%',
      formula: '(receita e-commerce − custos e-commerce) / receita e-commerce',
      channels: ECOMMERCE_VALUES,
      section: 'profitability',
    },
    5370
  ),
  channelIndicator(
    {
      code: 'ecom_avg_ticket',
      name: 'Ticket médio do e-commerce',
      description: 'Receita online dividida pelos pedidos do e-commerce.',
      unit: 'R$',
      formula: 'receita do e-commerce / pedidos online',
      channels: ECOMMERCE_VALUES,
      section: 'profitability',
    },
    5380
  ),
  channelIndicator(
    {
      code: 'ecom_shipping_cost',
      name: 'Frete e logística online',
      description: 'Custo de frete, embalagem e logística das vendas online.',
      unit: 'R$',
      formula: 'frete + logística das vendas online',
      channels: DIGITAL_VALUES,
    },
    5390
  ),
  channelIndicator(
    {
      code: 'ecom_platform_cost',
      name: 'Custo da plataforma',
      description: 'Mensalidade, gateway e ferramentas da loja virtual.',
      unit: 'R$',
      formula: 'custo da plataforma de e-commerce',
      channels: ECOMMERCE_VALUES,
    },
    5400
  ),
  channelIndicator(
    {
      code: 'digital_cac',
      name: 'CAC digital',
      description: 'Custo de aquisição de clientes no digital: anúncios e mídia divididos pelos novos clientes.',
      unit: 'R$',
      formula: 'anúncios digitais / novos clientes',
      channels: DIGITAL_VALUES,
      section: 'profitability',
    },
    5410
  ),
  channelIndicator(
    {
      code: 'ecom_conversion',
      name: 'Conversão do e-commerce',
      description: 'Pedidos concluídos em relação às visitas da loja virtual.',
      unit: '%',
      formula: 'pedidos / visitas',
      channels: ECOMMERCE_VALUES,
    },
    5420
  ),
  channelIndicator(
    {
      code: 'mktp_revenue',
      name: 'Receita de marketplace',
      description: 'Faturamento das vendas em marketplaces.',
      unit: 'R$',
      formula: 'receita de marketplace',
      channels: MARKETPLACE_VALUES,
      section: 'financial',
    },
    5430
  ),
  channelIndicator(
    {
      code: 'mktp_fees',
      name: 'Taxas de marketplace',
      description: 'Comissões e taxas cobradas pelos marketplaces.',
      unit: 'R$',
      formula: 'taxas + comissões de marketplace',
      channels: MARKETPLACE_VALUES,
    },
    5440
  ),
  channelIndicator(
    {
      code: 'mktp_margin_after_fees',
      name: 'Margem após taxas de marketplace',
      description: 'Resultado do marketplace depois das taxas e comissões da plataforma.',
      unit: '%',
      formula: '(receita marketplace − custos − taxas) / receita marketplace',
      channels: MARKETPLACE_VALUES,
      section: 'profitability',
    },
    5450
  ),
  channelIndicator(
    {
      code: 'mktp_avg_ticket',
      name: 'Ticket médio de marketplace',
      description: 'Receita de marketplace dividida pelos pedidos do canal.',
      unit: 'R$',
      formula: 'receita de marketplace / pedidos de marketplace',
      channels: MARKETPLACE_VALUES,
      section: 'profitability',
    },
    5460
  ),
  channelIndicator(
    {
      code: 'channel_revenue_compare',
      name: 'Faturamento físico × online',
      description: 'Compara a receita da loja física com a receita dos canais digitais.',
      unit: 'R$',
      formula: 'receita física e receita online lado a lado',
      channels: PHYSICAL_VALUES,
      extraActivation: channelIn(DIGITAL_VALUES),
      section: 'financial',
    },
    5470
  ),
  channelIndicator(
    {
      code: 'channel_revenue_mix',
      name: 'Mix de receita por canal',
      description: 'Participação de cada canal no faturamento total.',
      unit: '%',
      formula: 'receita do canal / receita total',
      channels: PHYSICAL_VALUES,
      extraActivation: channelIn(DIGITAL_VALUES),
      section: 'profitability',
    },
    5480
  ),
  channelIndicator(
    {
      code: 'channel_margin_compare',
      name: 'Margem por canal',
      description: 'Compara a margem da loja física com a margem dos canais digitais.',
      unit: '%',
      formula: 'margem física × margem online',
      channels: PHYSICAL_VALUES,
      extraActivation: channelIn(DIGITAL_VALUES),
      section: 'profitability',
    },
    5490
  ),
  channelIndicator(
    {
      code: 'most_profitable_channel',
      name: 'Canal mais rentável',
      description: 'Indica qual canal — loja física, e-commerce ou marketplace — gera o melhor resultado.',
      unit: 'canal',
      formula: 'canal com maior lucro',
      channels: PHYSICAL_VALUES,
      extraActivation: channelIn(DIGITAL_VALUES),
      section: 'profitability',
    },
    5500
  ),
  channelIndicator(
    {
      code: 'oxr_per_channel',
      name: 'Orçado × Realizado por canal',
      description: 'Acompanha o desvio orçamentário de cada canal de venda.',
      unit: 'R$',
      formula: 'orçado e realizado por canal',
      channels: [...PHYSICAL_VALUES, ...DIGITAL_VALUES],
      section: 'budget_vs_actual',
    },
    5510
  ),
]
