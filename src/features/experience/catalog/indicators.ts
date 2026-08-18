import { indicator } from './helpers'
import { REVENUE_MODEL_INDICATORS } from './revenueModels'
import { OPERATION_MODEL_INDICATORS } from './operationModels'
import type { ExperienceCondition, IndicatorDef } from '../types'

const ALL = null

function operational(
  segments: string[],
  items: Array<{
    code: string
    name: string
    description?: string
    unit: string
    formula: string
    needUnits?: string[]
    needAnswer?: [string, string]
    unlessAnswer?: [string, string]
    section?: IndicatorDef['dashboardSection']
    requiredData?: string[]
  }>,
  start: number
): IndicatorDef[] {
  return items.map((item, index) => {
    const unitChecks: ExperienceCondition[] = (item.needUnits ?? []).map((code) => ({
      hasUnit: code,
    }))
    const answerCheck: ExperienceCondition[] = item.needAnswer
      ? [{ eq: { answer: item.needAnswer[0], value: item.needAnswer[1] } }]
      : []

    const activation =
      unitChecks.length + answerCheck.length > 0
        ? { any: [...unitChecks, ...answerCheck] }
        : undefined

    const unless = item.unlessAnswer
      ? { eq: { answer: item.unlessAnswer[0], value: item.unlessAnswer[1] } }
      : item.needAnswer
        ? { eq: { answer: item.needAnswer[0], value: 'no' } }
        : undefined

    return indicator(
      {
        code: item.code,
        name: item.name,
        description:
          item.description ??
          `Indicador operacional de ${item.name.toLowerCase()}.`,
        category: 'operational',
        unit: item.unit,
        formula: item.formula,
        segments,
        activation,
        unless,
        dashboardSection: item.section ?? 'operational',
        requiredData: item.requiredData,
      },
      start + index * 10
    )
  })
}

const financial: IndicatorDef[] = [
  indicator({ code: 'revenue', name: 'Receita', description: 'Receita da operação no período.', category: 'financial', unit: 'R$', formula: 'soma das receitas', segments: ALL, dashboardSection: 'financial' }, 10),
  indicator({ code: 'costs', name: 'Custos', description: 'Custos diretos da operação.', category: 'financial', unit: 'R$', formula: 'soma dos custos', segments: ALL, dashboardSection: 'financial' }, 20),
  indicator({ code: 'expenses', name: 'Despesas', description: 'Despesas operacionais e administrativas.', category: 'financial', unit: 'R$', formula: 'soma das despesas', segments: ALL, dashboardSection: 'financial' }, 30),
  indicator({ code: 'profit', name: 'Lucro', description: 'Resultado após custos e despesas.', category: 'financial', unit: 'R$', formula: 'receita - custos - despesas', segments: ALL, dashboardSection: 'financial' }, 40),
  indicator({ code: 'margin', name: 'Margem', description: 'Margem sobre a receita.', category: 'financial', unit: '%', formula: 'lucro / receita', segments: ALL, dashboardSection: 'profitability' }, 50),
  indicator({ code: 'ebitda', name: 'EBITDA', description: 'Resultado operacional antes de juros, impostos, depreciação e amortização.', category: 'financial', unit: 'R$', formula: 'resultado operacional + D&A', segments: ALL, dashboardSection: 'financial' }, 60),
  indicator({ code: 'operating_result', name: 'Resultado operacional', description: 'Resultado da atividade principal.', category: 'financial', unit: 'R$', formula: 'receita - custos - despesas operacionais', segments: ALL, dashboardSection: 'financial' }, 70),
  indicator({ code: 'cash_flow', name: 'Fluxo de caixa', description: 'Variação de caixa no período.', category: 'financial', unit: 'R$', formula: 'entradas - saídas', segments: ALL, dashboardSection: 'financial' }, 80),
  indicator({ code: 'contribution_margin', name: 'Margem de contribuição', description: 'Receita menos custos variáveis.', category: 'financial', unit: 'R$', formula: 'receita - custos variáveis', segments: ALL, dashboardSection: 'profitability' }, 90),
  indicator({ code: 'break_even', name: 'Ponto de equilíbrio', description: 'Receita necessária para cobrir custos e despesas.', category: 'financial', unit: 'R$', formula: 'custos fixos / margem de contribuição %', segments: ALL, dashboardSection: 'profitability' }, 100),
  indicator({ code: 'budget_variance', name: 'Desvio orçamentário', description: 'Diferença entre orçado e realizado.', category: 'financial', unit: 'R$', formula: 'realizado - orçado', segments: ALL, dashboardSection: 'budget_vs_actual' }, 110),
  indicator({ code: 'budget_variance_pct', name: 'Desvio orçamentário %', description: 'Percentual de desvio entre orçado e realizado.', category: 'financial', unit: '%', formula: '(realizado - orçado) / orçado', segments: ALL, dashboardSection: 'budget_vs_actual' }, 120),
  indicator({ code: 'budget_vs_actual', name: 'Orçado × Realizado', description: 'Comparação entre o planejado e o executado.', category: 'financial', unit: 'R$', formula: 'orçado e realizado no período', segments: ALL, dashboardSection: 'budget_vs_actual' }, 130),
  indicator({ code: 'cost_concentration', name: 'Concentração de custos', description: 'Participação dos maiores custos no total.', category: 'financial', unit: '%', formula: 'top custos / custo total', segments: ALL, dashboardSection: 'budget_vs_actual' }, 140),
  indicator({ code: 'realization_pct', name: 'Percentual de realização', description: 'Quanto do orçado já foi realizado.', category: 'financial', unit: '%', formula: 'realizado / orçado', segments: ALL, dashboardSection: 'budget_vs_actual' }, 150),
]

