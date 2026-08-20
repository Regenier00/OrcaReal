import {
  breakEven,
  cost,
  div,
  employeeCount,
  evaluateOperationalFormula,
  expense,
  formulaBaseMetrics,
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
  type OperationalFormulaContext,
} from './operationalFormula.ts'
import {
  OPERATION_MODELS,
  findOperationalIndicator,
  operationIndicatorOptionsFor,
  operationModelFromValue,
  operationalIndicatorsFor,
  selectedOperationPriorities,
} from '../experience/catalog/operationModels.ts'

const ASSET_WORD = /\bativos?\b/i

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const ctx: OperationalFormulaContext = {
  revenue: 20000,
  cost: 12000,
  expense: 2000,
  previousRevenue: 16000,
  employeeCount: 8,
  inputs: {
    units_produced: 400,
    total_assets: 100000,
    investment: 50000,
    fixed_costs: 6000,
    idle_capacity: 20,
    total_capacity: 100,
    maintenance_cost: 1500,
    asset_count: 5,
    depreciation: 800,
    lease_cost: 3000,
    leased_units: 10,
    leased_asset_value: 40000,
    leased_area: 8,
    ownership_cost: 4500,
    outsourcing_cost: 4000,
    outsourced_units: 80,
    internal_cost: 5500,
    contracted_services: 4,
    delivered_units: 80,
    third_party_count: 2,
    own_cost: 5000,
    lease_cost_mix: 3000,
    out_cost: 2000,
    own_revenue: 9000,
    lease_revenue: 7000,
    out_revenue: 4000,
    own_units: 100,
    lease_units: 50,
    out_units: 40,
    own_investment: 20000,
    lease_investment: 10000,
    out_investment: 8000,
    own_fixed: 2000,
    lease_fixed: 1500,
    out_fixed: 800,
    sales_count: 100,
    cogs: 7000,
    royalty_rate: 5,
    franchise_fee: 1200,
    ad_rate: 2,
    franchise_units: 1,
    franchise_investment: 80000,
    sqm: 40,
    marketing_cost: 3000,
    new_customers: 15,
    customer_count: 50,
    lifespan_months: 18,
  },
}

function evalCode(code: string, extra?: Partial<OperationalFormulaContext>) {
  const indicator = findOperationalIndicator(code)
  assert(indicator, `indicador ${code} precisa existir`)
  return evaluateOperationalFormula(indicator.formula, {
    ...ctx,
    ...extra,
    inputs: { ...ctx.inputs, ...(extra?.inputs ?? {}) },
  })
}

assert(evaluateOperationalFormula(cost(), ctx) === 12000, 'custo do grupo')
assert(evaluateOperationalFormula(expense(), ctx) === 2000, 'despesa do grupo')
assert(evaluateOperationalFormula(operatingCost(), ctx) === 14000, 'custo operacional total')
assert(evaluateOperationalFormula(profit(), ctx) === 6000, 'lucro = receita − custo − despesa')
assert(evaluateOperationalFormula(div(cost(), input('units_produced')), ctx) === 30, 'custo por unidade')
assert(evaluateOperationalFormula(pct(profit(), revenue()), ctx) === 0.3, 'margem operacional 30%')
assert(evaluateOperationalFormula(pct(profit(), input('investment')), ctx) === 0.12, 'ROI 12%')

const be = evaluateOperationalFormula(breakEven(input('fixed_costs')), ctx)
assert(be === 8571.43, `ponto de equilíbrio próprio: ${be}`)

assert(
  evaluateOperationalFormula(pct(input('idle_capacity'), input('total_capacity')), ctx) === 0.2,
  'ociosidade 20%'
)
assert(
  evaluateOperationalFormula(div(input('maintenance_cost'), input('asset_count')), ctx) === 300,
  'manutenção por ativo'
)
assert(
  evaluateOperationalFormula(div(input('depreciation'), input('units_produced')), ctx) === 2,
  'depreciação por unidade'
)

assert(evaluateOperationalFormula(input('lease_cost'), ctx) === 3000, 'custo de arrendamento')
assert(
  evaluateOperationalFormula(div(input('lease_cost'), input('leased_units')), ctx) === 300,
  'arrendamento por unidade'
)
assert(
  evaluateOperationalFormula(pct(sub(revenue(), cost()), input('leased_asset_value')), ctx) === 0.2,
  'rentabilidade do ativo arrendado'
)
assert(
  evaluateOperationalFormula(div(revenue(), input('leased_units')), ctx) === 2000,
  'receita por área'
)
assert(
  evaluateOperationalFormula(div(sub(revenue(), cost()), input('leased_units')), ctx) === 800,
  'lucro por área'
)
assert(
  evaluateOperationalFormula(sub(input('lease_cost'), input('ownership_cost')), ctx) === -1500,
  'arrendar − possuir'
)
assert(
  evaluateOperationalFormula(pct(sub(revenue(), cost()), input('lease_cost')), ctx) === 2.67,
  'retorno sobre área arrendada'
)

