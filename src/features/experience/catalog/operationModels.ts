import { indicator } from './helpers.ts'
import {
  breakEven,
  cost,
  div,
  employeeCount,
  input,
  lit,
  max,
  min,
  mul,
  operatingCost,
  pct,
  previousRevenue,
  profit,
  revenue,
  sub,
  sum,
  type FormulaNode,
} from '../../indicators/operationalFormula.ts'
import type { IndicatorDef, QuestionOption } from '../types.ts'

export const OPERATION_MODEL_QUESTION = 'operation_model'
export const OPERATION_PRIORITIES_QUESTION = 'operation_priorities'

export type OperationModelId = 'own' | 'leased' | 'outsourced' | 'mixed' | 'franchise'
export type OperationalFormat = 'money' | 'pct' | 'number' | 'months' | 'ratio'

export interface OperationalInputDef {
  key: string
  label: string
  prompt: string
  help: string
  kind: 'money' | 'quantity' | 'pct'
}

export interface OperationalBreakdown {
  label: string
  formula: FormulaNode
}

export interface OperationalIndicatorSeed {
  code: string
  name: string
  description: string
  unit: string
  format: OperationalFormat
  formula: FormulaNode
  formulaHint: string
  inputs: OperationalInputDef[]
  breakdown?: OperationalBreakdown[]
}

export interface OperationModelDef {
  id: OperationModelId
  value: string
  aliases: string[]
  label: string
  indicators: OperationalIndicatorSeed[]
}

function money(
  key: string,
  label: string,
  prompt: string,
  help: string
): OperationalInputDef {
  return { key, label, prompt, help, kind: 'money' }
}

function qty(
  key: string,
  label: string,
  prompt: string,
  help: string
): OperationalInputDef {
  return { key, label, prompt, help, kind: 'quantity' }
}

function rate(
  key: string,
  label: string,
  prompt: string,
  help: string
): OperationalInputDef {
  return { key, label, prompt, help, kind: 'pct' }
}

const OWN = {
  units: qty(
    'units_produced',
    'Unidades produzidas',
    'Quantas unidades foram produzidas no período?',
    'Usamos o volume produzido para dividir custos e depreciação.'
  ),
  investment: money(
    'investment',
    'Capital investido',
    'Qual é o capital investido na operação?',
    'O ROI divide o lucro pelo capital investido.'
  ),
  fixed: money(
    'fixed_costs',
    'Custos fixos',
    'Qual é o total de custos fixos do período?',
    'O ponto de equilíbrio usa os custos fixos e a margem de contribuição do realizado.'
  ),
  depreciation: money(
    'depreciation',
    'Depreciação',
    'Qual é a depreciação do período?',
    'O indicador divide a depreciação pelas unidades produzidas.'
  ),
}

const LEASE = {
  lease: money(
    'lease_cost',
    'Custo de arrendamento',
    'Qual é o custo de arrendamento do período?',
    'Informe o valor pago pelo arrendamento no mês.'
  ),
  units: qty(
    'leased_units',
    'Área ou unidades arrendadas',
    'Qual é a área ou a quantidade de unidades arrendadas?',
    'Hectares, m², ativos ou outra unidade que vocês usam.'
  ),
  assetValue: money(
    'leased_asset_value',
    'Valor do ativo/área arrendada',
    'Qual é o valor do ativo ou da área arrendada?',
    'A rentabilidade divide o lucro por esse valor.'
  ),
  area: qty(
    'leased_area',
    'Área arrendada',
    'Qual é a área arrendada no período?',
    'Informe a área quando for acompanhar indicadores por hectare ou m².'
  ),
  ownCost: money(
    'ownership_cost',
    'Custo de possuir',
    'Qual seria o custo de possuir o mesmo ativo?',
    'Comparamos o custo de arrendar com o custo de possuir.'
  ),
}

const OUT = {
  outsourcing: money(
    'outsourcing_cost',
    'Custo de terceirização',
    'Qual é o custo de terceirização do período?',
    'Valores pagos a terceiros pela operação.'
  ),
  units: qty(
    'outsourced_units',
    'Unidades da operação terceirizada',
    'Quantas unidades a operação terceirizada produziu?',
    'Usamos esse volume para o custo terceirizado por unidade.'
  ),
  internal: money(
    'internal_cost',
    'Custo interno comparável',
    'Qual seria o custo interno da mesma operação?',
    'Usado na comparação e na economia com terceirização.'
  ),
  services: qty(
    'contracted_services',
    'Serviços contratados',
    'Quantos serviços foram contratados no período?',
    'O custo por serviço divide a terceirização por essa quantidade.'
  ),
  delivered: qty(
    'delivered_units',
    'Unidades entregues',
    'Quantas unidades o terceiro entregou?',
    'Usamos as entregas na produtividade e no custo por unidade entregue.'
  ),
  thirdParties: qty(
    'third_party_count',
    'Quantidade de terceiros',
    'Quantos terceiros atuaram na operação?',
    'A produtividade do terceiro divide as entregas por essa quantidade.'
  ),
}

