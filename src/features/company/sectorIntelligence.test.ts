function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

/** Espelha os rótulos públicos do painel — sem importar o cliente Supabase. */
const KNOWLEDGE_KIND_LABELS: Record<string, string> = {
  subramo: 'Subramos',
  activity: 'Atividades',
  product: 'Produtos e serviços',
  revenue: 'Receitas típicas',
  cost: 'Custos típicos',
  expense: 'Despesas típicas',
  indicator: 'Indicadores setoriais',
  benchmark_metric: 'Métricas de benchmark (quando houver dado ingerido)',
}

const SEGMENT_SOURCES: Record<string, string[]> = {
  agro: ['cna_brasil', 'conab', 'ibge', 'embrapa', 'cepea'],
  commerce: ['sebrae_intel', 'ibge', 'mapa_empresas'],
  tech: ['brasscom', 'abes', 'ibge'],
  other: ['ibge', 'sebrae', 'fontes_especificas'],
}

assert(KNOWLEDGE_KIND_LABELS.subramo === 'Subramos', 'rótulo de subramo')
assert(KNOWLEDGE_KIND_LABELS.revenue === 'Receitas típicas', 'rótulo de receita')
assert(
  KNOWLEDGE_KIND_LABELS.benchmark_metric.includes('benchmark'),
  'rótulo de benchmark'
)

for (const [segment, sources] of Object.entries(SEGMENT_SOURCES)) {
  assert(sources.length > 0, `${segment} precisa de fontes`)
  assert(
    sources.length <= 5,
    `${segment} não deve disparar busca em todas as fontes`
  )
}

assert(
  SEGMENT_SOURCES.agro.slice(0, 3).join(',') === 'cna_brasil,conab,ibge',
  'agro deve priorizar CNA, CONAB e IBGE'
)

console.log('sectorIntelligence catalog contracts ok')
