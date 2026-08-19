import { structure } from './helpers'
import type { StructureTemplate } from '../types'

const generic: StructureTemplate = structure({
  extraCostCenters: ['Pessoal', 'Serviços de terceiros', 'Estrutura'],
  extraCategories: [
    { name: 'Pessoal', type: 'expense' },
    { name: 'Serviços de terceiros', type: 'expense' },
  ],
  oxrDimensions: ['departamento', 'centro de custo'],
  defaultUnitCodes: ['operation_unit'],
})

export const STRUCTURES: Record<string, StructureTemplate> = {
  agro: structure({
    extraDepartments: ['Produção agrícola'],
    extraCostCenters: ['Insumos', 'Maquinário', 'Arrendamento', 'Serviços de terceiros'],
    extraCategories: [
      { name: 'Insumos agrícolas', type: 'cost' },
      { name: 'Arrendamento', type: 'cost' },
      { name: 'Maquinário e manutenção', type: 'cost' },
      { name: 'Venda de produção', type: 'revenue' },
    ],
    oxrDimensions: ['cultura', 'hectare', 'saca'],
    defaultUnitCodes: ['hectare'],
  }),
  livestock: structure({
    extraDepartments: ['Produção pecuária'],
    extraCostCenters: ['Alimentação', 'Medicamentos', 'Pastagem', 'Reprodução', 'Compra de animais'],
    extraCategories: [
      { name: 'Alimentação animal', type: 'cost' },
      { name: 'Medicamentos', type: 'cost' },
      { name: 'Pastagem', type: 'cost' },
      { name: 'Compra de animais', type: 'cost' },
      { name: 'Venda de animais', type: 'revenue' },
    ],
    oxrDimensions: ['animal', 'lote', 'arroba'],
    defaultUnitCodes: ['head'],
  }),
  fishing: structure({
    extraCostCenters: ['Ração', 'Alevinos', 'Energia', 'Mão de obra'],
    extraCategories: [
      { name: 'Ração', type: 'cost' },
      { name: 'Venda de produção', type: 'revenue' },
    ],
    oxrDimensions: ['espécie', 'tonelada'],
    defaultUnitCodes: ['kg'],
  }),
  commerce: structure({
    extraCostCenters: ['CMV'],
    extraCategories: [
      { name: 'CMV', type: 'cost' },
      { name: 'Vendas de mercadorias', type: 'revenue' },
    ],
    oxrDimensions: ['categoria', 'produto', 'canal'],
    defaultUnitCodes: ['sold_unit'],
  }),
  industry: structure({
    extraDepartments: ['Produção'],
    extraCostCenters: ['Matéria-prima', 'Mão de obra direta', 'Custos indiretos', 'Manutenção'],
    extraCategories: [
      { name: 'Matéria-prima', type: 'cost' },
      { name: 'Mão de obra direta', type: 'cost' },
      { name: 'Custos indiretos de fabricação', type: 'cost' },
      { name: 'Venda de produtos fabricados', type: 'revenue' },
    ],
    oxrDimensions: ['produto', 'lote', 'produção'],
    defaultUnitCodes: ['produced_unit'],
  }),
  construction: structure({
    extraDepartments: ['Obras'],
    extraCostCenters: ['Materiais', 'Mão de obra', 'Terceirizados', 'Equipamentos'],
    extraCategories: [
      { name: 'Materiais de obra', type: 'cost' },
      { name: 'Mão de obra da obra', type: 'cost' },
      { name: 'Terceirizados', type: 'cost' },
      { name: 'Receita de contratos', type: 'revenue' },
    ],
    oxrDimensions: ['obra', 'm²', 'etapa'],
    defaultUnitCodes: ['sqm'],
  }),
  transport_logistics: structure({
    extraDepartments: ['Frota'],
    extraCostCenters: ['Combustível', 'Manutenção', 'Pedágios', 'Motoristas'],
    extraCategories: [
      { name: 'Combustível', type: 'cost' },
      { name: 'Manutenção da frota', type: 'cost' },
      { name: 'Pedágios', type: 'cost' },
      { name: 'Fretes prestados', type: 'revenue' },
    ],
    oxrDimensions: ['veículo', 'viagem', 'km'],
    defaultUnitCodes: ['km'],
  }),
  food: structure({
    extraDepartments: ['Cozinha'],
    extraCostCenters: ['Ingredientes', 'Embalagem', 'Delivery', 'Desperdício'],
    extraCategories: [
      { name: 'CMV alimentos', type: 'cost' },
      { name: 'Embalagem', type: 'cost' },
      { name: 'Taxas de delivery', type: 'expense' },
      { name: 'Vendas de alimentos', type: 'revenue' },
    ],
    oxrDimensions: ['produto', 'pedido', 'unidade'],
    defaultUnitCodes: ['meal'],
  }),
  services: structure({
    extraCostCenters: ['Projetos', 'Clientes', 'Terceirizados'],
    extraCategories: [
      { name: 'Custo de projetos', type: 'cost' },
      { name: 'Receita de serviços', type: 'revenue' },
    ],
    oxrDimensions: ['cliente', 'projeto', 'contrato'],
    defaultUnitCodes: ['worked_hour'],
  }),
  tech: structure({
    extraCostCenters: ['Infraestrutura', 'Pessoal técnico', 'Aquisição de clientes'],
    extraCategories: [
      { name: 'Infraestrutura de TI', type: 'cost' },
      { name: 'Receita recorrente', type: 'revenue' },
      { name: 'Receita de projetos', type: 'revenue' },
    ],
    oxrDimensions: ['cliente', 'projeto', 'produto'],
    defaultUnitCodes: ['project', 'worked_hour'],
  }),
  health: structure({
    extraCostCenters: ['Materiais clínicos', 'Medicamentos', 'Profissionais'],
    extraCategories: [
      { name: 'Materiais e medicamentos', type: 'cost' },
      { name: 'Receita de consultas', type: 'revenue' },
      { name: 'Receita de procedimentos', type: 'revenue' },
    ],
    oxrDimensions: ['consulta', 'procedimento', 'profissional'],
    defaultUnitCodes: ['attendance'],
  }),
  education: structure({
    extraCostCenters: ['Professores', 'Turmas', 'Material didático'],
    extraCategories: [
      { name: 'Pessoal docente', type: 'expense' },
      { name: 'Mensalidades', type: 'revenue' },
    ],
    oxrDimensions: ['curso', 'turma', 'aluno'],
    defaultUnitCodes: ['student'],
  }),
  real_estate: structure({
    extraCostCenters: ['Manutenção', 'Condomínio', 'Impostos', 'Vacância'],
    extraCategories: [
      { name: 'Manutenção de imóveis', type: 'cost' },
      { name: 'Receita de aluguel', type: 'revenue' },
      { name: 'Receita de venda', type: 'revenue' },
    ],
    oxrDimensions: ['imóvel', 'contrato'],
    defaultUnitCodes: ['property'],
  }),
  automotive: structure({
    extraCostCenters: ['Peças', 'Serviços', 'Mão de obra'],
    extraCategories: [
      { name: 'Peças', type: 'cost' },
      { name: 'Receita de serviços', type: 'revenue' },
      { name: 'Receita de peças', type: 'revenue' },
    ],
    oxrDimensions: ['serviço', 'produto'],
    defaultUnitCodes: ['service'],
  }),
  energy: structure({
    extraCostCenters: ['Manutenção', 'Equipamentos', 'Operação'],
    extraCategories: [
      { name: 'Custos operacionais de energia', type: 'cost' },
      { name: 'Receita de geração', type: 'revenue' },
    ],
    oxrDimensions: ['unidade', 'kWh'],
    defaultUnitCodes: ['kwh'],
  }),
  mining: structure({
    extraCostCenters: ['Extração', 'Beneficiamento', 'Transporte', 'Combustível'],
    extraCategories: [
      { name: 'Custo de extração', type: 'cost' },
      { name: 'Transporte mineral', type: 'cost' },
      { name: 'Receita de minério', type: 'revenue' },
    ],
    oxrDimensions: ['tonelada', 'localidade'],
    defaultUnitCodes: ['ton'],
  }),
  hospitality: structure({
    extraCostCenters: ['Hospedagem', 'Alimentos e bebidas', 'Comissões de plataformas'],
    extraCategories: [
      { name: 'Custos de hospedagem', type: 'cost' },
      { name: 'Comissões de plataformas', type: 'expense' },
      { name: 'Diárias', type: 'revenue' },
    ],
    oxrDimensions: ['quarto', 'reserva'],
    defaultUnitCodes: ['night'],
  }),
  beauty: structure({
    extraCostCenters: ['Produtos', 'Comissões', 'Profissionais'],
    extraCategories: [
      { name: 'Produtos de beleza', type: 'cost' },
      { name: 'Comissões de profissionais', type: 'expense' },
      { name: 'Receita de serviços', type: 'revenue' },
    ],
    oxrDimensions: ['serviço', 'profissional'],
    defaultUnitCodes: ['attendance'],
  }),
  media: structure({
    extraCostCenters: ['Projetos', 'Mídia', 'Terceirizados'],
    extraCategories: [
      { name: 'Investimento em mídia', type: 'cost' },
      { name: 'Receita de projetos', type: 'revenue' },
    ],
    oxrDimensions: ['cliente', 'projeto', 'campanha'],
    defaultUnitCodes: ['campaign'],
  }),
  marketing: structure({
    extraCostCenters: ['Campanhas', 'Mídia', 'Atendimento'],
    extraCategories: [
      { name: 'Mídia e produção', type: 'cost' },
      { name: 'Receita de honorários', type: 'revenue' },
    ],
    oxrDimensions: ['cliente', 'campanha'],
    defaultUnitCodes: ['project'],
  }),
  entertainment: structure({
    extraCostCenters: ['Eventos', 'Estrutura', 'Produção'],
    extraCategories: [
      { name: 'Custo de eventos', type: 'cost' },
      { name: 'Bilheteria', type: 'revenue' },
    ],
    oxrDimensions: ['evento', 'cliente'],
    defaultUnitCodes: ['event'],
  }),
  sports: structure({
    extraCostCenters: ['Estrutura', 'Eventos', 'Professores'],
    extraCategories: [
      { name: 'Custo da estrutura', type: 'cost' },
      { name: 'Mensalidades e tickets', type: 'revenue' },
    ],
    oxrDimensions: ['cliente', 'evento'],
    defaultUnitCodes: ['client'],
  }),
  environment: structure({
    extraCostCenters: ['Operação', 'Equipamentos', 'Destinação'],
    extraCategories: [
      { name: 'Custos operacionais ambientais', type: 'cost' },
      { name: 'Receita de projetos ambientais', type: 'revenue' },
    ],
    oxrDimensions: ['projeto', 'tonelada'],
    defaultUnitCodes: ['ton'],
  }),
  financial: structure({
    extraCostCenters: ['Operação', 'Comissões'],
    extraCategories: [{ name: 'Receita de serviços financeiros', type: 'revenue' }],
    oxrDimensions: ['cliente', 'contrato'],
    defaultUnitCodes: ['operation'],
  }),
  professional: structure({
    extraCostCenters: ['Projetos', 'Horas', 'Terceirizados'],
    extraCategories: [{ name: 'Receita de honorários', type: 'revenue' }],
    oxrDimensions: ['cliente', 'projeto', 'hora'],
    defaultUnitCodes: ['worked_hour'],
  }),
  public_admin: structure({
    extraCostCenters: ['Unidades', 'Pessoal', 'Custeio'],
    extraCategories: [
      { name: 'Custeio', type: 'expense' },
      { name: 'Receitas orçamentárias', type: 'revenue' },
    ],
    oxrDimensions: ['unidade', 'programa'],
    defaultUnitCodes: ['public_service'],
  }),
  other: generic,
}

export function structureFor(segmentCode: string): StructureTemplate {
  return STRUCTURES[segmentCode] ?? generic
}
