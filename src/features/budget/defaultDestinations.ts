import type { MoneyGroup } from './model.ts'
import { parseRevenueModelValues } from '../experience/catalog/revenueModels.ts'
import { resolveProductLabels } from '../experience/catalog/sectorProducts.ts'

export interface BudgetDestinationContext {
  segmentCode: string | null | undefined
  extraSegmentCodes?: string[]
  revenueModel?: string | null
  operationModel?: string | null
  primaryActivity?: string | null
  customSegment?: string | null
  employeeCount?: number | null
  profileFacts?: Record<string, unknown>
  /** Centros de custo da empresa — únicos destinos de custos e despesas. */
  costCenterNames?: string[]
}

const BASE_INVESTMENTS = [
  'Máquinas e equipamentos',
  'Veículos',
  'Tecnologia e sistemas',
  'Estrutura e reformas',
  'Imóveis',
] as const

type FactBag = string | string[] | boolean | number | null | undefined

function asList(value: FactBag): string[] {
  if (value == null || value === false) return []
  if (value === true) return []
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => asList(String(item)))
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (typeof value === 'number') return []
  return String(value)
    .split(/[\n,;/|]+|(?:\s+e\s+)|(?:\s+and\s+)/i)
    .map((item) => item.trim())
    .filter((item) => item.length > 1)
}

function fact(facts: Record<string, unknown>, key: string): FactBag {
  return facts[key] as FactBag
}

function yes(facts: Record<string, unknown>, key: string): boolean {
  const value = facts[key]
  if (value === true) return true
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'sim' || normalized === 'yes' || normalized === 'true'
  }
  if (Array.isArray(value)) {
    return value.some((item) => {
      const normalized = String(item).trim().toLowerCase()
      return normalized === 'sim' || normalized === 'yes' || normalized === 'true'
    })
  }
  return false
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    const key = name.toLocaleLowerCase('pt-BR')
    if (seen.has(key)) continue
    seen.add(key)
    result.push(name)
  }
  return result
}

function humanizeFactLabel(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (/[A-ZÀ-Ú ]/.test(trimmed) && !trimmed.includes('_')) {
    return trimmed.charAt(0).toLocaleUpperCase('pt-BR') + trimmed.slice(1)
  }
  const known: Record<string, string> = {
    soja: 'Soja',
    milho: 'Milho',
    algodao: 'Algodão',
    cafe: 'Café',
    cana_de_acucar: 'Cana-de-açúcar',
    trigo: 'Trigo',
    arroz: 'Arroz',
    hortalicas: 'Hortaliças',
    sementes: 'Sementes',
    fertilizantes: 'Fertilizantes',
    defensivos: 'Defensivos',
    combustivel: 'Combustível',
    mao_de_obra: 'Mão de obra',
    propria: 'Própria',
    arrendada: 'Arrendada',
    corte: 'Corte',
    leite: 'Leite',
    tilapia: 'Tilápia',
    tambaqui: 'Tambaqui',
    camarao: 'Camarão',
    peixes_nativos: 'Peixes nativos',
    fisica: 'Loja física',
    ecommerce: 'E-commerce',
    marketplace: 'Marketplace',
    saas: 'SaaS',
    software_sob_demanda: 'Software sob demanda',
    consultoria_de_ti: 'Consultoria de TI',
    produto_digital: 'Produto digital',
    produtos: 'Produtos',
    servicos: 'Serviços',
    projetos: 'Projetos',
    hibrido: 'Híbrido',
    compra_e_venda: 'Compra e venda',
    aluguel: 'Aluguel',
    administracao_predial: 'Administração predial',
    manutencao: 'Manutenção',
    funilaria: 'Funilaria',
    estetica: 'Estética',
    venda_de_pecas: 'Venda de peças',
    venda_de_veiculos: 'Venda de veículos',
    caminhao: 'Caminhão',
    van: 'Van',
    carreta: 'Carreta',
    utilitario: 'Utilitário',
    restaurante: 'Restaurante',
    eventos: 'Eventos',
    spa: 'Spa',
    transfers: 'Transfers',
    nenhum: 'Nenhum',
    cabelo: 'Cabelo',
    unhas: 'Unhas',
    barbearia: 'Barbearia',
  }
  const key = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  if (known[key]) return known[key]
  return trimmed
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1))
    .join(' ')
}

