import type { SegmentCode } from '@/features/company/segmentOptions'

export interface SectorProductOption {
  code: string
  name: string
  description?: string | null
  segmentCode: SegmentCode | string
  sourceCode?: string | null
  rankScore?: number
}

type ProductSeed = {
  code: string
  name: string
  description?: string
  sourceCode?: string
}

function products(segment: SegmentCode, items: ProductSeed[]): SectorProductOption[] {
  return items.map((item) => ({
    code: item.code,
    name: item.name,
    description: item.description ?? null,
    segmentCode: segment,
    sourceCode: item.sourceCode ?? null,
  }))
}

/** Catálogo local espelhando o seed SQL — fallback sem RPC / testes. */
export const SECTOR_PRODUCT_CATALOG: SectorProductOption[] = [
  ...products('agro', [
    { code: 'soja', name: 'Soja', sourceCode: 'conab' },
    { code: 'milho', name: 'Milho', sourceCode: 'conab' },
    { code: 'cafe', name: 'Café', sourceCode: 'cepea' },
    { code: 'cana', name: 'Cana-de-açúcar', sourceCode: 'conab' },
    { code: 'algodao', name: 'Algodão', sourceCode: 'conab' },
    { code: 'trigo', name: 'Trigo', sourceCode: 'conab' },
    { code: 'hortalicas', name: 'Hortaliças', sourceCode: 'embrapa' },
    { code: 'frutas', name: 'Frutas', sourceCode: 'embrapa' },
  ]),
  ...products('livestock', [
    { code: 'bovinos_corte', name: 'Bovinos de corte', sourceCode: 'cna_brasil' },
    { code: 'leite', name: 'Leite', sourceCode: 'cepea' },
    { code: 'aves', name: 'Aves / frango', sourceCode: 'embrapa' },
    { code: 'suinos', name: 'Suínos', sourceCode: 'embrapa' },
    { code: 'ovos', name: 'Ovos', sourceCode: 'embrapa' },
    { code: 'ovinos', name: 'Ovinos / caprinos', sourceCode: 'cna_brasil' },
  ]),
  ...products('fishing', [
    { code: 'tilapia', name: 'Tilápia', sourceCode: 'peixe_br' },
    { code: 'tambaqui', name: 'Tambaqui', sourceCode: 'peixe_br' },
    { code: 'camarao', name: 'Camarão', sourceCode: 'peixe_br' },
    { code: 'peixes_nativos', name: 'Peixes nativos', sourceCode: 'embrapa' },
    { code: 'pescado_fresco', name: 'Pescado fresco', sourceCode: 'ibge' },
  ]),
  ...products('commerce', [
    { code: 'alimentos_bebidas', name: 'Alimentos e bebidas', sourceCode: 'sebrae_intel' },
    { code: 'vestuario', name: 'Vestuário e calçados', sourceCode: 'sebrae_intel' },
    { code: 'eletronicos', name: 'Eletrônicos e informática', sourceCode: 'ibge' },
    { code: 'material_construcao', name: 'Material de construção', sourceCode: 'ibge' },
    { code: 'farmacia', name: 'Farmácia e higiene', sourceCode: 'sebrae_intel' },
    { code: 'casa_decoracao', name: 'Casa e decoração', sourceCode: 'sebrae' },
    { code: 'autopecas', name: 'Autopeças', sourceCode: 'mapa_empresas' },
    { code: 'atacado_geral', name: 'Atacado / distribuição', sourceCode: 'ibge' },
  ]),
  ...products('industry', [
    { code: 'alimentos_ind', name: 'Alimentos industrializados', sourceCode: 'cni' },
    { code: 'metalurgicos', name: 'Produtos metalúrgicos', sourceCode: 'cni' },
    { code: 'quimicos', name: 'Produtos químicos', sourceCode: 'cni' },
    { code: 'texteis', name: 'Produtos têxteis', sourceCode: 'cni' },
    { code: 'moveis', name: 'Móveis', sourceCode: 'ibge' },
    { code: 'embalagens', name: 'Embalagens', sourceCode: 'cni' },
    { code: 'maquinas', name: 'Máquinas e equipamentos', sourceCode: 'cni' },
  ]),
  ...products('construction', [
    { code: 'obras_residenciais', name: 'Obras residenciais', sourceCode: 'cbic' },
    { code: 'obras_comerciais', name: 'Obras comerciais', sourceCode: 'cbic' },
    { code: 'infraestrutura', name: 'Infraestrutura', sourceCode: 'cbic' },
    { code: 'reformas', name: 'Reformas e retrofit', sourceCode: 'sebrae' },
    { code: 'incorporacao', name: 'Incorporação imobiliária', sourceCode: 'cbic' },
  ]),
  ...products('services', [
    { code: 'consultoria', name: 'Consultoria', sourceCode: 'sebrae' },
    { code: 'manutencao', name: 'Manutenção e reparos', sourceCode: 'ibge' },
    { code: 'instalacao', name: 'Instalação técnica', sourceCode: 'sebrae' },
    { code: 'limpeza', name: 'Limpeza e facilities', sourceCode: 'sebrae' },
    { code: 'seguranca', name: 'Segurança patrimonial', sourceCode: 'ibge' },
    { code: 'suporte_b2b', name: 'Suporte B2B', sourceCode: 'sebrae' },
  ]),
  ...products('tech', [
    { code: 'saas', name: 'SaaS / software assinatura', sourceCode: 'brasscom' },
    { code: 'software_sob_demanda', name: 'Software sob demanda', sourceCode: 'abes' },
    { code: 'app_mobile', name: 'Aplicativo mobile', sourceCode: 'abes' },
    { code: 'consultoria_ti', name: 'Consultoria de TI', sourceCode: 'brasscom' },
    { code: 'infra_cloud', name: 'Infraestrutura / cloud', sourceCode: 'brasscom' },
    { code: 'dados_ia', name: 'Dados e IA', sourceCode: 'abes' },
    { code: 'suporte_ti', name: 'Suporte e MSP', sourceCode: 'brasscom' },
  ]),
  ...products('transport_logistics', [
    { code: 'frete_rodoviario', name: 'Frete rodoviário', sourceCode: 'antt' },
    { code: 'armazenagem', name: 'Armazenagem', sourceCode: 'cnt' },
    { code: 'distribuicao_ultima_milha', name: 'Última milha / delivery', sourceCode: 'cnt' },
    { code: 'transporte_passageiros', name: 'Transporte de passageiros', sourceCode: 'antt' },
    { code: 'logistica_integrada', name: 'Logística integrada', sourceCode: 'cnt' },
  ]),
  ...products('food', [
    { code: 'refeicoes', name: 'Refeições / pratos', sourceCode: 'abia' },
    { code: 'lanches', name: 'Lanches', sourceCode: 'sebrae' },
    { code: 'marmitas', name: 'Marmitas', sourceCode: 'sebrae' },
    { code: 'padaria_confeitaria', name: 'Padaria e confeitaria', sourceCode: 'abia' },
    { code: 'bebidas', name: 'Bebidas', sourceCode: 'abia' },
    { code: 'delivery_food', name: 'Delivery de alimentos', sourceCode: 'sebrae' },
    { code: 'buffet_eventos', name: 'Buffet e eventos', sourceCode: 'sebrae' },
  ]),
  ...products('hospitality', [
    { code: 'hospedagem', name: 'Hospedagem / diárias', sourceCode: 'min_turismo' },
    { code: 'pacotes_turismo', name: 'Pacotes turísticos', sourceCode: 'embratur' },
    { code: 'eventos_hotel', name: 'Eventos e salões', sourceCode: 'min_turismo' },
    { code: 'alimentacao_hotel', name: 'Alimentação no hotel', sourceCode: 'embratur' },
    { code: 'spa_wellness', name: 'Spa e wellness', sourceCode: 'min_turismo' },
  ]),
  ...products('health', [
    { code: 'consultas', name: 'Consultas', sourceCode: 'ans' },
    { code: 'exames', name: 'Exames e laudos', sourceCode: 'min_saude' },
    { code: 'procedimentos', name: 'Procedimentos', sourceCode: 'ans' },
    { code: 'cirurgias', name: 'Cirurgias', sourceCode: 'ans' },
    { code: 'terapias', name: 'Terapias e reabilitação', sourceCode: 'min_saude' },
    { code: 'planos_saude', name: 'Planos e convênios', sourceCode: 'ans' },
  ]),
  ...products('education', [
    { code: 'ensino_regular', name: 'Ensino regular', sourceCode: 'inep' },
    { code: 'cursos_livres', name: 'Cursos livres', sourceCode: 'mec' },
    { code: 'graduacao', name: 'Graduação / pós', sourceCode: 'inep' },
    { code: 'treinamento_corporativo', name: 'Treinamento corporativo', sourceCode: 'sebrae' },
    { code: 'ead', name: 'EAD / educação digital', sourceCode: 'mec' },
  ]),
  ...products('real_estate', [
    { code: 'venda_imoveis', name: 'Venda de imóveis', sourceCode: 'secovi' },
    { code: 'aluguel', name: 'Aluguel', sourceCode: 'secovi' },
    { code: 'administracao_predial', name: 'Administração predial', sourceCode: 'secovi' },
    { code: 'corretagem', name: 'Corretagem', sourceCode: 'cbic' },
  ]),
  ...products('financial', [
    { code: 'credito', name: 'Crédito e financiamento', sourceCode: 'banco_central' },
    { code: 'seguros', name: 'Seguros', sourceCode: 'banco_central' },
    { code: 'correspondente', name: 'Correspondente bancário', sourceCode: 'banco_central' },
    { code: 'investimentos', name: 'Investimentos', sourceCode: 'cvm' },
    { code: 'consultoria_financeira', name: 'Consultoria financeira', sourceCode: 'cvm' },
  ]),
  ...products('automotive', [
    { code: 'manutencao_veiculos', name: 'Manutenção de veículos', sourceCode: 'fenabrave' },
    { code: 'pecas', name: 'Peças e acessórios', sourceCode: 'fenabrave' },
    { code: 'venda_veiculos', name: 'Venda de veículos', sourceCode: 'anfavea' },
    { code: 'estetica_auto', name: 'Estética automotiva', sourceCode: 'fenabrave' },
    { code: 'funilaria', name: 'Funilaria e pintura', sourceCode: 'fenabrave' },
  ]),
  ...products('energy', [
    { code: 'energia_solar', name: 'Energia solar', sourceCode: 'aneel' },
    { code: 'energia_eolica', name: 'Energia eólica', sourceCode: 'epe' },
    { code: 'distribuicao_energia', name: 'Distribuição de energia', sourceCode: 'aneel' },
    { code: 'eficiencia_energetica', name: 'Eficiência energética', sourceCode: 'epe' },
    { code: 'instalacao_sistemas', name: 'Instalação de sistemas', sourceCode: 'aneel' },
  ]),
  ...products('mining', [
    { code: 'minerio_ferro', name: 'Minério de ferro', sourceCode: 'ibram' },
    { code: 'agregados', name: 'Agregados (areia, brita)', sourceCode: 'anm' },
    { code: 'minerais_industriais', name: 'Minerais industriais', sourceCode: 'ibram' },
    { code: 'joias_gemas', name: 'Gemas e joias', sourceCode: 'anm' },
  ]),
  ...products('media', [
    { code: 'conteudo_digital', name: 'Conteúdo digital', sourceCode: 'secom' },
    { code: 'publicidade', name: 'Publicidade', sourceCode: 'assoc_midia' },
    { code: 'jornalismo', name: 'Jornalismo', sourceCode: 'ibge' },
    { code: 'audiovisual', name: 'Produção audiovisual', sourceCode: 'assoc_midia' },
    { code: 'podcast', name: 'Podcast', sourceCode: 'secom' },
  ]),
  ...products('marketing', [
    { code: 'gestao_midia', name: 'Gestão de mídia', sourceCode: 'iab_brasil' },
    { code: 'criacao_campanhas', name: 'Criação de campanhas', sourceCode: 'cenp' },
    { code: 'social_media', name: 'Social media', sourceCode: 'iab_brasil' },
    { code: 'branding', name: 'Branding', sourceCode: 'cenp' },
    { code: 'performance_digital', name: 'Performance digital', sourceCode: 'iab_brasil' },
  ]),
  ...products('entertainment', [
    { code: 'ingressos', name: 'Ingressos e bilheteria', sourceCode: 'min_cultura' },
    { code: 'shows', name: 'Shows e espetáculos', sourceCode: 'ibge' },
    { code: 'producao_cultural', name: 'Produção cultural', sourceCode: 'min_cultura' },
    { code: 'espaco_eventos', name: 'Espaço para eventos', sourceCode: 'ibge' },
  ]),
  ...products('sports', [
    { code: 'mensalidades_academia', name: 'Mensalidades de academia', sourceCode: 'sebrae' },
    { code: 'aulas_esportivas', name: 'Aulas esportivas', sourceCode: 'assoc_esporte' },
    { code: 'eventos_esportivos', name: 'Eventos esportivos', sourceCode: 'ibge' },
    { code: 'personal_treino', name: 'Personal trainer', sourceCode: 'sebrae' },
    { code: 'aluguel_quadra', name: 'Aluguel de quadra/arena', sourceCode: 'assoc_esporte' },
  ]),
  ...products('beauty', [
    { code: 'cabelo', name: 'Cabelo', sourceCode: 'abihpec' },
    { code: 'estetica', name: 'Estética', sourceCode: 'abihpec' },
    { code: 'unhas', name: 'Unhas', sourceCode: 'sebrae' },
    { code: 'barbearia', name: 'Barbearia', sourceCode: 'sebrae' },
    { code: 'produtos_beleza', name: 'Produtos de beleza', sourceCode: 'abihpec' },
  ]),
  ...products('professional', [
    { code: 'consultoria_profissional', name: 'Consultoria', sourceCode: 'sebrae' },
    { code: 'advocacia', name: 'Advocacia', sourceCode: 'conselhos_prof' },
    { code: 'contabilidade', name: 'Contabilidade', sourceCode: 'conselhos_prof' },
    { code: 'engenharia', name: 'Engenharia', sourceCode: 'conselhos_prof' },
    { code: 'arquitetura', name: 'Arquitetura', sourceCode: 'conselhos_prof' },
  ]),
  ...products('environment', [
    { code: 'gestao_residuos', name: 'Gestão de resíduos', sourceCode: 'ibama' },
    { code: 'licenciamento', name: 'Licenciamento ambiental', sourceCode: 'ibama' },
    { code: 'consultoria_ambiental', name: 'Consultoria ambiental', sourceCode: 'ana' },
    { code: 'reciclagem', name: 'Reciclagem', sourceCode: 'ibge' },
  ]),
  ...products('public_admin', [
    { code: 'servicos_publicos', name: 'Serviços públicos', sourceCode: 'portal_transparencia' },
    { code: 'programas_sociais', name: 'Programas sociais', sourceCode: 'tesouro_nacional' },
    { code: 'gestao_orcamentaria', name: 'Gestão orçamentária', sourceCode: 'tesouro_nacional' },
  ]),
  ...products('other', [
    { code: 'produto_generico', name: 'Produto da atividade', sourceCode: 'sebrae' },
    { code: 'servico_generico', name: 'Serviço da atividade', sourceCode: 'ibge' },
  ]),
]