const strategic: IndicatorDef[] = [
  indicator({ code: 'profitability', name: 'Rentabilidade', description: 'Capacidade de gerar retorno sobre a operação.', category: 'strategic', unit: '%', formula: 'lucro / receita', segments: ALL, dashboardSection: 'profitability' }, 200),
  indicator({ code: 'productivity', name: 'Produtividade', description: 'Relação entre produção e recursos utilizados.', category: 'strategic', unit: 'un', formula: 'produção / recurso', segments: ALL, dashboardSection: 'operational' }, 210),
  indicator({ code: 'efficiency', name: 'Eficiência', description: 'Uso dos recursos em relação à capacidade.', category: 'strategic', unit: '%', formula: 'utilizado / disponível', segments: ALL, dashboardSection: 'operational' }, 220),
  indicator({ code: 'growth', name: 'Crescimento', description: 'Evolução da receita em relação ao período anterior.', category: 'strategic', unit: '%', formula: '(receita atual - anterior) / anterior', segments: ALL, dashboardSection: 'profitability' }, 230),
  indicator({ code: 'cost_share', name: 'Participação dos custos', description: 'Peso dos custos sobre a receita.', category: 'strategic', unit: '%', formula: 'custos / receita', segments: ALL, dashboardSection: 'profitability' }, 240),
  indicator({ code: 'cost_evolution', name: 'Evolução dos custos', description: 'Variação dos custos no tempo.', category: 'strategic', unit: '%', formula: '(custo atual - anterior) / anterior', segments: ALL, dashboardSection: 'budget_vs_actual' }, 250),
  indicator({ code: 'budget_deviation', name: 'Desvio do orçamento', description: 'Aderência ao plano orçamentário.', category: 'strategic', unit: '%', formula: '(realizado - orçado) / orçado', segments: ALL, dashboardSection: 'budget_vs_actual' }, 260),
  indicator({ code: 'unit_profitability', name: 'Rentabilidade por unidade de negócio', description: 'Resultado por unidade de análise da empresa.', category: 'strategic', unit: 'R$', formula: 'resultado / unidade de análise', segments: ALL, dashboardSection: 'profitability', activation: { eq: { answer: 'tracks_unit_costs', value: 'yes' } } }, 270),
]

const agro = operational(['agro'], [
  { code: 'cost_per_hectare', name: 'Custo por hectare', unit: 'R$/hectare', formula: 'custos / hectares' },
  { code: 'cost_per_crop', name: 'Custo por cultura', unit: 'R$', formula: 'custos da cultura / culturas', needUnits: ['crop'], needAnswer: ['agro_tracks_cost_crop', 'yes'] },
  { code: 'cost_per_bag', name: 'Custo por saca', unit: 'R$/sc', formula: 'custos / sacas', needUnits: ['bag'] },
  { code: 'cost_per_ton_agro', name: 'Custo por tonelada', unit: 'R$/t', formula: 'custos / toneladas', needUnits: ['ton'] },
  { code: 'revenue_per_hectare', name: 'Receita por hectare', unit: 'R$/ha', formula: 'receita / hectares', needUnits: ['hectare'], section: 'profitability' },
  { code: 'margin_per_hectare', name: 'Margem por hectare', unit: 'R$/ha', formula: '(receita - custos) / hectares', needUnits: ['hectare'], section: 'profitability' },
  { code: 'margin_per_crop', name: 'Margem por cultura', unit: 'R$', formula: 'receita da cultura - custo da cultura', needUnits: ['crop'], section: 'profitability' },
  { code: 'productivity_per_hectare', name: 'Produtividade por hectare', unit: 'un/ha', formula: 'produção / hectares', needUnits: ['hectare'], needAnswer: ['agro_tracks_productivity_hectare', 'yes'] },
  { code: 'revenue_per_bag', name: 'Receita por saca', unit: 'R$/sc', formula: 'receita / sacas', needUnits: ['bag'], section: 'profitability' },
  { code: 'input_cost', name: 'Custo dos insumos', unit: 'R$', formula: 'soma dos insumos' },
  { code: 'input_cost_share', name: 'Participação dos insumos no custo', unit: '%', formula: 'insumos / custo total', section: 'profitability' },
  { code: 'oxr_per_crop', name: 'Orçado × Realizado por cultura', unit: 'R$', formula: 'orçado e realizado por cultura', needUnits: ['crop'], section: 'budget_vs_actual' },
  { code: 'oxr_per_hectare', name: 'Orçado × Realizado por hectare', unit: 'R$/ha', formula: 'orçado e realizado / hectares', needUnits: ['hectare'], section: 'budget_vs_actual' },
], 300)