function factIncludes(values: string[], ...needles: string[]): boolean {
  const normalized = values.map((value) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
  )
  return needles.some((needle) => normalized.includes(needle))
}


/** Lista de produtos/serviços informados no cadastro (texto livre ou opções). */
export function productsFromFacts(facts: Record<string, unknown>): string[] {
  const keys = [
    'products_offered',
    'products_other_matches',
    'products_other_describe',
    'products_sold',
    'manufactured_products',
    'service_type',
    'crops',
    'species',
    'mineral_type',
    'other_activity',
    'auto_services',
    'beauty_services',
    'main_products',
    'sold_products',
    'tech_products',
    'food_products',
    'media_products',
  ]
  const names: string[] = []
  for (const key of keys) {
    for (const item of asList(fact(facts, key))) {
      const lower = item.toLowerCase()
      if (lower === 'outra' || lower === 'outro' || lower === 'outros') continue
      names.push(humanizeProductFact(item))
    }
  }
  return uniqueNames(names)
}

function humanizeProductFact(value: string): string {
  // Códigos da busca inteligente: "commerce:vestuario" → "Vestuário e calçados"
  if (value.includes(':')) {
    const [label] = resolveProductLabels([value])
    if (label && label !== value) return label
  }
  return humanizeFactLabel(value)
}

function revenueFromModels(models: string[]): string[] {
  const names: string[] = []
  for (const model of models) {
    switch (model) {
      case 'venda_de_produtos':
        names.push('Venda de produtos')
        break
      case 'prestacao_de_servicos':
        names.push('Prestação de serviços')
        break
      case 'receita_recorrente':
        names.push('Receita recorrente / assinaturas')
        break
      case 'contratos':
        names.push('Receita de contratos')
        break
      case 'producao_e_comercializacao':
        names.push('Venda de produção')
        break
      case 'ecommerce_e_marketplace':
        names.push('Vendas online / marketplace')
        break
      case 'locacao_e_aluguel':
        names.push('Locação e aluguel')
        break
      case 'comissao_e_intermediacao':
        names.push('Comissões e intermediação')
        break
      case 'licenciamento_e_royalties':
        names.push('Licenciamento e royalties')
        break
      case 'publicidade_e_midia':
        names.push('Publicidade e mídia')
        break
      case 'eventos_e_ingressos':
        names.push('Eventos e ingressos')
        break
      case 'franquias':
        names.push('Receita de franquias')
        break
      case 'revenda_e_distribuicao':
        names.push('Revenda e distribuição')
        break
      case 'mista':
        names.push('Receitas operacionais')
        break
      default:
        break
    }
  }
  return names
}

