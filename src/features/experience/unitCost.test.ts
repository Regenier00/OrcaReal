import { SEGMENT_OPTIONS } from '../company/segmentOptions.ts'
import {
  defaultUnitCodesForSegments,
  unitCostsForSegments,
} from './catalog/segmentUnits.ts'
import {
  COST_PER_EMPLOYEE,
  REVENUE_PER_EMPLOYEE,
  isEmployeeHeadcountIndicator,
  mergeEmployeeVolumes,
  parseEmployeeCount,
  volumesFromEmployeeCount,
} from './employeeCount.ts'
import {
  REVENUE_MODELS,
  REVENUE_MODEL_INDICATORS,
  revenueUnitCostsFor,
  selectedRevenueModels,
} from './catalog/revenueModels.ts'
import { realizedCostForMonth, unitCostForMonth } from './unitCost.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function testSegmentCoverage() {
  for (const option of SEGMENT_OPTIONS) {
    const defs = unitCostsForSegments([option.code])
    assert(defs.length > 0, `ramo ${option.code} precisa de unidade de custo`)
  }

  const tech = unitCostsForSegments(['tech'])
  assert(tech.length === 2, 'tecnologia deve ter custo por projeto e por hora')
  assert(
    tech.some((item) => item.displayUnit === 'R$/projeto'),
    'tecnologia deve expor R$/projeto'
  )
  assert(
    tech.some((item) => item.displayUnit === 'R$/hora'),
    'tecnologia deve expor R$/hora'
  )

  const pec = unitCostsForSegments(['livestock'])[0]
  assert(pec.displayUnit === 'R$/cabeça', 'pecuária usa R$/cabeça')
  assert(
    pec.quantityPrompt.toLowerCase().includes('cabeças'),
    'pecuária pergunta a quantidade de cabeças'
  )

  const trn = unitCostsForSegments(['transport_logistics'])[0]
  assert(trn.displayUnit === 'R$/km rodado', 'transporte usa R$/km rodado')
  assert(
    trn.quantityPrompt.toLowerCase().includes('quilômetros') ||
      trn.quantityPrompt.toLowerCase().includes('km'),
    'transporte pergunta os km rodados'
  )

  const extra = unitCostsForSegments(['livestock', 'transport_logistics'])
  assert(extra.length === 2, 'ramos extras geram um card para cada unidade')
  assert(
    defaultUnitCodesForSegments(['agro']).includes('hectare'),
    'agro usa hectare como unidade padrão'
  )
}

function testCalculation() {
  assert(unitCostForMonth(45000, 200) === 225, 'custo por cabeça = 45000 / 200')
  assert(unitCostForMonth(1000, 0) == null, 'quantidade zero não calcula')
  assert(unitCostForMonth(1000, null) == null, 'sem quantidade não calcula')
  assert(unitCostForMonth(10, 3) === 3.33, 'arredonda o resultado')

  const actual = {
    items: [
      { categoryType: 'cost', amounts: { '2026-08': 80 } },
      { categoryType: 'expense', amounts: { '2026-08': 20 } },
      { categoryType: 'revenue', amounts: { '2026-08': 999 } },
    ],
  }

  const classified = [
    { monthKey: '2026-08', amount: 50, type: 'expense' },
    { monthKey: '2026-08', amount: 30, type: 'income' },
    { monthKey: '2026-08', amount: 15, type: 'expense', moneyGroup: 'cost' },
  ]

  const total = realizedCostForMonth(actual, classified, '2026-08')
  assert(total === 95, `custo realizado usa só o grupo custo: ${total}`)
}

function testEmployeeCount() {
  assert(parseEmployeeCount(12) === 12, 'número inteiro de funcionários')
  assert(parseEmployeeCount('25') === 25, 'número em texto')
  assert(parseEmployeeCount('11_50') == null, 'faixa antiga não vira quantidade')
  assert(parseEmployeeCount(0) == null, 'zero não conta')
  assert(isEmployeeHeadcountIndicator(COST_PER_EMPLOYEE), 'custo por funcionário')
  assert(isEmployeeHeadcountIndicator(REVENUE_PER_EMPLOYEE), 'receita por funcionário')

  const volumes = volumesFromEmployeeCount(8, ['2026-07', '2026-08'])
  assert(volumes['2026-07'] === 8, 'preenche julho com o quadro da empresa')
  assert(volumes['2026-08'] === 8, 'preenche agosto com o quadro da empresa')

  const merged = mergeEmployeeVolumes({ '2026-07': 10 }, 8, ['2026-07', '2026-08'])
  assert(merged['2026-07'] === 10, 'mês informado não é sobrescrito pelo cadastro')
  assert(merged['2026-08'] === 8, 'mês sem dado usa o cadastro como valor inicial')
  assert(unitCostForMonth(1600, merged['2026-08']) === 200, 'custo por funcionário = 1600 / 8')
}

function testRevenueModels() {
  for (const model of REVENUE_MODELS) {
    assert(model.indicators.length >= 3, `${model.label} precisa de pelo menos 3 indicadores`)
  }

  const product = revenueUnitCostsFor(['venda_de_produtos'])
  assert(product.length === 3, 'venda de produtos gera 3 indicadores')
  assert(
    product.some((item) => item.indicatorName === 'Valor médio de venda'),
    'venda de produtos gera valor médio de venda'
  )
  assert(
    product.every((item) => item.displayUnit.startsWith('R$/')),
    'indicadores de receita usam R$ por unidade'
  )

  const selected = selectedRevenueModels(
    { revenue_model: ['venda_de_produtos', 'contratos'] },
    null
  )
  assert(selected.length === 2, 'aceita mais de um modelo de receita')
  assert(revenueUnitCostsFor(selected).length === 6, 'dois modelos geram 6 indicadores')

  const fromProfile = selectedRevenueModels({}, 'venda_de_produtos')
  assert(fromProfile[0] === 'venda_de_produtos', 'lê o modelo gravado no perfil')

  const fromCsv = selectedRevenueModels({}, 'venda_de_produtos, contratos')
  assert(fromCsv.length === 2, 'lê vários modelos gravados no perfil')

  const codes = REVENUE_MODEL_INDICATORS.map((item) => item.code)
  assert(new Set(codes).size === codes.length, 'códigos de indicadores de receita não se repetem')
  assert(
    REVENUE_MODEL_INDICATORS.filter(
      (item) =>
        item.activation &&
        'eq' in item.activation &&
        item.activation.eq.value === 'venda_de_produtos'
    ).length === 3,
    'venda de produtos tem 3 indicadores ativados pela resposta'
  )
}

testSegmentCoverage()
testCalculation()
testEmployeeCount()
testRevenueModels()
console.log('unitCost tests ok')