const livestock = operational(['livestock'], [
  { code: 'cost_per_animal', name: 'Custo por animal', unit: 'R$', formula: 'custos / animais', needUnits: ['animal'], needAnswer: ['pec_tracks_animal', 'yes'] },
  { code: 'cost_per_head', name: 'Custo por cabeça', unit: 'R$/cabeça', formula: 'custos / cabeças' },
  { code: 'cost_per_lot', name: 'Custo por lote', unit: 'R$', formula: 'custos / lotes', needUnits: ['lot'], needAnswer: ['pec_tracks_lot', 'yes'] },
  { code: 'cost_per_arroba', name: 'Custo por arroba', unit: 'R$/@', formula: 'custos / arrobas', needUnits: ['arroba'] },
  { code: 'cost_per_hectare_pec', name: 'Custo por hectare', unit: 'R$/ha', formula: 'custos / hectares', needUnits: ['hectare'] },
  { code: 'revenue_per_animal', name: 'Receita por animal', unit: 'R$', formula: 'receita / animais', needUnits: ['animal'], section: 'profitability' },
  { code: 'margin_per_animal', name: 'Margem por animal', unit: 'R$', formula: '(receita - custos) / animais', needUnits: ['animal'], section: 'profitability' },
  { code: 'margin_per_lot', name: 'Margem por lote', unit: 'R$', formula: '(receita - custos) / lotes', needUnits: ['lot'], section: 'profitability' },
  { code: 'avg_weight_gain', name: 'Ganho médio de peso', unit: 'kg', formula: 'variação de peso / período' },
  { code: 'feed_cost_per_animal', name: 'Custo de alimentação por animal', unit: 'R$', formula: 'alimentação / animais', needUnits: ['animal'] },
  { code: 'health_cost_per_animal', name: 'Custo sanitário por animal', unit: 'R$', formula: 'medicamentos / animais', needUnits: ['animal'] },
  { code: 'production_cost_pec', name: 'Custo da produção', unit: 'R$', formula: 'soma dos custos produtivos' },
  { code: 'oxr_per_lot', name: 'Orçado × Realizado por lote', unit: 'R$', formula: 'orçado e realizado por lote', needUnits: ['lot'], section: 'budget_vs_actual' },
  { code: 'oxr_per_animal', name: 'Orçado × Realizado por animal', unit: 'R$', formula: 'orçado e realizado por animal', needUnits: ['animal'], section: 'budget_vs_actual' },
], 400)

const commerce = operational(['commerce'], [
  { code: 'cmv', name: 'CMV', unit: 'R$', formula: 'estoque inicial + compras - estoque final' },
  { code: 'gross_margin', name: 'Margem bruta', unit: '%', formula: '(receita - CMV) / receita', section: 'profitability' },
  { code: 'margin_per_product', name: 'Margem por produto', unit: 'R$', formula: 'preço - custo do produto', needUnits: ['product'], section: 'profitability' },
  { code: 'margin_per_category', name: 'Margem por categoria', unit: 'R$', formula: 'receita da categoria - custo da categoria', needUnits: ['category'], section: 'profitability' },
  { code: 'cost_per_product', name: 'Custo por produto', unit: 'R$', formula: 'custo de aquisição + custos diretos', needUnits: ['product'] },
  { code: 'cost_per_sold_unit', name: 'Custo por produto vendido', unit: 'R$/produto vendido', formula: 'custos / produtos vendidos' },
  { code: 'avg_ticket', name: 'Ticket médio', unit: 'R$', formula: 'receita / quantidade de vendas', needUnits: ['sold_unit', 'order'] },
  { code: 'inventory_turnover', name: 'Giro de estoque', unit: 'x', formula: 'CMV / estoque médio', needAnswer: ['com_stock', 'yes'] },
  { code: 'inventory_coverage', name: 'Cobertura de estoque', unit: 'dias', formula: 'estoque / venda média diária', needAnswer: ['com_stock', 'yes'] },
  { code: 'product_profitability', name: 'Rentabilidade por produto', unit: '%', formula: 'margem do produto / receita do produto', needUnits: ['product'], section: 'profitability' },
  { code: 'product_revenue_share', name: 'Participação de cada produto na receita', unit: '%', formula: 'receita do produto / receita total', needUnits: ['product'] },
  { code: 'oxr_per_category', name: 'Orçado × Realizado por categoria', unit: 'R$', formula: 'orçado e realizado por categoria', needUnits: ['category'], section: 'budget_vs_actual' },
], 500)