function segmentRevenue(segmentCode: string, facts: Record<string, unknown>): string[] {
  const offered = productsFromFacts(facts)
  switch (segmentCode) {
    case 'agro': {
      const crops = asList(fact(facts, 'crops'))
      if (crops.length > 0) {
        return crops.map((crop) => `Venda de ${humanizeFactLabel(crop)}`)
      }
      if (offered.length > 0) return offered.map((item) => `Venda de ${item}`)
      return ['Venda de produção agrícola']
    }
    case 'livestock': {
      const kinds = asList(fact(facts, 'livestock_kind'))
      if (factIncludes(kinds, 'leite')) return ['Venda de leite', 'Venda de animais']
      if (factIncludes(kinds, 'corte')) return ['Venda de animais']
      if (offered.length > 0) return offered.map((item) => `Venda de ${item}`)
      return ['Venda de animais', 'Venda de produção pecuária']
    }
    case 'fishing': {
      const species = asList(fact(facts, 'species'))
      if (species.length > 0) {
        return species.map((item) => `Venda de ${humanizeFactLabel(item)}`)
      }
      if (offered.length > 0) return offered.map((item) => `Venda de ${item}`)
      return ['Venda de produção aquícola']
    }
    case 'commerce': {
      if (offered.length > 0) {
        return offered.map((item) => `Venda de ${item}`)
      }
      return ['Vendas de mercadorias']
    }
    case 'industry': {
      if (offered.length > 0) {
        return offered.map((item) => `Venda de ${item}`)
      }
      return ['Venda de produtos fabricados']
    }
    case 'construction': {
      const works = asList(fact(facts, 'work_type'))
      if (works.length > 0) {
        return works.map((item) => `Obras · ${humanizeFactLabel(item)}`)
      }
      if (offered.length > 0) return offered
      return ['Receita de contratos de obra']
    }
    case 'transport_logistics':
      if (offered.length > 0) return offered
      return ['Fretes prestados']
    case 'food': {
      const names: string[] = []
      const foodType = asList(fact(facts, 'food_type'))
      for (const item of foodType) {
        if (!factIncludes([item], 'outro')) names.push(humanizeFactLabel(item))
      }
      for (const item of offered) names.push(`Venda de ${item}`)
      if (names.length === 0) names.push('Vendas de alimentos')
      if (yes(facts, 'has_delivery')) names.push('Delivery')
      return names
    }
    case 'services': {
      if (offered.length > 0) {
        return offered.map((item) => `Serviços · ${item}`)
      }
      return ['Receita de serviços']
    }
    case 'tech': {
      const names: string[] = []
      const delivery = asList(fact(facts, 'delivery_model'))
      if (factIncludes(delivery, 'saas') || yes(facts, 'has_recurring_revenue')) {
        names.push('Receita recorrente')
      }
      if (factIncludes(delivery, 'projetos', 'hibrido')) {
        names.push('Receita de projetos')
      }
      for (const item of offered) names.push(`Venda de ${item}`)
      const offer = asList(fact(facts, 'offer_type'))
      if (factIncludes(offer, 'produtos') && offered.length === 0) {
        names.push('Venda de produtos digitais')
      }
      if (factIncludes(offer, 'servicos')) names.push('Prestação de serviços de TI')
      return names.length > 0 ? names : ['Receita de software e serviços']
    }
    case 'health': {
      const types = asList(fact(facts, 'health_type'))
      if (types.length > 0) {
        return [
          ...types.map((item) => `Atendimento · ${humanizeFactLabel(item)}`),
          'Receita de procedimentos',
        ]
      }
      return ['Receita de consultas', 'Receita de procedimentos']
    }
    case 'education': {
      const types = asList(fact(facts, 'education_type'))
      if (types.length > 0) {
        return types.map((item) => `Mensalidades · ${humanizeFactLabel(item)}`)
      }
      return ['Mensalidades']
    }
    case 'real_estate': {
      const model = asList(fact(facts, 'real_estate_model'))
      if (factIncludes(model, 'aluguel')) return ['Receita de aluguel']
      if (factIncludes(model, 'compra_e_venda')) return ['Receita de venda de imóveis']
      if (factIncludes(model, 'administracao_predial')) return ['Administração predial']
      return ['Receita de aluguel', 'Receita de venda']
    }
    case 'automotive': {
      const services = asList(fact(facts, 'auto_services'))
      const names: string[] = []
      for (const service of services) {
        if (factIncludes([service], 'venda_de_veiculos')) {
          names.push('Venda de veículos')
        } else if (factIncludes([service], 'venda_de_pecas')) {
          names.push('Venda de peças')
        } else {
          names.push(`Serviços · ${humanizeFactLabel(service)}`)
        }
      }
      return names.length > 0 ? names : ['Receita de serviços automotivos', 'Venda de peças']
    }
    case 'energy':
      return ['Receita de geração / operação']
    case 'mining': {
      const mineral = asList(fact(facts, 'mineral_type'))[0]
      return [mineral ? `Receita de ${humanizeFactLabel(mineral)}` : 'Receita de minério']
    }
    case 'hospitality': {
      const names = ['Diárias']
      const extras = asList(fact(facts, 'extra_services'))
      for (const extra of extras) {
        if (factIncludes([extra], 'nenhum')) continue
        names.push(humanizeFactLabel(extra))
      }
      return names
    }
    case 'beauty': {
      const services = asList(fact(facts, 'beauty_services'))
      if (services.length > 0) {
        return services.map((item) => `Serviços · ${humanizeFactLabel(item)}`)
      }
      return ['Receita de serviços de beleza']
    }
    case 'media':
      return ['Receita de projetos de mídia']
    case 'marketing':
      return yes(facts, 'has_recurring_contracts')
        ? ['Honorários recorrentes', 'Projetos pontuais']
        : ['Receita de honorários']
    case 'entertainment':
      return ['Bilheteria', 'Eventos']
    case 'sports': {
      const names = ['Mensalidades e tickets']
      if (yes(facts, 'has_events')) names.push('Eventos')
      return names
    }
    case 'environment':
      return ['Receita de projetos ambientais']
    case 'financial': {
      const type = asList(fact(facts, 'financial_type'))[0]
      return [
        type
          ? `Serviços financeiros · ${humanizeFactLabel(type)}`
          : 'Receita de serviços financeiros',
      ]
    }
    case 'professional': {
      const type = asList(fact(facts, 'professional_type'))[0]
      return [
        type ? `Honorários · ${humanizeFactLabel(type)}` : 'Receita de honorários',
      ]
    }
    case 'public_admin':
      return ['Receitas orçamentárias']
    case 'other': {
      const activity = asList(fact(facts, 'other_activity'))[0]
      return [activity ? humanizeFactLabel(activity) : 'Receitas operacionais']
    }
    default:
      return []
  }
}