const MIX = {
  ownCost: money('own_cost', 'Custo da operação própria', 'Qual é o custo da operação própria?', 'Parte própria dos custos do período.'),
  leaseCost: money('lease_cost', 'Custo da operação arrendada', 'Qual é o custo da operação arrendada?', 'Parte arrendada dos custos do período.'),
  outCost: money('out_cost', 'Custo da operação terceirizada', 'Qual é o custo da operação terceirizada?', 'Parte terceirizada dos custos do período.'),
  ownRevenue: money('own_revenue', 'Receita da operação própria', 'Qual é a receita da operação própria?', 'Receita gerada pelo modelo próprio.'),
  leaseRevenue: money('lease_revenue', 'Receita da operação arrendada', 'Qual é a receita da operação arrendada?', 'Receita gerada pelo modelo arrendado.'),
  outRevenue: money('out_revenue', 'Receita da operação terceirizada', 'Qual é a receita da operação terceirizada?', 'Receita gerada pelo modelo terceirizado.'),
  ownUnits: qty('own_units', 'Unidades da operação própria', 'Quantas unidades a operação própria produziu?', 'Volume do modelo próprio.'),
  leaseUnits: qty('lease_units', 'Unidades da operação arrendada', 'Quantas unidades a operação arrendada produziu?', 'Volume do modelo arrendado.'),
  outUnits: qty('out_units', 'Unidades da operação terceirizada', 'Quantas unidades a operação terceirizada produziu?', 'Volume do modelo terceirizado.'),
  ownInvestment: money('own_investment', 'Investimento da operação própria', 'Qual é o investimento da operação própria?', 'Capital alocado no modelo próprio.'),
  leaseInvestment: money('lease_investment', 'Investimento da operação arrendada', 'Qual é o investimento da operação arrendada?', 'Capital alocado no modelo arrendado.'),
  outInvestment: money('out_investment', 'Investimento da operação terceirizada', 'Qual é o investimento da operação terceirizada?', 'Capital alocado no modelo terceirizado.'),
  ownFixed: money('own_fixed', 'Custos fixos da operação própria', 'Qual é o custo fixo da operação própria?', 'Usado no ponto de equilíbrio do modelo próprio.'),
  leaseFixed: money('lease_fixed', 'Custos fixos da operação arrendada', 'Qual é o custo fixo da operação arrendada?', 'Usado no ponto de equilíbrio do modelo arrendado.'),
  outFixed: money('out_fixed', 'Custos fixos da operação terceirizada', 'Qual é o custo fixo da operação terceirizada?', 'Usado no ponto de equilíbrio do modelo terceirizado.'),
}

const FR = {
  sales: qty(
    'sales_count',
    'Vendas do período',
    'Quantas vendas a unidade realizou no período?',
    'O ticket médio divide o faturamento por essa quantidade.'
  ),
  cogs: money(
    'cogs',
    'CMV',
    'Qual é o custo da mercadoria vendida (CMV)?',
    'A margem bruta usa faturamento menos CMV.'
  ),
  royaltyRate: rate(
    'royalty_rate',
    'Alíquota de royalties',
    'Qual é o percentual de royalties sobre o faturamento?',
    'Informe 5 para 5%. Se os royalties já estão no extrato, use 0.'
  ),
  franchiseFee: money(
    'franchise_fee',
    'Taxa de franquia',
    'Qual é a taxa de franquia do período?',
    'Valor fixo pago à franqueadora no mês.'
  ),
  adRate: rate(
    'ad_rate',
    'Taxa de publicidade',
    'Qual é o percentual da taxa de publicidade?',
    'Informe 2 para 2% sobre o faturamento.'
  ),
  units: qty(
    'franchise_units',
    'Unidades da franquia',
    'Quantas unidades da franquia entram neste resultado?',
    'Use 1 se o acompanhamento for desta unidade.'
  ),
  investment: money(
    'franchise_investment',
    'Investimento da franquia',
    'Qual foi o investimento na unidade?',
    'Usado no payback e no ROI da franquia.'
  ),
  fixed: money(
    'fixed_costs',
    'Custos fixos',
    'Qual é o total de custos fixos do período?',
    'O ponto de equilíbrio usa os custos fixos e a margem de contribuição.'
  ),
  sqm: qty(
    'sqm',
    'Área da unidade (m²)',
    'Qual é a área da unidade em m²?',
    'O faturamento por m² divide a receita pela área.'
  ),
  marketing: money(
    'marketing_cost',
    'Custo de aquisição',
    'Qual é o custo de marketing/aquisição do período?',
    'O CAC divide esse custo pelos novos clientes.'
  ),
  newCustomers: qty(
    'new_customers',
    'Novos clientes',
    'Quantos novos clientes a unidade conquistou?',
    'Usamos essa quantidade no CAC.'
  ),
  customers: qty(
    'customer_count',
    'Clientes ativos',
    'Quantos clientes ativos a unidade teve no período?',
    'O LTV usa a receita média por cliente vezes a vida média.'
  ),
  lifespan: qty(
    'lifespan_months',
    'Vida média do cliente (meses)',
    'Qual é a vida média do cliente em meses?',
    'O LTV multiplica a receita por cliente por esses meses.'
  ),
}