const industry = operational(['industry'], [
  { code: 'production_cost', name: 'Custo de produção', unit: 'R$', formula: 'MP + MOD + CIF' },
  { code: 'cost_per_unit', name: 'Custo por unidade produzida', unit: 'R$/unidade produzida', formula: 'custo de produção / unidades' },
  { code: 'cost_per_lot_ind', name: 'Custo por lote', unit: 'R$', formula: 'custo de produção / lotes', needUnits: ['lot'] },
  { code: 'raw_material_cost', name: 'Custo da matéria-prima', unit: 'R$', formula: 'consumo de matéria-prima' },
  { code: 'labor_cost', name: 'Custo de mão de obra', unit: 'R$', formula: 'mão de obra direta' },
  { code: 'overhead_cost', name: 'Custos indiretos', unit: 'R$', formula: 'CIF do período' },
  { code: 'machine_hour_cost', name: 'Custo por hora de máquina', unit: 'R$/h', formula: 'custos de máquina / horas' },
  { code: 'capacity_used', name: 'Capacidade utilizada', unit: '%', formula: 'produção / capacidade' },
  { code: 'loss_index', name: 'Índice de perdas', unit: '%', formula: 'perdas / produção' },
  { code: 'margin_per_product_ind', name: 'Margem por produto', unit: 'R$', formula: 'receita - custo do produto', needUnits: ['product'], section: 'profitability' },
  { code: 'margin_per_lot_ind', name: 'Margem por lote', unit: 'R$', formula: 'receita - custo do lote', needUnits: ['lot'], section: 'profitability' },
  { code: 'oxr_production', name: 'Orçado × Realizado da produção', unit: 'R$', formula: 'orçado e realizado da produção', section: 'budget_vs_actual' },
], 600)

const construction = operational(['construction'], [
  { code: 'cost_per_work', name: 'Custo por obra', unit: 'R$', formula: 'custos / obras', needUnits: ['work'] },
  { code: 'cost_per_sqm', name: 'Custo por m² construído', unit: 'R$/m² construído', formula: 'custos / m²' },
  { code: 'cost_per_stage', name: 'Custo por etapa', unit: 'R$', formula: 'custos da etapa', needUnits: ['work_stage'] },
  { code: 'material_cost_con', name: 'Custo de materiais', unit: 'R$', formula: 'materiais aplicados' },
  { code: 'labor_cost_con', name: 'Custo de mão de obra', unit: 'R$', formula: 'mão de obra da obra' },
  { code: 'third_party_cost_con', name: 'Custo de terceiros', unit: 'R$', formula: 'serviços terceirizados' },
  { code: 'margin_per_work', name: 'Margem por obra', unit: 'R$', formula: 'valor contratado - custo da obra', needUnits: ['work'], section: 'profitability' },
  { code: 'oxr_per_work', name: 'Orçado × Realizado por obra', unit: 'R$', formula: 'orçado e realizado por obra', needUnits: ['work'], section: 'budget_vs_actual' },
  { code: 'oxr_per_stage', name: 'Orçado × Realizado por etapa', unit: 'R$', formula: 'orçado e realizado por etapa', needUnits: ['work_stage'], section: 'budget_vs_actual' },
  { code: 'execution_pct', name: 'Percentual de execução', unit: '%', formula: 'executado / previsto' },
  { code: 'cost_to_complete', name: 'Custo previsto para conclusão', unit: 'R$', formula: 'orçado restante + desvio' },
], 700)

const transport = operational(['transport_logistics'], [
  { code: 'cost_per_km', name: 'Custo por km rodado', unit: 'R$/km rodado', formula: 'custos / km' },
  { code: 'cost_per_trip', name: 'Custo por viagem', unit: 'R$', formula: 'custos / viagens', needUnits: ['trip'] },
  { code: 'cost_per_vehicle', name: 'Custo por veículo', unit: 'R$', formula: 'custos / veículos', needUnits: ['vehicle'] },
  { code: 'cost_per_transported_ton', name: 'Custo por tonelada', unit: 'R$/t', formula: 'custos / toneladas', needUnits: ['transported_ton'] },
  { code: 'fuel_cost_per_km', name: 'Custo de combustível por km', unit: 'R$/km', formula: 'combustível / km', needUnits: ['km'] },
  { code: 'maintenance_cost_per_km', name: 'Custo de manutenção por km', unit: 'R$/km', formula: 'manutenção / km', needUnits: ['km'] },
  { code: 'revenue_per_km', name: 'Receita por km', unit: 'R$/km', formula: 'receita / km', needUnits: ['km'], section: 'profitability' },
  { code: 'revenue_per_trip', name: 'Receita por viagem', unit: 'R$', formula: 'receita / viagens', needUnits: ['trip'], section: 'profitability' },
  { code: 'margin_per_trip', name: 'Margem por viagem', unit: 'R$', formula: '(receita - custos) / viagens', needUnits: ['trip'], section: 'profitability' },
  { code: 'fleet_utilization', name: 'Utilização da frota', unit: '%', formula: 'km realizados / km disponíveis' },
  { code: 'oxr_per_vehicle', name: 'Orçado × Realizado por veículo', unit: 'R$', formula: 'orçado e realizado por veículo', needUnits: ['vehicle'], section: 'budget_vs_actual' },
], 800)