export const OTHER_PRODUCT_OPTION = { value: 'outro', label: 'Outro' } as const

export const PRODUCTS_OFFERED_QUESTION = 'products_offered'
export const PRODUCTS_OTHER_DESCRIBE_QUESTION = 'products_other_describe'
export const PRODUCTS_OTHER_MATCHES_QUESTION = 'products_other_matches'

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function scoreProduct(item: SectorProductOption, query: string | null | undefined): number {
  if (!query || !query.trim()) return 100
  const q = normalize(query)
  const name = normalize(item.name)
  const description = normalize(item.description ?? '')
  if (name === q) return 300
  if (name.startsWith(q)) return 240
  if (name.includes(q)) return 200
  if (description.includes(q)) return 160
  const tokens = q.split(/\s+/).filter((token) => token.length >= 3)
  if (tokens.some((token) => name.includes(token) || description.includes(token))) return 120
  return 0
}

/** Busca local por ramo(s) e, opcionalmente, texto livre (fluxo "Outro"). */
export function searchSectorProductsLocal(
  segmentCodes: string[],
  query?: string | null,
  limit = 40
): SectorProductOption[] {
  const segments = new Set(
    segmentCodes.map((code) => code.trim().toLowerCase()).filter(Boolean)
  )
  if (segments.size === 0) return []

  const ranked = SECTOR_PRODUCT_CATALOG.filter((item) =>
    segments.has(String(item.segmentCode).toLowerCase())
  )
    .map((item) => ({ ...item, rankScore: scoreProduct(item, query) }))
    .filter((item) => (query && query.trim() ? (item.rankScore ?? 0) > 0 : true))
    .sort(
      (a, b) =>
        (b.rankScore ?? 0) - (a.rankScore ?? 0) || a.name.localeCompare(b.name, 'pt-BR')
    )

  const seen = new Set<string>()
  const result: SectorProductOption[] = []
  for (const item of ranked) {
    const key = `${item.segmentCode}:${item.code}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
    if (result.length >= limit) break
  }
  return result
}

export function productOptionValue(item: SectorProductOption): string {
  return `${item.segmentCode}:${item.code}`
}

export function productOptionLabel(item: SectorProductOption): string {
  return item.name
}

/** Extrai rótulos humanos das respostas de produtos (códigos ou texto). */
export function resolveProductLabels(
  values: string[],
  catalog: SectorProductOption[] = SECTOR_PRODUCT_CATALOG
): string[] {
  const byKey = new Map(
    catalog.map((item) => [productOptionValue(item), item.name] as const)
  )
  const byCode = new Map(catalog.map((item) => [item.code, item.name] as const))
  const labels: string[] = []
  for (const raw of values) {
    const value = String(raw).trim()
    if (!value || value === 'outro' || value === '__skipped__') continue
    if (byKey.has(value)) {
      labels.push(byKey.get(value)!)
      continue
    }
    if (byCode.has(value)) {
      labels.push(byCode.get(value)!)
      continue
    }
    labels.push(value)
  }
  return labels
}