const ownCostPerUnit = div(cost(), input('units_produced'))
const mixTotalCost = sum([input('own_cost'), input('lease_cost'), input('out_cost')])
const mixTotalRevenue = sum([input('own_revenue'), input('lease_revenue'), input('out_revenue')])
const mixTotalUnits = sum([input('own_units'), input('lease_units'), input('out_units')])
const mixOwnProfit = sub(input('own_revenue'), input('own_cost'))
const mixLeaseProfit = sub(input('lease_revenue'), input('lease_cost'))
const mixOutProfit = sub(input('out_revenue'), input('out_cost'))
const mixTotalProfit = sum([mixOwnProfit, mixLeaseProfit, mixOutProfit])
const mixOwnUnitCost = div(input('own_cost'), input('own_units'))
const mixLeaseUnitCost = div(input('lease_cost'), input('lease_units'))
const mixOutUnitCost = div(input('out_cost'), input('out_units'))
const mixOwnProductivity = div(input('own_units'), input('own_cost'))
const mixLeaseProductivity = div(input('lease_units'), input('lease_cost'))
const mixOutProductivity = div(input('out_units'), input('out_cost'))
const mixOwnReturn = pct(mixOwnProfit, input('own_cost'))
const mixLeaseReturn = pct(mixLeaseProfit, input('lease_cost'))
const mixOutReturn = pct(mixOutProfit, input('out_cost'))
const royalties = mul(revenue(), div(input('royalty_rate'), lit(100)))
const grossMargin = pct(sub(revenue(), cost()), revenue())
const operatingMargin = pct(profit(), revenue())
const marginAfterLease = pct(sub(sub(revenue(), cost()), input('lease_cost')), revenue())
const marginAfterOutsourcing = pct(
  sub(sub(revenue(), cost()), input('outsourcing_cost')),
  revenue()
)