const food = operational(['food'], [
  { code: 'food_cmv', name: 'CMV', unit: 'R$', formula: 'custo da mercadoria vendida' },
  { code: 'cmv_per_product', name: 'CMV por produto', unit: 'R$', formula: 'custo dos ingredientes do produto', needUnits: ['product'] },
  { code: 'cost_per_meal', name: 'Custo por refeição', unit: 'R$/refeição', formula: 'custos / refeições' },
  { code: 'cost_per_order', name: 'Custo por pedido', unit: 'R$', formula: 'custos / pedidos', needUnits: ['order'] },
  { code: 'food_avg_ticket', name: 'Ticket médio', unit: 'R$', formula: 'receita / pedidos', needUnits: ['order'] },
  { code: 'margin_per_product_food', name: 'Margem por produto', unit: 'R$', formula: 'preço - CMV do produto', needUnits: ['product'], section: 'profitability' },
  { code: 'margin_per_order', name: 'Margem por pedido', unit: 'R$', formula: '(receita - custos) / pedidos', needUnits: ['order'], section: 'profitability' },
  { code: 'waste', name: 'Desperdício', unit: 'R$', formula: 'perdas de ingredientes' },
  { code: 'packaging_cost', name: 'Custo de embalagem', unit: 'R$', formula: 'embalagens do período' },
  { code: 'delivery_fees', name: 'Taxas de delivery', unit: 'R$', formula: 'taxas de aplicativos', needAnswer: ['food_delivery', 'yes'] },
], 900)

const services = operational(['services', 'professional'], [
  { code: 'cost_per_client', name: 'Custo por cliente', unit: 'R$', formula: 'custos / clientes', needUnits: ['client'] },
  { code: 'cost_per_project', name: 'Custo por projeto', unit: 'R$', formula: 'custos / projetos', needUnits: ['project'] },
  { code: 'cost_per_contract', name: 'Custo por contrato', unit: 'R$', formula: 'custos / contratos', needUnits: ['contract'] },
  { code: 'cost_per_hour', name: 'Custo por hora trabalhada', unit: 'R$/hora trabalhada', formula: 'custos / horas' },
  { code: 'revenue_per_client', name: 'Receita por cliente', unit: 'R$', formula: 'receita / clientes', needUnits: ['client'], section: 'profitability' },
  { code: 'revenue_per_hour', name: 'Receita por hora', unit: 'R$/h', formula: 'receita / horas', needUnits: ['worked_hour'], section: 'profitability' },
  { code: 'margin_per_client', name: 'Margem por cliente', unit: 'R$', formula: '(receita - custos) / clientes', needUnits: ['client'], section: 'profitability' },
  { code: 'margin_per_project', name: 'Margem por projeto', unit: 'R$', formula: '(receita - custos) / projetos', needUnits: ['project'], section: 'profitability' },
  { code: 'contract_profitability', name: 'Rentabilidade por contrato', unit: '%', formula: 'margem / receita do contrato', needUnits: ['contract'], section: 'profitability' },
  { code: 'labor_utilization', name: 'Utilização da mão de obra', unit: '%', formula: 'horas faturáveis / horas disponíveis' },
], 1000)

const tech = operational(['tech'], [
  { code: 'recurring_revenue', name: 'Receita recorrente', unit: 'R$', formula: 'MRR / ARR', needAnswer: ['tech_recurring', 'yes'] },
  { code: 'revenue_per_client_tech', name: 'Receita por cliente', unit: 'R$', formula: 'receita / clientes', needUnits: ['client'], section: 'profitability' },
  { code: 'cost_per_client_tech', name: 'Custo por cliente', unit: 'R$', formula: 'custos / clientes', needUnits: ['client'] },
  { code: 'cost_per_project_tech', name: 'Custo por projeto', unit: 'R$/projeto', formula: 'custos / projetos' },
  { code: 'cost_per_hour_tech', name: 'Custo por hora', unit: 'R$/hora', formula: 'custos / horas' },
  { code: 'margin_per_project_tech', name: 'Margem por projeto', unit: 'R$', formula: 'receita - custo do projeto', needUnits: ['project'], section: 'profitability' },
  { code: 'margin_per_client_tech', name: 'Margem por cliente', unit: 'R$', formula: 'receita - custo do cliente', needUnits: ['client'], section: 'profitability' },
  { code: 'revenue_per_employee', name: 'Receita por funcionário', unit: 'R$', formula: 'receita / funcionários', needUnits: ['employee'] },
  { code: 'infrastructure_cost', name: 'Custo de infraestrutura', unit: 'R$', formula: 'cloud + ferramentas + hosting' },
  { code: 'contract_profitability_tech', name: 'Rentabilidade por contrato', unit: '%', formula: 'margem / receita do contrato', needUnits: ['contract'], section: 'profitability' },
], 1100)