assert(
  evaluateOperationalFormula(pct(input('outsourcing_cost'), operatingCost()), ctx) === 0.29,
  '% terceirizada ≈ 29%'
)
assert(
  evaluateOperationalFormula(sub(input('internal_cost'), input('outsourcing_cost')), ctx) === 1500,
  'economia com terceirização'
)
assert(
  evaluateOperationalFormula(pct(input('outsourcing_cost'), operatingCost()), ctx) === 0.29,
  'dependência de terceiros'
)
assert(
  evaluateOperationalFormula(div(input('delivered_units'), input('outsourcing_cost')), ctx) === 0.02,
  'produtividade do terceiro'
)
assert(
  evaluateOperationalFormula(
    pct(sub(sub(revenue(), cost()), input('outsourcing_cost')), revenue()),
    ctx
  ) === 0.2,
  'margem após terceirização'
)

const mixInputs = {
  ...ctx,
  inputs: {
    ...ctx.inputs,
    lease_cost: 3000,
  },
}
assert(
  evaluateOperationalFormula(sum([input('own_cost'), input('lease_cost'), input('out_cost')]), mixInputs) ===
    10000,
  'custo por modelo soma os três'
)
assert(
  evaluateOperationalFormula(
    div(sum([input('own_cost'), input('lease_cost'), input('out_cost')]), sum([input('own_units'), input('lease_units'), input('out_units')])),
    mixInputs
  ) === 52.63,
  'custo médio ponderado'
)
assert(
  evaluateOperationalFormula(
    sub(
      max([
        div(input('own_cost'), input('own_units')),
        div(input('lease_cost'), input('lease_units')),
        div(input('out_cost'), input('out_units')),
      ]),
      min([
        div(input('own_cost'), input('own_units')),
        div(input('lease_cost'), input('lease_units')),
        div(input('out_cost'), input('out_units')),
      ])
    ),
    mixInputs
  ) === 10,
  'economia entre modelos = 60 - 50'
)

assert(evaluateOperationalFormula(revenue(), ctx) === 20000, 'faturamento da unidade')
assert(evaluateOperationalFormula(div(revenue(), input('sales_count')), ctx) === 200, 'ticket médio')
assert(
  evaluateOperationalFormula(pct(sub(revenue(), cost()), revenue()), ctx) === 0.4,
  'margem bruta'
)
assert(
  evaluateOperationalFormula(pct(mul(revenue(), div(input('royalty_rate'), lit(100))), revenue()), ctx) ===
    0.05,
  'royalties 5%'
)
assert(
  evaluateOperationalFormula(pct(input('franchise_fee'), revenue()), ctx) === 0.06,
  'taxa de franquia %'
)
assert(
  evaluateOperationalFormula(pct(mul(revenue(), div(input('ad_rate'), lit(100))), revenue()), ctx) ===
    0.02,
  'taxa de publicidade 2%'
)
assert(
  evaluateOperationalFormula(div(input('franchise_investment'), profit()), ctx) === 13.33,
  'payback'
)
assert(evaluateOperationalFormula(div(revenue(), employeeCount()), ctx) === 2500, 'faturamento por funcionário')
assert(evaluateOperationalFormula(div(revenue(), input('sqm')), ctx) === 500, 'faturamento por m²')
assert(
  evaluateOperationalFormula(pct(sub(revenue(), previousRevenue()), previousRevenue()), ctx) === 0.25,
  'crescimento 25%'
)
assert(
  evaluateOperationalFormula(div(input('marketing_cost'), input('new_customers')), ctx) === 200,
  'CAC'
)
assert(
  evaluateOperationalFormula(mul(div(revenue(), input('customer_count')), input('lifespan_months')), ctx) ===
    7200,
  'LTV'
)

assert(
  evaluateOperationalFormula(div(cost(), input('units_produced')), {
    ...ctx,
    inputs: { ...ctx.inputs, units_produced: 0 },
  }) == null,
  'não divide por zero'
)
assert(
  evaluateOperationalFormula(pct(profit(), previousRevenue()), {
    ...ctx,
    previousRevenue: null,
  }) == null,
  'crescimento sem período anterior não calcula'
)
assert(
  evaluateOperationalFormula(div(revenue(), employeeCount()), {
    ...ctx,
    employeeCount: null,
  }) == null,
  'faturamento por funcionário exige quadro'
)

