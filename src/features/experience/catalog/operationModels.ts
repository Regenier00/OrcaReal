import { indicator } from './helpers.ts'
import {
  add,
  breakEven,
  cost,
  div,
  employeeCount,
  input,
  lit,
  max,
  min,
  mul,
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
  assetsValue: money(
    'total_assets',
    'Ativos totais',
    'Qual é o valor total dos ativos no período?',
    'O ROA divide o lucro pelo valor dos ativos.'
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
  idle: qty(
    'idle_capacity',
    'Capacidade ociosa',
    'Qual é a capacidade ociosa no período?',
    'Informe na mesma unidade da capacidade total.'
  ),
  capacity: qty(
    'total_capacity',
    'Capacidade total',
    'Qual é a capacidade total dos ativos?',
    'Usamos capacidade ociosa ÷ capacidade total.'
  ),
  maintenance: money(
    'maintenance_cost',
    'Custo de manutenção',
    'Qual é o custo de manutenção do período?',
    'O indicador divide a manutenção pela quantidade de ativos.'
  ),
  assetCount: qty(
    'asset_count',
    'Quantidade de ativos',
    'Quantos ativos a operação utiliza?',
    'Máquinas, veículos ou instalações usadas na produção.'
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
    'O retorno sobre a área divide o lucro pela área.'
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
const mixTotalInvestment = sum([
  input('own_investment'),
  input('lease_investment'),
  input('out_investment'),
])
const mixOwnProfit = sub(input('own_revenue'), input('own_cost'))
const mixLeaseProfit = sub(input('lease_revenue'), input('lease_cost'))
const mixOutProfit = sub(input('out_revenue'), input('out_cost'))
const mixTotalProfit = sum([mixOwnProfit, mixLeaseProfit, mixOutProfit])
const mixOwnUnitCost = div(input('own_cost'), input('own_units'))
const mixLeaseUnitCost = div(input('lease_cost'), input('lease_units'))
const mixOutUnitCost = div(input('out_cost'), input('out_units'))
const royalties = mul(revenue(), div(input('royalty_rate'), lit(100)))

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
        description: 'Soma dos custos e despesas realizados da operação própria no período.',
        unit: 'R$',
        format: 'money',
        formula: cost(),
        formulaHint: 'custos + despesas realizados',
        inputs: [],
      },
      {
        code: 'own_cost_per_produced_unit',
        name: 'Custo por unidade produzida',
        description: 'Custo operacional total dividido pelas unidades produzidas.',
        unit: 'R$/un',
        format: 'money',
        formula: ownCostPerUnit,
        formulaHint: 'custo operacional total / unidades produzidas',
        inputs: [OWN.units],
      },
      {
        code: 'own_operating_margin',
        name: 'Margem operacional',
        description: 'Lucro operacional em relação à receita do período.',
        unit: '%',
        format: 'pct',
        formula: pct(profit(), revenue()),
        formulaHint: '(receita − custos) / receita',
        inputs: [],
      },
      {
        code: 'own_roa',
        name: 'ROA',
        description: 'Retorno sobre os ativos: lucro do período dividido pelo valor dos ativos.',
        unit: '%',
        format: 'pct',
        formula: pct(profit(), input('total_assets')),
        formulaHint: 'lucro / ativos totais',
        inputs: [OWN.assetsValue],
      },
      {
        code: 'own_roi',
        name: 'ROI',
        description: 'Retorno sobre o investimento: lucro do período dividido pelo capital investido.',
        unit: '%',
        format: 'pct',
        formula: pct(profit(), input('investment')),
        formulaHint: 'lucro / capital investido',
        inputs: [OWN.investment],
      },
      {
        code: 'own_break_even',
        name: 'Ponto de equilíbrio',
        description: 'Receita necessária para cobrir os custos fixos com a margem de contribuição atual.',
        unit: 'R$',
        format: 'money',
        formula: breakEven(input('fixed_costs')),
        formulaHint: 'custos fixos / margem de contribuição %',
        inputs: [OWN.fixed],
      },
      {
        code: 'own_asset_idle',
        name: 'Ociosidade dos ativos',
        description: 'Percentual da capacidade que ficou ociosa no período.',
        unit: '%',
        format: 'pct',
        formula: pct(input('idle_capacity'), input('total_capacity')),
        formulaHint: 'capacidade ociosa / capacidade total',
        inputs: [OWN.idle, OWN.capacity],
      },
      {
        code: 'own_maintenance_per_asset',
        name: 'Custo de manutenção por ativo',
        description: 'Custo de manutenção dividido pela quantidade de ativos.',
        unit: 'R$/ativo',
        format: 'money',
        formula: div(input('maintenance_cost'), input('asset_count')),
        formulaHint: 'manutenção / quantidade de ativos',
        inputs: [OWN.maintenance, OWN.assetCount],
      },
      {
        code: 'own_depreciation_per_unit',
        name: 'Custo de depreciação por unidade',
        description: 'Depreciação do período dividida pelas unidades produzidas.',
        unit: 'R$/un',
        format: 'money',
        formula: div(input('depreciation'), input('units_produced')),
        formulaHint: 'depreciação / unidades produzidas',
        inputs: [OWN.depreciation, OWN.units],
      },
      {
        code: 'own_productivity_per_asset',
        name: 'Produtividade por ativo',
        description: 'Unidades produzidas por ativo utilizado.',
        unit: 'un/ativo',
        format: 'number',
        formula: div(input('units_produced'), input('asset_count')),
        formulaHint: 'unidades produzidas / quantidade de ativos',
        inputs: [OWN.units, OWN.assetCount],
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
        formulaHint: 'custo de arrendamento informado',
        inputs: [LEASE.lease],
      },
      {
        code: 'lease_cost_per_unit',
        name: 'Custo de arrendamento por unidade',
        description: 'Arrendamento dividido pela área ou quantidade de unidades arrendadas.',
        unit: 'R$/un',
        format: 'money',
        formula: div(input('lease_cost'), input('leased_units')),
        formulaHint: 'custo de arrendamento / área ou unidades',
        inputs: [LEASE.lease, LEASE.units],
      },
      {
        code: 'lease_total_operating_cost',
        name: 'Custo operacional total',
        description: 'Soma dos custos e despesas realizados, incluindo o arrendamento lançado no extrato.',
        unit: 'R$',
        format: 'money',
        formula: cost(),
        formulaHint: 'custos + despesas realizados',
        inputs: [],
      },
      {
        code: 'lease_margin_after',
        name: 'Margem após arrendamento',
        description: 'Resultado depois dos custos realizados, já considerando o arrendamento do extrato.',
        unit: '%',
        format: 'pct',
        formula: pct(profit(), revenue()),
        formulaHint: '(receita − custos) / receita',
        inputs: [],
      },
      {
        code: 'lease_area_return',
        name: 'Rentabilidade da área/ativo arrendado',
        description: 'Lucro do período dividido pelo valor da área ou do ativo arrendado.',
        unit: '%',
        format: 'pct',
        formula: pct(profit(), input('leased_asset_value')),
        formulaHint: 'lucro / valor do ativo ou área arrendada',
        inputs: [LEASE.assetValue],
      },
      {
        code: 'lease_revenue_per_unit',
        name: 'Receita por área/unidade',
        description: 'Receita do período dividida pela área ou quantidade arrendada.',
        unit: 'R$/un',
        format: 'money',
        formula: div(revenue(), input('leased_units')),
        formulaHint: 'receita / área ou unidades arrendadas',
        inputs: [LEASE.units],
      },
      {
        code: 'lease_profit_per_unit',
        name: 'Lucro por área/unidade',
        description: 'Lucro do período dividido pela área ou quantidade arrendada.',
        unit: 'R$/un',
        format: 'money',
        formula: div(profit(), input('leased_units')),
        formulaHint: 'lucro / área ou unidades arrendadas',
        inputs: [LEASE.units],
      },
      {
        code: 'lease_break_even',
        name: 'Ponto de equilíbrio do arrendamento',
        description: 'Receita necessária para cobrir o arrendamento com a margem de contribuição atual.',
        unit: 'R$',
        format: 'money',
        formula: breakEven(input('lease_cost')),
        formulaHint: 'custo de arrendamento / margem de contribuição %',
        inputs: [LEASE.lease],
      },
      {
        code: 'lease_vs_own_cost',
        name: 'Custo de arrendar × custo de possuir',
        description: 'Razão entre o custo de arrendar e o custo de possuir o mesmo ativo.',
        unit: 'x',
        format: 'ratio',
        formula: div(input('lease_cost'), input('ownership_cost')),
        formulaHint: 'custo de arrendamento / custo de possuir',
        inputs: [LEASE.lease, LEASE.ownCost],
      },
      {
        code: 'lease_return_on_area',
        name: 'Retorno sobre área arrendada',
        description: 'Lucro do período dividido pela área arrendada.',
        unit: 'R$/área',
        format: 'money',
        formula: div(profit(), input('leased_area')),
        formulaHint: 'lucro / área arrendada',
        inputs: [LEASE.area],
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
        formulaHint: 'custo de terceirização informado',
        inputs: [OUT.outsourcing],
      },
      {
        code: 'out_cost_per_unit',
        name: 'Custo terceirizado por unidade',
        description: 'Custo de terceirização dividido pelas unidades da operação terceirizada.',
        unit: 'R$/un',
        format: 'money',
        formula: div(input('outsourcing_cost'), input('outsourced_units')),
        formulaHint: 'custo de terceirização / unidades',
        inputs: [OUT.outsourcing, OUT.units],
      },
      {
        code: 'out_operation_share',
        name: '% da operação terceirizada',
        description: 'Participação da terceirização no custo operacional total realizado.',
        unit: '%',
        format: 'pct',
        formula: pct(input('outsourcing_cost'), cost()),
        formulaHint: 'custo de terceirização / custo operacional total',
        inputs: [OUT.outsourcing],
      },
      {
        code: 'out_vs_internal_cost',
        name: 'Custo terceirizado × custo interno',
        description: 'Razão entre o custo terceirizado e o custo interno comparável.',
        unit: 'x',
        format: 'ratio',
        formula: div(input('outsourcing_cost'), input('internal_cost')),
        formulaHint: 'custo de terceirização / custo interno',
        inputs: [OUT.outsourcing, OUT.internal],
      },
      {
        code: 'out_savings',
        name: 'Economia com terceirização',
        description: 'Diferença entre o custo interno comparável e o custo de terceirização.',
        unit: 'R$',
        format: 'money',
        formula: sub(input('internal_cost'), input('outsourcing_cost')),
        formulaHint: 'custo interno − custo de terceirização',
        inputs: [OUT.internal, OUT.outsourcing],
      },
      {
        code: 'out_margin_after',
        name: 'Margem após terceirização',
        description: 'Resultado depois dos custos realizados, já considerando a terceirização do extrato.',
        unit: '%',
        format: 'pct',
        formula: pct(profit(), revenue()),
        formulaHint: '(receita − custos) / receita',
        inputs: [],
      },
      {
        code: 'out_cost_per_service',
        name: 'Custo por serviço contratado',
        description: 'Custo de terceirização dividido pelos serviços contratados.',
        unit: 'R$/serviço',
        format: 'money',
        formula: div(input('outsourcing_cost'), input('contracted_services')),
        formulaHint: 'custo de terceirização / serviços contratados',
        inputs: [OUT.outsourcing, OUT.services],
      },
      {
        code: 'out_third_party_productivity',
        name: 'Produtividade do terceiro',
        description: 'Unidades entregues por terceiro que atuou na operação.',
        unit: 'un/terceiro',
        format: 'number',
        formula: div(input('delivered_units'), input('third_party_count')),
        formulaHint: 'unidades entregues / quantidade de terceiros',
        inputs: [OUT.delivered, OUT.thirdParties],
      },
      {
        code: 'out_cost_per_delivered',
        name: 'Custo por unidade entregue',
        description: 'Custo de terceirização dividido pelas unidades entregues.',
        unit: 'R$/un',
        format: 'money',
        formula: div(input('outsourcing_cost'), input('delivered_units')),
        formulaHint: 'custo de terceirização / unidades entregues',
        inputs: [OUT.outsourcing, OUT.delivered],
      },
      {
        code: 'out_dependency',
        name: 'Dependência de terceiros',
        description: 'Peso da terceirização sobre o custo terceirizado mais o custo interno comparável.',
        unit: '%',
        format: 'pct',
        formula: pct(input('outsourcing_cost'), add(input('outsourcing_cost'), input('internal_cost'))),
        formulaHint: 'custo de terceirização / (terceirização + custo interno)',
        inputs: [OUT.outsourcing, OUT.internal],
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
        formulaHint: 'custo próprio + arrendado + terceirizado',
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
        formulaHint: 'custo total dos modelos / unidades totais',
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
        formulaHint: 'custo do modelo / custo total dos modelos',
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
        formulaHint: 'lucro dos modelos / receita dos modelos',
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
        description: 'Lucro de cada modelo em relação ao investimento alocado.',
        unit: '%',
        format: 'pct',
        formula: pct(mixTotalProfit, mixTotalInvestment),
        formulaHint: 'lucro dos modelos / investimento dos modelos',
        inputs: [
          MIX.ownRevenue,
          MIX.leaseRevenue,
          MIX.outRevenue,
          MIX.ownCost,
          MIX.leaseCost,
          MIX.outCost,
          MIX.ownInvestment,
          MIX.leaseInvestment,
          MIX.outInvestment,
        ],
        breakdown: [
          { label: 'Própria', formula: pct(mixOwnProfit, input('own_investment')) },
          { label: 'Arrendada', formula: pct(mixLeaseProfit, input('lease_investment')) },
          { label: 'Terceirizada', formula: pct(mixOutProfit, input('out_investment')) },
        ],
      },
      {
        code: 'mix_revenue_by_model',
        name: 'Receita por modelo',
        description: 'Receita gerada por cada modelo de operação.',
        unit: 'R$',
        format: 'money',
        formula: mixTotalRevenue,
        formulaHint: 'receita própria + arrendada + terceirizada',
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
        formulaHint: '(receita − custo) de cada modelo',
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
        description: 'Volume produzido por cada modelo de operação.',
        unit: 'un',
        format: 'number',
        formula: mixTotalUnits,
        formulaHint: 'unidades próprias + arrendadas + terceirizadas',
        inputs: [MIX.ownUnits, MIX.leaseUnits, MIX.outUnits],
        breakdown: [
          { label: 'Própria', formula: input('own_units') },
          { label: 'Arrendada', formula: input('lease_units') },
          { label: 'Terceirizada', formula: input('out_units') },
        ],
      },
      {
        code: 'mix_weighted_avg_cost',
        name: 'Custo médio ponderado da operação',
        description: 'Custo total dos modelos dividido pelo volume total produzido.',
        unit: 'R$/un',
        format: 'money',
        formula: div(mixTotalCost, mixTotalUnits),
        formulaHint: 'custo total dos modelos / unidades totais',
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
        formulaHint: 'maior custo unitário − menor custo unitário',
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
        description: 'Retorno sobre o investimento de cada modelo e o consolidado.',
        unit: '%',
        format: 'pct',
        formula: pct(mixTotalProfit, mixTotalInvestment),
        formulaHint: 'lucro dos modelos / investimento dos modelos',
        inputs: [
          MIX.ownRevenue,
          MIX.leaseRevenue,
          MIX.outRevenue,
          MIX.ownCost,
          MIX.leaseCost,
          MIX.outCost,
          MIX.ownInvestment,
          MIX.leaseInvestment,
          MIX.outInvestment,
        ],
        breakdown: [
          { label: 'Própria', formula: pct(mixOwnProfit, input('own_investment')) },
          { label: 'Arrendada', formula: pct(mixLeaseProfit, input('lease_investment')) },
          { label: 'Terceirizada', formula: pct(mixOutProfit, input('out_investment')) },
        ],
      },
      {
        code: 'mix_break_even_by_model',
        name: 'Ponto de equilíbrio por modelo',
        description: 'Receita necessária para cobrir os custos fixos de cada modelo.',
        unit: 'R$',
        format: 'money',
        formula: breakEven(sum([input('own_fixed'), input('lease_fixed'), input('out_fixed')])),
        formulaHint: 'custos fixos do modelo / margem de contribuição %',
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
        formulaHint: 'soma das receitas',
        inputs: [],
      },
      {
        code: 'fr_avg_ticket',
        name: 'Ticket médio',
        description: 'Faturamento dividido pelo número de vendas do período.',
        unit: 'R$',
        format: 'money',
        formula: div(revenue(), input('sales_count')),
        formulaHint: 'faturamento / vendas',
        inputs: [FR.sales],
      },
      {
        code: 'fr_gross_margin',
        name: 'Margem bruta',
        description: 'Faturamento menos CMV, em relação ao faturamento.',
        unit: '%',
        format: 'pct',
        formula: pct(sub(revenue(), input('cogs')), revenue()),
        formulaHint: '(faturamento − CMV) / faturamento',
        inputs: [FR.cogs],
      },
      {
        code: 'fr_operating_margin',
        name: 'Margem operacional',
        description: 'Resultado operacional da unidade sobre o faturamento.',
        unit: '%',
        format: 'pct',
        formula: pct(profit(), revenue()),
        formulaHint: '(receita − custos) / receita',
        inputs: [],
      },
      {
        code: 'fr_royalties',
        name: 'Royalties sobre faturamento',
        description: 'Alíquota de royalties aplicada sobre o faturamento da unidade.',
        unit: 'R$',
        format: 'money',
        formula: royalties,
        formulaHint: 'faturamento × alíquota de royalties',
        inputs: [FR.royaltyRate],
      },
      {
        code: 'fr_franchise_fee',
        name: 'Taxa de franquia',
        description: 'Taxa de franquia paga no período.',
        unit: 'R$',
        format: 'money',
        formula: input('franchise_fee'),
        formulaHint: 'taxa de franquia informada',
        inputs: [FR.franchiseFee],
      },
      {
        code: 'fr_ad_fee',
        name: 'Taxa de publicidade',
        description: 'Percentual de publicidade aplicado sobre o faturamento.',
        unit: 'R$',
        format: 'money',
        formula: mul(revenue(), div(input('ad_rate'), lit(100))),
        formulaHint: 'faturamento × taxa de publicidade',
        inputs: [FR.adRate],
      },
      {
        code: 'fr_operating_cost_per_unit',
        name: 'Custo operacional por unidade',
        description: 'Custo realizado dividido pelas unidades da franquia acompanhadas.',
        unit: 'R$/un',
        format: 'money',
        formula: div(cost(), input('franchise_units')),
        formulaHint: 'custo operacional / unidades da franquia',
        inputs: [FR.units],
      },
      {
        code: 'fr_net_profit',
        name: 'Lucro líquido da unidade',
        description: 'Receita menos custos e despesas realizados da unidade.',
        unit: 'R$',
        format: 'money',
        formula: profit(),
        formulaHint: 'receita − custos − despesas',
        inputs: [],
      },
      {
        code: 'fr_payback',
        name: 'Payback do investimento',
        description: 'Meses necessários para recuperar o investimento com o lucro atual.',
        unit: 'meses',
        format: 'months',
        formula: div(input('franchise_investment'), profit()),
        formulaHint: 'investimento / lucro do período',
        inputs: [FR.investment],
      },
      {
        code: 'fr_roi',
        name: 'ROI da franquia',
        description: 'Lucro da unidade dividido pelo investimento na franquia.',
        unit: '%',
        format: 'pct',
        formula: pct(profit(), input('franchise_investment')),
        formulaHint: 'lucro / investimento',
        inputs: [FR.investment],
      },
      {
        code: 'fr_break_even',
        name: 'Ponto de equilíbrio',
        description: 'Faturamento necessário para cobrir os custos fixos da unidade.',
        unit: 'R$',
        format: 'money',
        formula: breakEven(input('fixed_costs')),
        formulaHint: 'custos fixos / margem de contribuição %',
        inputs: [FR.fixed],
      },
      {
        code: 'fr_revenue_per_employee',
        name: 'Faturamento por funcionário',
        description: 'Receita da unidade dividida pelo quadro de funcionários da empresa.',
        unit: 'R$/funcionário',
        format: 'money',
        formula: div(revenue(), employeeCount()),
        formulaHint: 'faturamento / funcionários',
        inputs: [],
      },
      {
        code: 'fr_revenue_per_sqm',
        name: 'Faturamento por m²',
        description: 'Receita da unidade dividida pela área em metros quadrados.',
        unit: 'R$/m²',
        format: 'money',
        formula: div(revenue(), input('sqm')),
        formulaHint: 'faturamento / m²',
        inputs: [FR.sqm],
      },
      {
        code: 'fr_sales_count',
        name: 'Vendas por período',
        description: 'Quantidade de vendas realizadas pela unidade no período.',
        unit: 'un',
        format: 'number',
        formula: input('sales_count'),
        formulaHint: 'quantidade de vendas informada',
        inputs: [FR.sales],
      },
      {
        code: 'fr_growth_rate',
        name: 'Taxa de crescimento',
        description: 'Variação do faturamento em relação ao período anterior.',
        unit: '%',
        format: 'pct',
        formula: pct(sub(revenue(), previousRevenue()), previousRevenue()),
        formulaHint: '(faturamento atual − anterior) / anterior',
        inputs: [],
      },
      {
        code: 'fr_cac',
        name: 'CAC',
        description: 'Custo de aquisição de cliente: marketing dividido pelos novos clientes.',
        unit: 'R$',
        format: 'money',
        formula: div(input('marketing_cost'), input('new_customers')),
        formulaHint: 'custo de aquisição / novos clientes',
        inputs: [FR.marketing, FR.newCustomers],
      },
      {
        code: 'fr_ltv',
        name: 'LTV',
        description: 'Valor do tempo de vida do cliente: receita por cliente vezes a vida média em meses.',
        unit: 'R$',
        format: 'money',
        formula: mul(div(revenue(), input('customer_count')), input('lifespan_months')),
        formulaHint: '(faturamento / clientes) × vida média em meses',
        inputs: [FR.customers, FR.lifespan],
      },
      {
        code: 'fr_margin_after_royalties',
        name: 'Margem após royalties',
        description: 'Resultado depois dos custos realizados e dos royalties calculados sobre o faturamento.',
        unit: '%',
        format: 'pct',
        formula: pct(sub(profit(), royalties), revenue()),
        formulaHint: '(lucro − royalties) / receita',
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