const health = operational(['health'], [
  { code: 'cost_per_appointment', name: 'Custo por consulta', unit: 'R$', formula: 'custos / consultas', needUnits: ['appointment'] },
  { code: 'cost_per_health_attendance', name: 'Custo por atendimento', unit: 'R$/atendimento', formula: 'custos / atendimentos' },
  { code: 'cost_per_procedure', name: 'Custo por procedimento', unit: 'R$', formula: 'custos / procedimentos', needUnits: ['procedure'] },
  { code: 'revenue_per_patient', name: 'Receita por paciente', unit: 'R$', formula: 'receita / pacientes', needUnits: ['patient'], section: 'profitability' },
  { code: 'revenue_per_professional', name: 'Receita por profissional', unit: 'R$', formula: 'receita / profissionais', needUnits: ['professional'], section: 'profitability' },
  { code: 'margin_per_procedure', name: 'Margem por procedimento', unit: 'R$', formula: 'receita - custo do procedimento', needUnits: ['procedure'], section: 'profitability' },
  { code: 'occupancy_health', name: 'Ocupação', unit: '%', formula: 'agenda utilizada / disponível' },
  { code: 'material_cost_health', name: 'Custo de materiais', unit: 'R$', formula: 'materiais clínicos' },
  { code: 'personnel_cost_health', name: 'Custo de pessoal', unit: 'R$', formula: 'folha da operação' },
], 1200)

const education = operational(['education'], [
  { code: 'cost_per_student', name: 'Custo por aluno', unit: 'R$/aluno', formula: 'custos / alunos' },
  { code: 'revenue_per_student', name: 'Receita por aluno', unit: 'R$', formula: 'receita / alunos', needUnits: ['student'], section: 'profitability' },
  { code: 'margin_per_student', name: 'Margem por aluno', unit: 'R$', formula: '(receita - custos) / alunos', needUnits: ['student'], section: 'profitability' },
  { code: 'cost_per_class', name: 'Custo por turma', unit: 'R$', formula: 'custos / turmas', needUnits: ['class_group'] },
  { code: 'cost_per_course', name: 'Custo por curso', unit: 'R$', formula: 'custos / cursos', needUnits: ['course'] },
  { code: 'revenue_per_class', name: 'Receita por turma', unit: 'R$', formula: 'receita / turmas', needUnits: ['class_group'], section: 'profitability' },
  { code: 'personnel_cost_edu', name: 'Custo de pessoal', unit: 'R$', formula: 'folha de professores e staff' },
  { code: 'occupancy_edu', name: 'Taxa de ocupação', unit: '%', formula: 'alunos / vagas' },
], 1300)

const realEstate = operational(['real_estate'], [
  { code: 'revenue_per_property', name: 'Receita por imóvel', unit: 'R$', formula: 'receita / imóveis', needUnits: ['property'], section: 'profitability' },
  { code: 'cost_per_property', name: 'Custo por imóvel', unit: 'R$/imóvel', formula: 'custos / imóveis' },
  { code: 'profitability_per_property', name: 'Rentabilidade por imóvel', unit: '%', formula: 'resultado / valor do imóvel', needUnits: ['property'], section: 'profitability' },
  { code: 'occupancy_re', name: 'Taxa de ocupação', unit: '%', formula: 'imóveis ocupados / total' },
  { code: 'vacancy_rate', name: 'Taxa de vacância', unit: '%', formula: 'imóveis vagos / total' },
  { code: 'margin_per_property', name: 'Margem por imóvel', unit: 'R$', formula: 'receita - custos do imóvel', needUnits: ['property'], section: 'profitability' },
  { code: 'roi_property', name: 'Retorno sobre investimento', unit: '%', formula: 'resultado / capital investido', section: 'profitability' },
], 1400)

const automotive = operational(['automotive'], [
  { code: 'cost_per_service', name: 'Custo por serviço realizado', unit: 'R$/serviço realizado', formula: 'custos / serviços' },
  { code: 'revenue_per_service', name: 'Receita por serviço', unit: 'R$', formula: 'receita / serviços', needUnits: ['service'], section: 'profitability' },
  { code: 'margin_per_service', name: 'Margem por serviço', unit: 'R$', formula: 'receita - custo do serviço', needUnits: ['service'], section: 'profitability' },
  { code: 'parts_cost', name: 'Custo de peças', unit: 'R$', formula: 'peças utilizadas' },
  { code: 'auto_avg_ticket', name: 'Ticket médio', unit: 'R$', formula: 'receita / atendimentos' },
  { code: 'productivity_per_employee', name: 'Produtividade por funcionário', unit: 'un', formula: 'serviços / funcionários', needUnits: ['employee'] },
  { code: 'revenue_per_hour_auto', name: 'Receita por hora', unit: 'R$/h', formula: 'receita / horas', needUnits: ['worked_hour'], section: 'profitability' },
  { code: 'parts_turnover', name: 'Giro de estoque', unit: 'x', formula: 'saídas / estoque médio', needAnswer: ['auto_stock', 'yes'] },
], 1500)

