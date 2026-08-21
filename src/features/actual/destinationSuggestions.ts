import type { MoneyGroup } from '../../types/database.ts'
import { productsFromFacts } from '../budget/defaultDestinations.ts'

export interface BudgetDestinationRef {
  id: string
  moneyGroup: MoneyGroup
  name: string
}

export interface DestinationMatchPattern {
  matchType: 'counterparty' | 'description_contains' | 'description_exact'
  matchValue: string
  moneyGroup: MoneyGroup
  destinationId: string | null
  destinationName: string
  usageCount: number
}

export interface ClassificationSuggestionContext {
  destinations: BudgetDestinationRef[]
  patterns: DestinationMatchPattern[]
  profileFacts?: Record<string, unknown>
  segmentCode?: string | null
}

export interface TransactionSuggestionInput {
  id: string
  description: string
  counterparty?: string | null
  type?: string | null
  suggested_money_group?: MoneyGroup | null
  suggested_destination_id?: string | null
  suggested_destination_name?: string | null
  suggestion_source?: 'history' | 'rule' | null
}

export interface EnrichedSuggestion {
  moneyGroup: MoneyGroup | null
  destinationId: string | null
  destinationName: string | null
  source: 'history' | 'rule' | 'context' | null
  label: string | null
}

function usesCostCenterDestinations(moneyGroup: MoneyGroup | '' | null | undefined) {
  return moneyGroup === 'cost' || moneyGroup === 'expense'
}

export function allowsNewDestinationName(moneyGroup: MoneyGroup | '' | null | undefined) {
  return moneyGroup === 'revenue' || moneyGroup === 'investment'
}

const KEYWORD_RULES: Array<{
  patterns: RegExp[]
  moneyGroup: MoneyGroup
  destinationHints: string[]
}> = [
  {
    patterns: [/posto\b/i, /combust/i, /gasolina/i, /diesel/i, /etanol/i],
    moneyGroup: 'cost',
    destinationHints: ['Combustível', 'Combustivel'],
  },
  {
    patterns: [/energia/i, /eletric/i, /cemig/i, /enel/i, /light\b/i, /copel/i],
    moneyGroup: 'expense',
    destinationHints: ['Energia'],
  },
  {
    patterns: [/internet/i, /telecom/i, /vivo\b/i, /claro\b/i, /tim\b/i, /oi\b/i],
    moneyGroup: 'expense',
    destinationHints: ['Internet'],
  },
  {
    patterns: [/aluguel/i, /locação/i, /locacao/i],
    moneyGroup: 'expense',
    destinationHints: ['Aluguel'],
  },
  {
    patterns: [/contab/i, /contador/i],
    moneyGroup: 'expense',
    destinationHints: ['Contabilidade'],
  },
  {
    patterns: [/marketing/i, /google ads/i, /meta ads/i, /facebook ads/i, /anuncio/i, /anúncio/i],
    moneyGroup: 'expense',
    destinationHints: ['Marketing'],
  },
  {
    patterns: [/frete/i, /transportadora/i, /correios/i, /jadlog/i, /melhor envio/i],
    moneyGroup: 'cost',
    destinationHints: ['Fretes', 'Frete'],
  },
  {
    patterns: [/folha\b/i, /salario/i, /salário/i, /inss\b/i, /fgts\b/i],
    moneyGroup: 'cost',
    destinationHints: ['Mão de obra', 'Folha da operação', 'Folha administrativa'],
  },
  {
    patterns: [/manuten/i, /oficina/i],
    moneyGroup: 'cost',
    destinationHints: ['Manutenção'],
  },
]

function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function findDestination(
  destinations: BudgetDestinationRef[],
  moneyGroup: MoneyGroup,
  hints: string[]
): BudgetDestinationRef | null {
  const normalizedHints = hints.map((item) => normalize(item))
  return (
    destinations.find(
      (item) =>
        item.moneyGroup === moneyGroup &&
        normalizedHints.some(
          (hint) =>
            normalize(item.name) === hint || normalize(item.name).includes(hint)
        )
    ) ?? null
  )
}

function matchPattern(
  patterns: DestinationMatchPattern[],
  description: string,
  counterparty: string | null | undefined
): DestinationMatchPattern | null {
  const desc = normalize(description)
  const party = normalize(counterparty)

  const exactDesc = patterns
    .filter((item) => item.matchType === 'description_exact' && item.matchValue === desc)
    .sort((a, b) => b.usageCount - a.usageCount)[0]
  if (exactDesc) return exactDesc

  if (party) {
    const byParty = patterns
      .filter((item) => item.matchType === 'counterparty' && item.matchValue === party)
      .sort((a, b) => b.usageCount - a.usageCount)[0]
    if (byParty) return byParty
  }

  const contains = patterns
    .filter(
      (item) =>
        item.matchType === 'description_contains' &&
        item.matchValue &&
        desc.includes(item.matchValue)
    )
    .sort((a, b) => b.usageCount - a.usageCount)[0]
  return contains ?? null
}

/**
 * Só sugere destino se ele já existir no catálogo do grupo
 * (orçamento para receita/investimento; centros de custo para custo/despesa).
 * Nunca inventa nome de destino.
 */
