import { QUESTIONS } from './catalog/questions.ts'
import {
  SALES_CHANNEL_INDICATORS,
  SALES_CHANNEL_OPTIONS,
  formatSalesChannels,
  overlaySalesChannelStructure,
  salesChannelIndicatorsFor,
  selectedSalesChannels,
} from './catalog/salesChannels.ts'
import type { StructureTemplate } from './types.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const channelQuestion = QUESTIONS.find((question) => question.code === 'com_channel')
assert(channelQuestion, 'pergunta de canal de venda existe')
assert(
  SALES_CHANNEL_OPTIONS.map((item) => item.label).join() ===
    'Loja física,E-commerce,Marketplace',
  'opções visíveis são loja física, e-commerce e marketplace'
)
assert(
  !channelQuestion.options?.some((item) => item.label === 'Online'),
  'online genérico deixou de ser opção — virou e-commerce/marketplace'
)

assert(selectedSalesChannels(['fisica']).join() === 'fisica', 'reconhece loja física')
assert(
  selectedSalesChannels(['online']).join() === 'ecommerce',
  'resposta antiga online vira e-commerce'
)
assert(
  selectedSalesChannels(['fisica', 'marketplace']).join() === 'fisica,marketplace',
  'mantém a ordem dos canais'
)
assert(
  formatSalesChannels(['fisica', 'ecommerce']) === 'Loja física, E-commerce',
  'rótulos dos canais no perfil'
)

const commerceBase: StructureTemplate = {
  extraDepartments: [],
  extraCostCenters: ['CMV'],
  extraCategories: [
    { name: 'CMV', type: 'cost' },
    { name: 'Vendas de mercadorias', type: 'revenue' },
  ],
  oxrDimensions: ['categoria', 'produto', 'canal'],
  defaultUnitCodes: ['sold_unit'],
}

function personalize(channels: string[]) {
  const structure = overlaySalesChannelStructure(commerceBase, ['commerce'], {
    com_channel: channels,
  })
  const indicators = salesChannelIndicatorsFor(channels)
  return {
    structure,
    codes: indicators.map((item) => item.code),
    indicators,
  }
}

const store = personalize(['fisica'])
assert(store.structure.extraDepartments.includes('Loja física'), 'loja física ganha departamento próprio')
assert(store.structure.extraCostCenters.includes('Aluguel da loja'), 'separa aluguel da loja')
assert(store.structure.extraCostCenters.includes('Energia da loja'), 'separa energia da loja')
assert(store.structure.extraCostCenters.includes('CMV'), 'mantém o CMV do comércio')
assert(
  !store.structure.extraCostCenters.includes('Taxas de marketplace'),
  'loja física não recebe taxas de marketplace'
)
assert(store.codes.includes('store_rent_cost'), 'aluguel vira indicador')
assert(store.codes.includes('store_avg_ticket'), 'ticket médio da loja')
assert(store.codes.includes('store_margin'), 'margem da loja física')
assert(!store.codes.includes('digital_cac'), 'CAC digital não aparece só no físico')
assert(
  !store.codes.includes('channel_revenue_compare'),
  'comparação físico × online exige os dois lados'
)
assert(
  store.indicators.some(
    (item) => item.code === 'store_margin' && item.dashboardSection === 'profitability'
  ),
  'margem da loja entra na visão de rentabilidade'
)

const ecommerce = personalize(['ecommerce'])
assert(ecommerce.structure.extraDepartments.includes('E-commerce'), 'e-commerce ganha departamento')
assert(ecommerce.structure.extraCostCenters.includes('Frete e logística'), 'separa frete e logística')
assert(ecommerce.structure.extraCostCenters.includes('Plataforma'), 'separa custo da plataforma')
assert(ecommerce.structure.extraCostCenters.includes('Anúncios digitais'), 'separa anúncios digitais')
assert(
  !ecommerce.structure.extraCostCenters.includes('Aluguel da loja'),
  'e-commerce não puxa aluguel da loja'
)
assert(ecommerce.codes.includes('ecom_shipping_cost'), 'frete online vira indicador')
assert(ecommerce.codes.includes('digital_cac'), 'CAC digital no e-commerce')
assert(ecommerce.codes.includes('ecom_conversion'), 'conversão do e-commerce')
assert(ecommerce.codes.includes('ecom_avg_ticket'), 'ticket médio do e-commerce')
assert(ecommerce.structure.defaultUnitCodes.includes('order'), 'pedidos viram unidade de análise')

const marketplace = personalize(['marketplace'])
assert(
  marketplace.structure.extraCostCenters.includes('Taxas de marketplace'),
  'separa taxas de marketplace'
)
assert(marketplace.codes.includes('mktp_fees'), 'taxas de marketplace viram indicador')
assert(marketplace.codes.includes('mktp_margin_after_fees'), 'margem após taxas de marketplace')
assert(!marketplace.codes.includes('ecom_conversion'), 'conversão fica no e-commerce próprio')
assert(!marketplace.codes.includes('store_energy_cost'), 'marketplace não puxa energia da loja')

const legacyOnline = personalize(['online'])
assert(legacyOnline.codes.includes('ecom_revenue'), 'resposta antiga online ainda personaliza o e-commerce')
assert(
  legacyOnline.structure.extraCostCenters.includes('Frete e logística'),
  'online antigo ainda separa frete'
)

const omni = personalize(['fisica', 'ecommerce'])
assert(omni.codes.includes('channel_revenue_compare'), 'compara faturamento físico × online')
assert(omni.codes.includes('channel_margin_compare'), 'compara margem por canal')
assert(omni.codes.includes('most_profitable_channel'), 'aponta o canal mais rentável')
assert(omni.codes.includes('channel_revenue_mix'), 'mostra mix de receita por canal')
assert(omni.structure.defaultUnitCodes.includes('sales_channel'), 'omnichannel analisa por canal')
assert(omni.structure.extraCostCenters.includes('Aluguel da loja'), 'omnichannel mantém custos da loja')
assert(omni.structure.extraCostCenters.includes('Frete e logística'), 'omnichannel mantém custos digitais')

const agro = overlaySalesChannelStructure(
  {
    extraDepartments: [],
    extraCostCenters: ['Insumos'],
    extraCategories: [],
    oxrDimensions: [],
    defaultUnitCodes: ['hectare'],
  },
  ['agro'],
  { com_channel: ['fisica'] }
)
assert(
  !agro.extraCostCenters.includes('Aluguel da loja'),
  'canal de venda não personaliza quem não é comércio'
)

const codes = SALES_CHANNEL_INDICATORS.map((item) => item.code)
assert(new Set(codes).size === codes.length, 'códigos de canal de venda são únicos')

console.log('sales channel personalization tests ok')