assert(evalCode('own_total_operating_cost') === 14000, 'catálogo custo operacional total')
assert(evalCode('own_cost_per_produced_unit') === 30, 'catálogo custo por unidade')
assert(evalCode('own_operating_margin') === 0.3, 'catálogo margem operacional')
assert(evalCode('fr_royalties') === 0.05, 'catálogo royalties %')
assert(evalCode('fr_franchise_fee') === 0.06, 'catálogo taxa de franquia %')
assert(evalCode('fr_ad_fee') === 0.02, 'catálogo taxa de publicidade %')
assert(evalCode('fr_gross_margin') === 0.4, 'catálogo margem bruta')
assert(evalCode('out_savings') === 1500, 'catálogo economia')
assert(evalCode('lease_vs_own_cost') === -1500, 'catálogo arrendar − possuir')
assert(evalCode('lease_margin_after') === 0.25, 'catálogo margem após arrendamento')
assert(evalCode('out_third_party_productivity') === 0.02, 'catálogo produtividade do terceiro')
assert(evalCode('mix_return_by_model') === 1, 'catálogo rentabilidade por modelo')
assert(evalCode('mix_roi_by_model') === 1, 'catálogo ROI por modelo')

const beLease = evalCode('lease_break_even')
assert(beLease === 5454.55, `ponto de equilíbrio do arrendamento: ${beLease}`)

assert(OPERATION_MODELS.length === 5, 'cinco modelos de operação')
assert(OPERATION_MODELS[0].indicators.length === 6, 'operação própria tem 6 indicadores')
assert(OPERATION_MODELS[1].indicators.length === 10, 'arrendada tem 10 indicadores')
assert(OPERATION_MODELS[2].indicators.length === 10, 'terceirizada tem 10 indicadores')
assert(OPERATION_MODELS[3].indicators.length === 12, 'mista tem 12 indicadores')
assert(OPERATION_MODELS[4].indicators.length === 19, 'franquia tem 19 indicadores')

assert(operationModelFromValue('arrendada')?.id === 'leased', 'aceita slug antigo arrendada')
assert(operationModelFromValue('terceirizada')?.id === 'outsourced', 'aceita slug antigo terceirizada')
assert(operationModelFromValue('mista')?.id === 'mixed', 'aceita slug antigo mista')
assert(operationModelFromValue('operacao_propria')?.id === 'own', 'aceita operação própria')

const options = operationIndicatorOptionsFor('operacao_propria')
assert(options.some((item) => item.label === 'ROI'), 'cards da operação própria incluem ROI')
assert(
  options.every((item) => !ASSET_WORD.test(item.label)),
  'operação própria não oferece opções sobre ativo'
)
assert(
  OPERATION_MODELS[0].indicators.every(
    (item) => !ASSET_WORD.test(`${item.name} ${item.description} ${item.unit} ${item.formulaHint}`)
  ),
  'indicadores da operação própria não falam sobre ativo'
)
assert(
  operationalIndicatorsFor('franquia', ['fr_cac', 'fr_ltv']).map((item) => item.code).join() ===
    'fr_cac,fr_ltv',
  'filtra indicadores selecionados'
)
assert(selectedOperationPriorities(['own_roi', 'own_operating_margin']).length === 2, 'lê prioridades múltiplas')
assert(selectedOperationPriorities('__skipped__').length === 0, 'pular não seleciona indicadores')

const names = OPERATION_MODELS.flatMap((model) => model.indicators.map((item) => item.code))
assert(new Set(names).size === names.length, 'códigos de indicadores operacionais são únicos')

const marginBases = formulaBaseMetrics(
  findOperationalIndicator('own_operating_margin')!.formula
)
assert(marginBases.has('revenue'), 'margem operacional usa receita')
assert(marginBases.has('cost'), 'margem operacional usa custo')
assert(marginBases.has('expense'), 'margem operacional usa despesa')

const operatingCostBases = formulaBaseMetrics(
  findOperationalIndicator('own_total_operating_cost')!.formula
)
assert(!operatingCostBases.has('revenue'), 'custo operacional não usa receita')
assert(operatingCostBases.has('cost'), 'custo operacional usa custo')
assert(operatingCostBases.has('expense'), 'custo operacional usa despesa')

assert(formulaBaseMetrics(operatingCost()).has('expense'), 'operatingCost inclui despesa')
assert(formulaBaseMetrics(profit()).has('expense'), 'profit inclui despesa')
assert(
  formulaBaseMetrics(pct(profit(), revenue())).has('expense'),
  'margem via profit inclui despesa'
)

const periodExpenseHints = OPERATION_MODELS.flatMap((model) =>
  model.indicators.filter((item) =>
    /(?:custo|receita).*(?:\+|−|-).*despesa|despesa.*(?:\+|−|-)/i.test(item.formulaHint)
  )
)
for (const item of periodExpenseHints) {
  assert(
    formulaBaseMetrics(item.formula).has('expense'),
    `${item.code}: fórmula de período cita Despesa mas não marca expense`
  )
}

console.log('operational indicator formula tests ok')