function segmentInvestments(
  segmentCode: string,
  facts: Record<string, unknown>
): string[] {
  const extra: string[] = []
  switch (segmentCode) {
    case 'agro':
      if (yes(facts, 'own_machinery')) extra.push('Maquinário agrícola')
      extra.push('Implementos e estrutura rural')
      break
    case 'livestock':
      extra.push('Instalações pecuárias', 'Rebanho / genética')
      break
    case 'fishing':
      extra.push('Tanques e equipamentos aquículas')
      break
    case 'transport_logistics':
      extra.push('Aquisição de frota')
      break
    case 'construction':
      extra.push('Equipamentos de obra')
      break
    case 'tech':
      extra.push('Infraestrutura e cloud', 'Desenvolvimento de produto')
      break
    case 'energy':
      extra.push('Usinas e equipamentos de geração')
      break
    case 'mining':
      extra.push('Equipamentos de extração')
      break
    case 'hospitality':
      extra.push('Reforma de unidades', 'Mobiliário')
      break
    case 'real_estate':
      extra.push('Aquisição de imóveis')
      break
    case 'industry':
      extra.push('Linha de produção')
      break
    default:
      break
  }
  return extra
}

/**
 * Gera destinos para os 4 grupos do orçamento.
 * Receitas e investimentos: sugestões editáveis a partir do cadastro.
 * Custos e despesas: apenas os centros de custo definidos pelo usuário
 * (o sistema não inventa destinos nesses grupos).
 */
export function suggestBudgetDestinations(
  context: BudgetDestinationContext
): Record<MoneyGroup, string[]> {
  const facts = context.profileFacts ?? {}
  const segmentCode = (context.segmentCode || 'other').trim() || 'other'
  const extraSegments = (context.extraSegmentCodes ?? []).filter(
    (code) => code && code !== segmentCode
  )
  const revenueModels = parseRevenueModelValues(context.revenueModel)

  const soldProducts = productsFromFacts(facts)
  const productRevenues = soldProducts.map((item) => {
    const lower = item.toLocaleLowerCase('pt-BR')
    if (lower.startsWith('venda de ') || lower.startsWith('serviços') || lower.startsWith('servicos')) {
      return item
    }
    if (segmentCode === 'services' || segmentCode === 'professional' || segmentCode === 'beauty') {
      return `Serviços · ${item}`
    }
    return `Venda de ${item}`
  })

  const revenue = uniqueNames([
    ...revenueFromModels(revenueModels),
    ...segmentRevenue(segmentCode, facts),
    ...productRevenues,
    ...extraSegments.flatMap((code) => segmentRevenue(code, facts)),
    context.primaryActivity?.trim()
      ? `Receita · ${humanizeFactLabel(context.primaryActivity)}`
      : '',
  ])

  const costCenters = uniqueNames(context.costCenterNames ?? [])

  const investment = uniqueNames([
    ...BASE_INVESTMENTS,
    ...segmentInvestments(segmentCode, facts),
    ...extraSegments.flatMap((code) => segmentInvestments(code, facts)),
  ])

  return {
    revenue: revenue.length > 0 ? revenue : ['Receitas operacionais'],
    cost: costCenters,
    expense: costCenters,
    investment,
  }
}

export function normalizeDestinationName(value: string): string {
  return value.trim().toLocaleUpperCase('pt-BR')
}