const energy = operational(['energy'], [
  { code: 'cost_per_kwh', name: 'Custo por kWh produzido', unit: 'R$/kWh produzido', formula: 'custos / kWh' },
  { code: 'revenue_per_kwh', name: 'Receita por kWh', unit: 'R$/kWh', formula: 'receita / kWh', needUnits: ['kwh'], section: 'profitability' },
  { code: 'energy_production', name: 'Produção', unit: 'kWh', formula: 'energia gerada' },
  { code: 'energy_efficiency', name: 'Eficiência', unit: '%', formula: 'produzido / capacidade' },
  { code: 'maintenance_cost_eng', name: 'Custo de manutenção', unit: 'R$', formula: 'manutenção dos ativos' },
  { code: 'operating_margin_eng', name: 'Margem operacional', unit: '%', formula: 'resultado operacional / receita', section: 'profitability' },
], 1600)

const mining = operational(['mining'], [
  { code: 'cost_per_ton_min', name: 'Custo por tonelada extraída', unit: 'R$/tonelada extraída', formula: 'custos / toneladas' },
  { code: 'cost_per_extracted_unit', name: 'Custo por unidade extraída', unit: 'R$', formula: 'custos / unidades extraídas', needUnits: ['extracted_unit'] },
  { code: 'production_per_equipment', name: 'Produção por equipamento', unit: 'un', formula: 'volume / equipamentos' },
  { code: 'fuel_cost_min', name: 'Custo de combustível', unit: 'R$', formula: 'combustível da operação' },
  { code: 'transport_cost_min', name: 'Custo de transporte', unit: 'R$', formula: 'frete e movimentação' },
  { code: 'margin_per_ton_min', name: 'Margem por tonelada', unit: 'R$/t', formula: '(receita - custos) / toneladas', needUnits: ['ton'], section: 'profitability' },
], 1700)

const hospitality = operational(['hospitality'], [
  { code: 'revenue_per_room', name: 'Receita por quarto', unit: 'R$', formula: 'receita / quartos', needUnits: ['room'], section: 'profitability' },
  { code: 'revenue_per_guest', name: 'Receita por hóspede', unit: 'R$', formula: 'receita / hóspedes', needUnits: ['guest'], section: 'profitability' },
  { code: 'cost_per_room', name: 'Custo por quarto', unit: 'R$', formula: 'custos / quartos', needUnits: ['room'] },
  { code: 'avg_daily_rate', name: 'Diária média', unit: 'R$', formula: 'receita de hospedagem / quartos ocupados' },
  { code: 'cost_per_night', name: 'Custo por diária', unit: 'R$/diária', formula: 'custos / diárias' },
  { code: 'occupancy_hot', name: 'Taxa de ocupação', unit: '%', formula: 'quartos ocupados / quartos disponíveis' },
  { code: 'revpar', name: 'RevPAR', unit: 'R$', formula: 'diária média × ocupação', needUnits: ['room'] },
  { code: 'margin_per_reservation', name: 'Margem por reserva', unit: 'R$', formula: 'receita - custo da reserva', needUnits: ['reservation'], section: 'profitability' },
], 1800)

const beauty = operational(['beauty'], [
  { code: 'cost_per_attendance', name: 'Custo por atendimento', unit: 'R$/atendimento', formula: 'custos / atendimentos' },
  { code: 'revenue_per_attendance', name: 'Receita por atendimento', unit: 'R$', formula: 'receita / atendimentos', needUnits: ['attendance'], section: 'profitability' },
  { code: 'margin_per_service_beau', name: 'Margem por serviço', unit: 'R$', formula: 'preço - custo do serviço', needUnits: ['service'], section: 'profitability' },
  { code: 'revenue_per_professional_beau', name: 'Receita por profissional', unit: 'R$', formula: 'receita / profissionais', needUnits: ['professional'], section: 'profitability' },
  { code: 'agenda_occupancy', name: 'Ocupação da agenda', unit: '%', formula: 'horas ocupadas / horas disponíveis' },
  { code: 'beauty_avg_ticket', name: 'Ticket médio', unit: 'R$', formula: 'receita / atendimentos' },
], 1900)

const media = operational(['media', 'marketing'], [
  { code: 'cost_per_project_media', name: 'Custo por projeto', unit: 'R$/projeto', formula: 'custos / projetos' },
  { code: 'cost_per_client_media', name: 'Custo por cliente', unit: 'R$', formula: 'custos / clientes', needUnits: ['client'] },
  { code: 'revenue_per_client_media', name: 'Receita por cliente', unit: 'R$', formula: 'receita / clientes', needUnits: ['client'], section: 'profitability' },
  { code: 'margin_per_project_media', name: 'Margem por projeto', unit: 'R$', formula: 'receita - custo do projeto', needUnits: ['project'], section: 'profitability' },
  { code: 'cost_per_hour_media', name: 'Custo por hora', unit: 'R$/h', formula: 'custos / horas', needUnits: ['worked_hour'] },
  { code: 'revenue_per_hour_media', name: 'Receita por hora', unit: 'R$/h', formula: 'receita / horas', needUnits: ['worked_hour'], section: 'profitability' },
  { code: 'campaign_roi', name: 'ROI de campanhas', unit: '%', formula: '(retorno - investimento) / investimento', needUnits: ['campaign'] },
  { code: 'cost_per_campaign', name: 'Custo por campanha', unit: 'R$/campanha', formula: 'custos / campanhas' },
], 2000)