export const OPERATION_MODELS: OperationModelDef[] = [
  {
    id: 'own',
    value: 'operacao_propria',
    aliases: ['propria', 'própria'],
    label: 'Operação própria',
    indicators: [
      {
        code: 'own_total_operating_cost',
        name: 'Custo operacional total',
        description: 'Soma do Custo e da Despesa realizados da operação própria no período.',
        unit: 'R$',
        format: 'money',
        formula: operatingCost(),
        formulaHint: 'Custo + Despesa',
        inputs: [],
      },
      {
        code: 'own_cost_per_produced_unit',
        name: 'Custo por unidade produzida',
        description: 'Custo do período dividido pelas unidades produzidas.',
        unit: 'R$/un',
        format: 'money',
        formula: ownCostPerUnit,
        formulaHint: 'Custo / Unidades produzidas',
        inputs: [OWN.units],
      },
      {
        code: 'own_operating_margin',
        name: 'Margem operacional',
        description: 'Lucro operacional em relação à receita do período.',
        unit: '%',
        format: 'pct',
        formula: operatingMargin,
        formulaHint: '(Receita − Custo − Despesa) / Receita',
        inputs: [],
      },
      {
        code: 'own_roi',
        name: 'ROI',
        description: 'Retorno sobre o investimento: lucro do período dividido pelo capital investido.',
        unit: '%',
        format: 'pct',
        formula: pct(profit(), input('investment')),
        formulaHint: '(Receita − Custo − Despesa) / Investimento',
        inputs: [OWN.investment],
      },
      {
        code: 'own_break_even',
        name: 'Ponto de equilíbrio',
        description: 'Receita necessária para cobrir os custos fixos com a margem de contribuição atual.',
        unit: 'R$',
        format: 'money',
        formula: breakEven(input('fixed_costs')),
        formulaHint: 'Custos fixos / Margem de contribuição',
        inputs: [OWN.fixed],
      },
      {
        code: 'own_depreciation_per_unit',
        name: 'Custo de depreciação por unidade',
        description: 'Depreciação do período dividida pelas unidades produzidas.',
        unit: 'R$/un',
        format: 'money',
        formula: div(input('depreciation'), input('units_produced')),
        formulaHint: 'Depreciação / Unidades produzidas',
        inputs: [OWN.depreciation, OWN.units],
      },
    ],
  },
  {
    id: 'leased',
    value: 'operacao_arrendada',
    aliases: ['arrendada'],
    label: 'Operação arrendada',
    indicators: [
      {
        code: 'lease_cost',
        name: 'Custo de arrendamento',
        description: 'Valor pago pelo arrendamento no período.',
        unit: 'R$',
        format: 'money',
        formula: input('lease_cost'),
        formulaHint: 'Custo de arrendamento',
        inputs: [LEASE.lease],
      },
      {
        code: 'lease_cost_per_unit',
        name: 'Custo de arrendamento por unidade',
        description: 'Arrendamento dividido pela área ou quantidade de unidades arrendadas.',
        unit: 'R$/un',
        format: 'money',
        formula: div(input('lease_cost'), input('leased_units')),
        formulaHint: 'Custo de arrendamento / Unidades arrendadas',
        inputs: [LEASE.lease, LEASE.units],
      },
      {
        code: 'lease_total_operating_cost',
        name: 'Custo operacional total',
        description: 'Soma do Custo e da Despesa realizados no período.',
        unit: 'R$',
        format: 'money',
        formula: operatingCost(),
        formulaHint: 'Custo + Despesa',
        inputs: [],
      },
      {
        code: 'lease_margin_after',
        name: 'Margem após arrendamento',
        description: 'Resultado depois do Custo e do custo de arrendamento, sobre a Receita.',
        unit: '%',
        format: 'pct',
        formula: marginAfterLease,
        formulaHint: '(Receita − Custo − Custo de arrendamento) / Receita',
        inputs: [LEASE.lease],
      },
      {
        code: 'lease_area_return',
        name: 'Rentabilidade da área/ativo arrendado',
        description: 'Receita menos Custo, divididos pelo valor da área ou do ativo arrendado.',
        unit: '%',
        format: 'pct',
        formula: pct(sub(revenue(), cost()), input('leased_asset_value')),
        formulaHint: '(Receita − Custo) / Área ou ativo arrendado',
        inputs: [LEASE.assetValue],
      },
      {
        code: 'lease_revenue_per_unit',
        name: 'Receita por área/unidade',
        description: 'Receita do período dividida pela área ou quantidade arrendada.',
        unit: 'R$/un',
        format: 'money',
        formula: div(revenue(), input('leased_units')),
        formulaHint: 'Receita / Área ou unidades',
        inputs: [LEASE.units],
      },
      {
        code: 'lease_profit_per_unit',
        name: 'Lucro por área/unidade',
        description: 'Receita menos Custo, divididos pela área ou quantidade arrendada.',
        unit: 'R$/un',
        format: 'money',
        formula: div(sub(revenue(), cost()), input('leased_units')),
        formulaHint: '(Receita − Custo) / Área ou unidades',
        inputs: [LEASE.units],
      },
      {
        code: 'lease_break_even',
        name: 'Ponto de equilíbrio do arrendamento',
        description: 'Receita necessária para cobrir o arrendamento com a margem de contribuição atual.',
        unit: 'R$',
        format: 'money',
        formula: breakEven(input('lease_cost')),
        formulaHint: 'Custos fixos do arrendamento / Margem de contribuição',
        inputs: [LEASE.lease],
      },
      {
        code: 'lease_vs_own_cost',
        name: 'Custo de arrendar × custo de possuir',
        description: 'Diferença entre o custo de arrendar e o custo de possuir o mesmo ativo.',
        unit: 'R$',
        format: 'money',
        formula: sub(input('lease_cost'), input('ownership_cost')),
        formulaHint: 'Custo de arrendamento − Custo de possuir',
        inputs: [LEASE.lease, LEASE.ownCost],
      },
      {
        code: 'lease_return_on_area',
        name: 'Retorno sobre área arrendada',
        description: 'Receita menos Custo, em relação ao custo de arrendamento.',
        unit: '%',
        format: 'pct',
        formula: pct(sub(revenue(), cost()), input('lease_cost')),
        formulaHint: '(Receita − Custo) / Custo de arrendamento',
        inputs: [LEASE.lease],
      },
    ],
  },
  {
    id: 'outsourced',
    value: 'operacao_terceirizada',
    aliases: ['terceirizada'],
    label: 'Operação terceirizada',
    indicators: [
      {
        code: 'out_cost',
        name: 'Custo de terceirização',
        description: 'Valor pago a terceiros pela operação no período.',
        unit: 'R$',
        format: 'money',
        formula: input('outsourcing_cost'),
        formulaHint: 'Custo de serviços terceirizados',
        inputs: [OUT.outsourcing],
      },
      {
        code: 'out_cost_per_unit',
        name: 'Custo terceirizado por unidade',
        description: 'Custo de terceirização dividido pelas unidades da operação terceirizada.',
        unit: 'R$/un',
        format: 'money',
        formula: div(input('outsourcing_cost'), input('outsourced_units')),
        formulaHint: 'Custo terceirizado / Unidades',
        inputs: [OUT.outsourcing, OUT.units],
      },
      {
        code: 'out_operation_share',
        name: '% da operação terceirizada',
        description: 'Participação da terceirização no custo total realizado.',
        unit: '%',
        format: 'pct',
        formula: pct(input('outsourcing_cost'), operatingCost()),
        formulaHint: 'Custo terceirizado / Custo total',
        inputs: [OUT.outsourcing],
      },
      {
        code: 'out_vs_internal_cost',
        name: 'Custo terceirizado × custo interno',
        description: 'Diferença entre o custo terceirizado e o custo interno comparável.',
        unit: 'R$',
        format: 'money',
        formula: sub(input('outsourcing_cost'), input('internal_cost')),
        formulaHint: 'Custo terceirizado − Custo interno',
        inputs: [OUT.outsourcing, OUT.internal],
      },
      {
        code: 'out_savings',
        name: 'Economia com terceirização',
        description: 'Diferença entre o custo interno comparável e o custo de terceirização.',
        unit: 'R$',
        format: 'money',
        formula: sub(input('internal_cost'), input('outsourcing_cost')),
        formulaHint: 'Custo interno − Custo terceirizado',
        inputs: [OUT.internal, OUT.outsourcing],
      },
      {
        code: 'out_margin_after',
        name: 'Margem após terceirização',
        description: 'Resultado depois do Custo e do custo terceirizado, sobre a Receita.',
        unit: '%',
        format: 'pct',
        formula: marginAfterOutsourcing,
        formulaHint: '(Receita − Custo − Custo terceirizado) / Receita',
        inputs: [OUT.outsourcing],
      },
      {
        code: 'out_cost_per_service',
        name: 'Custo por serviço contratado',
        description: 'Custo de terceirização dividido pelos serviços contratados.',
        unit: 'R$/serviço',
        format: 'money',
        formula: div(input('outsourcing_cost'), input('contracted_services')),
        formulaHint: 'Custo terceirizado / Serviços contratados',
        inputs: [OUT.outsourcing, OUT.services],
      },
      {
        code: 'out_third_party_productivity',
        name: 'Produtividade do terceiro',
        description: 'Produção entregue em relação ao custo de terceirização.',
        unit: 'un/R$',
        format: 'number',
        formula: div(input('delivered_units'), input('outsourcing_cost')),
        formulaHint: 'Produção / Custo terceirizado',
        inputs: [OUT.delivered, OUT.outsourcing],
      },
      {
        code: 'out_cost_per_delivered',
        name: 'Custo por unidade entregue',
        description: 'Custo de terceirização dividido pelas unidades entregues.',
        unit: 'R$/un',
        format: 'money',
        formula: div(input('outsourcing_cost'), input('delivered_units')),
        formulaHint: 'Custo terceirizado / Unidades entregues',
        inputs: [OUT.outsourcing, OUT.delivered],
      },
      {
        code: 'out_dependency',
        name: 'Dependência de terceiros',
        description: 'Peso da terceirização sobre o custo total da operação.',
        unit: '%',
        format: 'pct',
        formula: pct(input('outsourcing_cost'), operatingCost()),
        formulaHint: 'Custo terceirizado / Custo total',
        inputs: [OUT.outsourcing],
      },
    ],
  },
  {
    id: 'mixed',
    value: 'operacao_mista',
    aliases: ['mista'],
    label: 'Operação mista',
    indicators: [
      {
        code: 'mix_cost_by_model',
        name: 'Custo por modelo de operação',
        description: 'Custos da operação própria, arrendada e terceirizada no período.',
        unit: 'R$',
        format: 'money',
        formula: mixTotalCost,
        formulaHint: 'Custo do modelo / Quantidade produzida',
        inputs: [MIX.ownCost, MIX.leaseCost, MIX.outCost],
        breakdown: [
          { label: 'Própria', formula: input('own_cost') },
          { label: 'Arrendada', formula: input('lease_cost') },
          { label: 'Terceirizada', formula: input('out_cost') },
        ],
      },
      {
        code: 'mix_cost_per_unit_by_model',
        name: 'Custo por unidade por modelo',
        description: 'Custo unitário de cada modelo e o custo médio ponderado da operação.',
        unit: 'R$/un',
        format: 'money',
        formula: div(mixTotalCost, mixTotalUnits),
        formulaHint: 'Custo do modelo / Unidades do modelo',
        inputs: [MIX.ownCost, MIX.leaseCost, MIX.outCost, MIX.ownUnits, MIX.leaseUnits, MIX.outUnits],
        breakdown: [
          { label: 'Própria', formula: mixOwnUnitCost },
          { label: 'Arrendada', formula: mixLeaseUnitCost },
          { label: 'Terceirizada', formula: mixOutUnitCost },
        ],
      },
      {
        code: 'mix_cost_share',
        name: 'Participação de cada modelo nos custos',
        description: 'Peso de cada modelo no custo total da operação mista.',
        unit: '%',
        format: 'pct',
        formula: pct(max([input('own_cost'), input('lease_cost'), input('out_cost')]), mixTotalCost),
        formulaHint: 'Custo do modelo / Custo total',
        inputs: [MIX.ownCost, MIX.leaseCost, MIX.outCost],
        breakdown: [
          { label: 'Própria', formula: pct(input('own_cost'), mixTotalCost) },
          { label: 'Arrendada', formula: pct(input('lease_cost'), mixTotalCost) },
          { label: 'Terceirizada', formula: pct(input('out_cost'), mixTotalCost) },
        ],
      },
      {
        code: 'mix_margin_by_model',
        name: 'Margem por modelo',
        description: 'Margem de cada modelo e a margem consolidada da operação mista.',
        unit: '%',
        format: 'pct',
        formula: pct(mixTotalProfit, mixTotalRevenue),
        formulaHint: '(Receita do modelo − Custo do modelo) / Receita do modelo',
        inputs: [
          MIX.ownRevenue,
          MIX.leaseRevenue,
          MIX.outRevenue,
          MIX.ownCost,
          MIX.leaseCost,
          MIX.outCost,
        ],
        breakdown: [
          { label: 'Própria', formula: pct(mixOwnProfit, input('own_revenue')) },
          { label: 'Arrendada', formula: pct(mixLeaseProfit, input('lease_revenue')) },
          { label: 'Terceirizada', formula: pct(mixOutProfit, input('out_revenue')) },
        ],
      },
      {
        code: 'mix_return_by_model',
        name: 'Rentabilidade por modelo',
        description: 'Lucro de cada modelo em relação ao custo do modelo.',
        unit: '%',
        format: 'pct',
        formula: pct(mixTotalProfit, mixTotalCost),
        formulaHint: '(Receita do modelo − Custo do modelo) / Custo do modelo',
        inputs: [
          MIX.ownRevenue,
          MIX.leaseRevenue,
          MIX.outRevenue,
          MIX.ownCost,
          MIX.leaseCost,
          MIX.outCost,
        ],
        breakdown: [
          { label: 'Própria', formula: mixOwnReturn },
          { label: 'Arrendada', formula: mixLeaseReturn },
          { label: 'Terceirizada', formula: mixOutReturn },
        ],
      },
      {
        code: 'mix_revenue_by_model',
        name: 'Receita por modelo',
        description: 'Receita gerada por cada modelo de operação.',
        unit: 'R$',
        format: 'money',
        formula: mixTotalRevenue,
        formulaHint: 'Receita do modelo',
        inputs: [MIX.ownRevenue, MIX.leaseRevenue, MIX.outRevenue],
        breakdown: [
          { label: 'Própria', formula: input('own_revenue') },
          { label: 'Arrendada', formula: input('lease_revenue') },
          { label: 'Terceirizada', formula: input('out_revenue') },
        ],
      },
      {
        code: 'mix_profit_by_model',
        name: 'Lucro por modelo',
        description: 'Resultado de cada modelo: receita menos custo informado.',
        unit: 'R$',
        format: 'money',
        formula: mixTotalProfit,
        formulaHint: 'Receita do modelo − Custo do modelo',
        inputs: [
          MIX.ownRevenue,
          MIX.leaseRevenue,
          MIX.outRevenue,
          MIX.ownCost,
          MIX.leaseCost,
          MIX.outCost,
        ],
        breakdown: [
          { label: 'Própria', formula: mixOwnProfit },
          { label: 'Arrendada', formula: mixLeaseProfit },
          { label: 'Terceirizada', formula: mixOutProfit },
        ],
      },
      {
        code: 'mix_productivity_by_model',
        name: 'Produtividade por modelo',
        description: 'Produção de cada modelo em relação ao respectivo custo.',
        unit: 'un/R$',
        format: 'number',
        formula: div(mixTotalUnits, mixTotalCost),
        formulaHint: 'Produção do modelo / Custo do modelo',
        inputs: [MIX.ownUnits, MIX.leaseUnits, MIX.outUnits, MIX.ownCost, MIX.leaseCost, MIX.outCost],
        breakdown: [
          { label: 'Própria', formula: mixOwnProductivity },
          { label: 'Arrendada', formula: mixLeaseProductivity },
          { label: 'Terceirizada', formula: mixOutProductivity },
        ],
      },
      {
        code: 'mix_weighted_avg_cost',
        name: 'Custo médio ponderado da operação',
        description: 'Custo total dos modelos dividido pelo volume total produzido.',
        unit: 'R$/un',
        format: 'money',
        formula: div(mixTotalCost, mixTotalUnits),
        formulaHint: 'Σ(Custo do modelo × Peso do modelo) / Σ Pesos',
        inputs: [MIX.ownCost, MIX.leaseCost, MIX.outCost, MIX.ownUnits, MIX.leaseUnits, MIX.outUnits],
      },
      {
        code: 'mix_savings_between',
        name: 'Economia entre modelos',
        description: 'Diferença entre o maior e o menor custo por unidade dos modelos preenchidos.',
        unit: 'R$/un',
        format: 'money',
        formula: sub(
          max([mixOwnUnitCost, mixLeaseUnitCost, mixOutUnitCost]),
          min([mixOwnUnitCost, mixLeaseUnitCost, mixOutUnitCost])
        ),
        formulaHint: 'Custo do modelo mais caro − Custo do modelo mais barato',
        inputs: [MIX.ownCost, MIX.leaseCost, MIX.outCost, MIX.ownUnits, MIX.leaseUnits, MIX.outUnits],
        breakdown: [
          { label: 'Própria', formula: mixOwnUnitCost },
          { label: 'Arrendada', formula: mixLeaseUnitCost },
          { label: 'Terceirizada', formula: mixOutUnitCost },
        ],
      },
      {
        code: 'mix_roi_by_model',
        name: 'ROI por modelo',
        description: 'Retorno sobre o custo de cada modelo e o consolidado.',
        unit: '%',
        format: 'pct',
        formula: pct(mixTotalProfit, mixTotalCost),
        formulaHint: '(Receita do modelo − Custo do modelo) / Custo do modelo',
        inputs: [
          MIX.ownRevenue,
          MIX.leaseRevenue,
          MIX.outRevenue,
          MIX.ownCost,
          MIX.leaseCost,
          MIX.outCost,
        ],
        breakdown: [
          { label: 'Própria', formula: mixOwnReturn },
          { label: 'Arrendada', formula: mixLeaseReturn },
          { label: 'Terceirizada', formula: mixOutReturn },
        ],
      },
      {
        code: 'mix_break_even_by_model',
        name: 'Ponto de equilíbrio por modelo',
        description: 'Receita necessária para cobrir os custos fixos de cada modelo.',
        unit: 'R$',
        format: 'money',
        formula: breakEven(sum([input('own_fixed'), input('lease_fixed'), input('out_fixed')])),
        formulaHint: 'Custos fixos / Margem de contribuição',
        inputs: [
          MIX.ownFixed,
          MIX.leaseFixed,
          MIX.outFixed,
          MIX.ownCost,
          MIX.leaseCost,
          MIX.outCost,
          MIX.ownRevenue,
          MIX.leaseRevenue,
          MIX.outRevenue,
        ],
        breakdown: [
          {
            label: 'Própria',
            formula: breakEven(
              input('own_fixed'),
              sub(input('own_cost'), input('own_fixed')),
              input('own_revenue')
            ),
          },
          {
            label: 'Arrendada',
            formula: breakEven(
              input('lease_fixed'),
              sub(input('lease_cost'), input('lease_fixed')),
              input('lease_revenue')
            ),
          },
          {
            label: 'Terceirizada',
            formula: breakEven(
              input('out_fixed'),
              sub(input('out_cost'), input('out_fixed')),
              input('out_revenue')
            ),
          },
        ],
      },
    ],
  },
  {
    id: 'franchise',
    value: 'franquia',
    aliases: [],
    label: 'Franquia',
    indicators: [
      {
        code: 'fr_unit_revenue',
        name: 'Faturamento da unidade',
        description: 'Receita realizada da unidade no período.',
        unit: 'R$',
        format: 'money',
        formula: revenue(),
        formulaHint: 'Receita',
        inputs: [],
      },
      {
        code: 'fr_avg_ticket',
        name: 'Ticket médio',
        description: 'Faturamento dividido pelo número de vendas do período.',
        unit: 'R$',
        format: 'money',
        formula: div(revenue(), input('sales_count')),
        formulaHint: 'Receita / Quantidade de vendas',
        inputs: [FR.sales],
      },
      {
        code: 'fr_gross_margin',
        name: 'Margem bruta',
        description: 'Receita menos Custo, em relação à Receita.',
        unit: '%',
        format: 'pct',
        formula: grossMargin,
        formulaHint: '(Receita − Custo) / Receita',
        inputs: [],
      },
      {
        code: 'fr_operating_margin',
        name: 'Margem operacional',
        description: 'Resultado operacional da unidade sobre o faturamento.',
        unit: '%',
        format: 'pct',
        formula: operatingMargin,
        formulaHint: '(Receita − Custo − Despesa) / Receita',
        inputs: [],
      },
      {
        code: 'fr_royalties',
        name: 'Royalties sobre faturamento',
        description: 'Despesa de royalties em relação à Receita da unidade.',
        unit: '%',
        format: 'pct',
        formula: pct(royalties, revenue()),
        formulaHint: 'Despesa de royalties / Receita',
        inputs: [FR.royaltyRate],
      },
      {
        code: 'fr_franchise_fee',
        name: 'Taxa de franquia',
        description: 'Despesa de franquia em relação à Receita.',
        unit: '%',
        format: 'pct',
        formula: pct(input('franchise_fee'), revenue()),
        formulaHint: 'Despesa de franquia / Receita',
        inputs: [FR.franchiseFee],
      },
      {
        code: 'fr_ad_fee',
        name: 'Taxa de publicidade',
        description: 'Despesa de publicidade em relação à Receita.',
        unit: '%',
        format: 'pct',
        formula: pct(mul(revenue(), div(input('ad_rate'), lit(100))), revenue()),
        formulaHint: 'Despesa de publicidade / Receita',
        inputs: [FR.adRate],
      },
      {
        code: 'fr_operating_cost_per_unit',
        name: 'Custo operacional por unidade',
        description: 'Custo mais Despesa, divididos pelas unidades da franquia acompanhadas.',
        unit: 'R$/un',
        format: 'money',
        formula: div(operatingCost(), input('franchise_units')),
        formulaHint: '(Custo + Despesa) / Quantidade de unidades',
        inputs: [FR.units],
      },
      {
        code: 'fr_net_profit',
        name: 'Lucro líquido da unidade',
        description: 'Receita menos Custo e Despesa realizados da unidade.',
        unit: 'R$',
        format: 'money',
        formula: profit(),
        formulaHint: 'Receita − Custo − Despesa',
        inputs: [],
      },
      {
        code: 'fr_payback',
        name: 'Payback do investimento',
        description: 'Meses necessários para recuperar o investimento com o fluxo de caixa atual.',
        unit: 'meses',
        format: 'months',
        formula: div(input('franchise_investment'), profit()),
        formulaHint: 'Investimento / Fluxo de caixa médio',
        inputs: [FR.investment],
      },
      {
        code: 'fr_roi',
        name: 'ROI da franquia',
        description: 'Lucro líquido da unidade dividido pelo investimento na franquia.',
        unit: '%',
        format: 'pct',
        formula: pct(profit(), input('franchise_investment')),
        formulaHint: '(Lucro líquido / Investimento)',
        inputs: [FR.investment],
      },
      {
        code: 'fr_break_even',
        name: 'Ponto de equilíbrio',
        description: 'Faturamento necessário para cobrir os custos fixos da unidade.',
        unit: 'R$',
        format: 'money',
        formula: breakEven(input('fixed_costs')),
        formulaHint: 'Custos fixos / Margem de contribuição',
        inputs: [FR.fixed],
      },
      {
        code: 'fr_revenue_per_employee',
        name: 'Faturamento por funcionário',
        description: 'Receita da unidade dividida pelo quadro de funcionários da empresa.',
        unit: 'R$/funcionário',
        format: 'money',
        formula: div(revenue(), employeeCount()),
        formulaHint: 'Receita / Quantidade de funcionários',
        inputs: [],
      },
      {
        code: 'fr_revenue_per_sqm',
        name: 'Faturamento por m²',
        description: 'Receita da unidade dividida pela área em metros quadrados.',
        unit: 'R$/m²',
        format: 'money',
        formula: div(revenue(), input('sqm')),
        formulaHint: 'Receita / m²',
        inputs: [FR.sqm],
      },
      {
        code: 'fr_sales_count',
        name: 'Vendas por período',
        description: 'Quantidade de vendas realizadas pela unidade no período.',
        unit: 'un',
        format: 'number',
        formula: input('sales_count'),
        formulaHint: 'Quantidade de vendas',
        inputs: [FR.sales],
      },
      {
        code: 'fr_growth_rate',
        name: 'Taxa de crescimento',
        description: 'Variação do faturamento em relação ao período anterior.',
        unit: '%',
        format: 'pct',
        formula: pct(sub(revenue(), previousRevenue()), previousRevenue()),
        formulaHint: '(Receita atual − Receita anterior) / Receita anterior',
        inputs: [],
      },
      {
        code: 'fr_cac',
        name: 'CAC',
        description: 'Despesas de aquisição de clientes divididas pelos novos clientes.',
        unit: 'R$',
        format: 'money',
        formula: div(input('marketing_cost'), input('new_customers')),
        formulaHint: 'Despesas de aquisição de clientes / Novos clientes',
        inputs: [FR.marketing, FR.newCustomers],
      },
      {
        code: 'fr_ltv',
        name: 'LTV',
        description: 'Valor do tempo de vida do cliente: receita por cliente vezes a vida média em meses.',
        unit: 'R$',
        format: 'money',
        formula: mul(div(revenue(), input('customer_count')), input('lifespan_months')),
        formulaHint: '(Receita / Clientes) × vida média em meses',
        inputs: [FR.customers, FR.lifespan],
      },
      {
        code: 'fr_margin_after_royalties',
        name: 'Margem após royalties',
        description: 'Resultado depois do lucro e dos royalties calculados sobre o faturamento.',
        unit: '%',
        format: 'pct',
        formula: pct(sub(profit(), royalties), revenue()),
        formulaHint: '(Receita − Custo − Despesa − Royalties) / Receita',
        inputs: [FR.royaltyRate],
      },
    ],
  },
]