function contextSuggestion(
  input: TransactionSuggestionInput,
  context: ClassificationSuggestionContext
): EnrichedSuggestion | null {
  const haystack = `${input.description} ${input.counterparty ?? ''}`
  const normalized = normalize(haystack)

  for (const rule of KEYWORD_RULES) {
    if (!rule.patterns.some((pattern) => pattern.test(haystack))) continue
    const destination = findDestination(
      context.destinations,
      rule.moneyGroup,
      rule.destinationHints
    )
    // Custos/despesas: só casa com centro de custo já cadastrado.
    // Receitas/investimentos: só casa com destino já definido no orçamento.
    if (!destination) {
      return {
        moneyGroup: rule.moneyGroup,
        destinationId: null,
        destinationName: null,
        source: 'context',
        label: labelForGroup(rule.moneyGroup),
      }
    }
    return {
      moneyGroup: rule.moneyGroup,
      destinationId: destination.id,
      destinationName: destination.name,
      source: 'context',
      label: `${labelForGroup(rule.moneyGroup)} › ${destination.name}`,
    }
  }

  // Produtos/serviços do cadastro → receita, se o destino existir no orçamento
  const products = productsFromFacts(context.profileFacts ?? {})
  for (const product of products) {
    const productKey = normalize(product)
    if (productKey.length < 3) continue
    if (!normalized.includes(productKey)) continue
    const destination = findDestination(context.destinations, 'revenue', [
      product,
      `Venda de ${product}`,
      `Serviços · ${product}`,
    ])
    if (!destination) {
      return {
        moneyGroup: 'revenue',
        destinationId: null,
        destinationName: null,
        source: 'context',
        label: 'Receitas',
      }
    }
    return {
      moneyGroup: 'revenue',
      destinationId: destination.id,
      destinationName: destination.name,
      source: 'context',
      label: `Receitas › ${destination.name}`,
    }
  }

  // Destinos já cadastrados cujo nome aparece na descrição
  const ranked = context.destinations
    .map((destination) => {
      const nameKey = normalize(destination.name)
      if (nameKey.length < 3) return null
      if (!normalized.includes(nameKey)) return null
      return destination
    })
    .filter((item): item is BudgetDestinationRef => Boolean(item))
    .sort((a, b) => normalize(b.name).length - normalize(a.name).length)

  const hit = ranked[0]
  if (!hit) return null
  return {
    moneyGroup: hit.moneyGroup,
    destinationId: hit.id,
    destinationName: hit.name,
    source: 'context',
    label: `${labelForGroup(hit.moneyGroup)} › ${hit.name}`,
  }
}

function labelForGroup(moneyGroup: MoneyGroup) {
  if (moneyGroup === 'revenue') return 'Receitas'
  if (moneyGroup === 'cost') return 'Custos'
  if (moneyGroup === 'expense') return 'Despesas'
  return 'Investimentos'
}

function suggestionFromKnownFields(
  moneyGroup: MoneyGroup | null | undefined,
  destinationId: string | null | undefined,
  destinationName: string | null | undefined,
  source: EnrichedSuggestion['source'],
  destinations: BudgetDestinationRef[]
): EnrichedSuggestion {
  const group = moneyGroup ?? null
  let resolvedId = destinationId ?? null
  let resolvedName = destinationName ?? null

  // Só preenche destino se existir no catálogo do grupo (evita inventar).
  if (group && resolvedName) {
    const match =
      destinations.find(
        (item) =>
          item.moneyGroup === group &&
          (item.id === resolvedId ||
            normalize(item.name) === normalize(resolvedName))
      ) ?? null
    if (match) {
      resolvedId = match.id
      resolvedName = match.name
    } else if (usesCostCenterDestinations(group)) {
      // Custos/despesas: não sugere destino inventado.
      resolvedId = null
      resolvedName = null
    } else {
      // Receita/investimento: só aceita destino já do orçamento.
      const byName = destinations.find(
        (item) =>
          item.moneyGroup === group &&
          normalize(item.name) === normalize(resolvedName)
      )
      if (!byName) {
        resolvedId = null
        resolvedName = null
      }
    }
  }

  return {
    moneyGroup: group,
    destinationId: resolvedId,
    destinationName: resolvedName,
    source,
    label:
      group && resolvedName
        ? `${labelForGroup(group)} › ${resolvedName}`
        : group
          ? labelForGroup(group)
          : resolvedName ?? null,
  }
}

/**
 * Enriquece sugestões: histórico confirmado > padrões aprendidos > contexto da empresa/orçamento.
 * Destinos sugeridos sempre vêm do catálogo (orçamento ou centros de custo) — nunca inventados.
 */
export function enrichTransactionSuggestion(
  input: TransactionSuggestionInput,
  context: ClassificationSuggestionContext
): EnrichedSuggestion {
  if (input.suggested_money_group || input.suggested_destination_name) {
    return suggestionFromKnownFields(
      input.suggested_money_group,
      input.suggested_destination_id,
      input.suggested_destination_name,
      input.suggestion_source ?? 'history',
      context.destinations
    )
  }

  const patterned = matchPattern(context.patterns, input.description, input.counterparty)
  if (patterned) {
    return suggestionFromKnownFields(
      patterned.moneyGroup,
      patterned.destinationId,
      patterned.destinationName,
      'history',
      context.destinations
    )
  }

  const fromContext = contextSuggestion(input, context)
  if (fromContext) return fromContext

  return {
    moneyGroup: null,
    destinationId: null,
    destinationName: null,
    source: null,
    label: null,
  }
}

export function hasDestinationSuggestion(item: {
  suggested_money_group?: string | null
  suggested_destination_name?: string | null
  suggested_category_id?: string | null
  suggested_department_id?: string | null
  suggested_cost_center_id?: string | null
}) {
  return Boolean(
    item.suggested_money_group ||
      item.suggested_destination_name ||
      item.suggested_category_id ||
      item.suggested_department_id ||
      item.suggested_cost_center_id
  )
}