const play = operational(['entertainment', 'sports'], [
  { code: 'cost_per_event', name: 'Custo por evento', unit: 'R$/evento', formula: 'custos / eventos' },
  { code: 'cost_per_client_play', name: 'Custo por cliente', unit: 'R$/cliente', formula: 'custos / clientes' },
  { code: 'revenue_per_event', name: 'Receita por evento', unit: 'R$', formula: 'receita / eventos', needUnits: ['event'], section: 'profitability' },
  { code: 'revenue_per_client_play', name: 'Receita por cliente', unit: 'R$', formula: 'receita / clientes', needUnits: ['client'], section: 'profitability' },
  { code: 'margin_per_event', name: 'Margem por evento', unit: 'R$', formula: 'receita - custo do evento', needUnits: ['event'], section: 'profitability' },
  { code: 'occupancy_play', name: 'Taxa de ocupação', unit: '%', formula: 'ocupação / capacidade' },
], 2100)

const environment = operational(['environment'], [
  { code: 'cost_per_ton_env', name: 'Custo por tonelada processada', unit: 'R$/tonelada processada', formula: 'custos / toneladas' },
  { code: 'cost_per_project_env', name: 'Custo por projeto', unit: 'R$', formula: 'custos / projetos', needUnits: ['project'] },
  { code: 'cost_per_client_env', name: 'Custo por cliente', unit: 'R$', formula: 'custos / clientes', needUnits: ['client'] },
  { code: 'revenue_per_project_env', name: 'Receita por projeto', unit: 'R$', formula: 'receita / projetos', needUnits: ['project'], section: 'profitability' },
  { code: 'margin_per_project_env', name: 'Margem por projeto', unit: 'R$', formula: 'receita - custo do projeto', needUnits: ['project'], section: 'profitability' },
  { code: 'operational_productivity_env', name: 'Produtividade operacional', unit: 'un', formula: 'volume processado / recurso' },
], 2200)

const fishing = operational(['fishing'], [
  { code: 'cost_per_kg_fish', name: 'Custo por kg produzido', unit: 'R$/kg produzido', formula: 'custos / kg produzidos' },
  { code: 'cost_per_ton_fish', name: 'Custo por tonelada', unit: 'R$/t', formula: 'custos / toneladas', needUnits: ['ton'] },
  { code: 'feed_conversion', name: 'Conversão alimentar', unit: 'x', formula: 'ração / biomassa produzida', needAnswer: ['fish_feed', 'yes'] },
  { code: 'margin_per_ton_fish', name: 'Margem por tonelada', unit: 'R$/t', formula: '(receita - custos) / toneladas', needUnits: ['ton'], section: 'profitability' },
], 2300)

const financialServices = operational(['financial'], [
  { code: 'cost_per_operation', name: 'Custo por operação', unit: 'R$/operação', formula: 'custos / operações' },
  { code: 'cost_per_client_fin', name: 'Custo por cliente', unit: 'R$', formula: 'custos / clientes', needUnits: ['client'] },
  { code: 'revenue_per_contract_fin', name: 'Receita por contrato', unit: 'R$', formula: 'receita / contratos', needUnits: ['contract'], section: 'profitability' },
  { code: 'margin_per_contract_fin', name: 'Margem por contrato', unit: '%', formula: 'margem / receita do contrato', needUnits: ['contract'], section: 'profitability' },
], 2400)

const publicAdmin = operational(['public_admin'], [
  { code: 'budget_execution_pub', name: 'Execução orçamentária', unit: '%', formula: 'realizado / orçado', section: 'budget_vs_actual' },
  { code: 'cost_per_service_pub', name: 'Custo por serviço realizado', unit: 'R$/serviço realizado', formula: 'custos / serviços' },
  { code: 'cost_per_unit_pub', name: 'Custo por unidade administrativa', unit: 'R$', formula: 'custos / unidades' },
], 2500)

const other = operational(['other'], [
  { code: 'cost_per_operation_unit', name: 'Custo por unidade de operação', unit: 'R$/unidade de operação', formula: 'custos / unidades de operação' },
], 2600)

export const INDICATORS: IndicatorDef[] = [
  ...financial,
  ...strategic,
  ...agro,
  ...livestock,
  ...fishing,
  ...commerce,
  ...industry,
  ...construction,
  ...transport,
  ...food,
  ...services,
  ...tech,
  ...health,
  ...education,
  ...realEstate,
  ...automotive,
  ...energy,
  ...mining,
  ...hospitality,
  ...beauty,
  ...media,
  ...play,
  ...environment,
  ...financialServices,
  ...publicAdmin,
  ...other,
  ...REVENUE_MODEL_INDICATORS,
  ...OPERATION_MODEL_INDICATORS,
]