const MODEL_BY_VALUE = new Map<string, OperationModelDef>()
for (const model of OPERATION_MODELS) {
  MODEL_BY_VALUE.set(model.value, model)
  for (const alias of model.aliases) MODEL_BY_VALUE.set(alias, model)
}

export const OPERATION_MODEL_OPTIONS: QuestionOption[] = OPERATION_MODELS.map((model) => ({
  value: model.value,
  label: model.label,
}))

export function operationModelFromValue(value: string | null | undefined): OperationModelDef | null {
  if (!value) return null
  return MODEL_BY_VALUE.get(String(value).trim()) ?? null
}

export function operationIndicatorOptionsFor(value: string | null | undefined): QuestionOption[] {
  const model = operationModelFromValue(value)
  if (!model) return []
  return model.indicators.map((item) => ({ value: item.code, label: item.name }))
}

export function selectedOperationPriorities(value: unknown): string[] {
  if (value == null || value === '__skipped__') return []
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  const text = String(value).trim()
  if (!text) return []
  if (text.includes(',')) return text.split(',').map((item) => item.trim()).filter(Boolean)
  return [text]
}

export function operationalIndicatorsFor(
  modelValue: string | null | undefined,
  selectedCodes?: string[] | null
): OperationalIndicatorSeed[] {
  const model = operationModelFromValue(modelValue)
  if (!model) return []
  if (selectedCodes == null) return model.indicators
  const allowed = new Set(selectedCodes)
  return model.indicators.filter((item) => allowed.has(item.code))
}

export function isOperationalIndicatorCode(code: string) {
  return OPERATION_MODELS.some((model) => model.indicators.some((item) => item.code === code))
}

export function findOperationalIndicator(code: string): OperationalIndicatorSeed | null {
  for (const model of OPERATION_MODELS) {
    const match = model.indicators.find((item) => item.code === code)
    if (match) return match
  }
  return null
}

export function operationModelLabel(value: string | null | undefined) {
  return operationModelFromValue(value)?.label ?? (value ? value.replace(/_/g, ' ') : '')
}

export const OPERATION_MODEL_INDICATORS: IndicatorDef[] = OPERATION_MODELS.flatMap(
  (model, modelIndex) =>
    model.indicators.map((item, index) =>
      indicator(
        {
          code: item.code,
          name: item.name,
          description: item.description,
          category: 'operational',
          unit: item.unit,
          formula: item.formulaHint,
          segments: null,
          activation: {
            all: [
              {
                in: {
                  answer: OPERATION_MODEL_QUESTION,
                  values: [model.value, ...model.aliases],
                },
              },
              { eq: { answer: OPERATION_PRIORITIES_QUESTION, value: item.code } },
            ],
          },
          dashboardSection: 'operational',
          requiredData: item.inputs.map((entry) => entry.key),
        },
        4000 + modelIndex * 200 + index * 10
      )
    )
)
