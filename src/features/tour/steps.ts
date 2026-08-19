import { KPI_FORMULAS } from '../home/kpiFormulas.ts'
import { SKIP_TOUR_LABEL } from './storage.ts'

export const TOUR_SKIP_LABEL = SKIP_TOUR_LABEL

export interface TourFormula {
  name: string
  formula: string
}

export interface TourStep {
  id: string
  path: string
  target?: string
  kicker: string
  title: string
  body: string
  hook?: string
  collectFormulasFrom?: string
  formulas?: TourFormula[]
  nextLabel: string
  finish?: boolean
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    path: '/app',
    target: 'hero',
    kicker: 'Dashboard',
    title: 'Sua operação já tem um lugar para viver',
    body: 'Aqui é onde você enxerga o mês inteiro sem montar planilha. Receita, saídas e o que sobrou — o pulso da empresa, no mesmo lugar.',
    hook: 'Sem aula. Só o mapa da OrcaReal.',
    nextLabel: 'Ver o placar do mês',
  },
  {
    id: 'scoreboard',
    path: '/app',
    target: 'financial-summary',
    kicker: 'Dashboard',
    title: 'O placar que a planilha não entrega',
    body: 'Aqui é onde você lê o resultado de relance: o que entrou, o que saiu, o que sobrou e o desvio do plano. Cada card já traz a conta.',
    hook: 'Decida com o número na mão, não no feeling.',
    collectFormulasFrom: 'financial-summary',
    formulas: [
      { name: 'Entradas do período', formula: KPI_FORMULAS.revenue },
      { name: 'Saídas realizadas', formula: KPI_FORMULAS.realized },
      { name: 'Receita menos saídas', formula: KPI_FORMULAS.profit },
      { name: 'Realizado × orçado', formula: KPI_FORMULAS.variance },
    ],
    nextLabel: 'Ver os indicadores',
  },
  {
    id: 'indicators',
    path: '/app',
    target: 'indicators',
    kicker: 'Indicadores',
    title: 'Os números do seu modelo, sem caixa-preta',
    body: 'Aqui é onde você acompanha os indicadores da operação. A fórmula fica à vista em cada card — o cálculo deixa de ser mistério e vira ferramenta.',
    hook: 'O número e a conta, lado a lado.',
    collectFormulasFrom: 'indicators',
    formulas: [{ name: 'Total realizado', formula: KPI_FORMULAS.totalCost }],
    nextLabel: 'Ver os orçamentos',
  },
  {
    id: 'budgets',
    path: '/app/orcamentos',
    target: 'budgets',
    kicker: 'Orçamentos',
    title: 'O plano do exercício',
    body: 'Aqui é onde você vai definir seu orçamento e decidir para onde seu dinheiro vai. Departamento, centro de custo e categoria no mesmo recorte — o plano deixa de ser uma aba esquecida.',
    hook: 'O dinheiro precisa de destino antes de sair.',
    nextLabel: 'Ver o realizado',
  },
  {
    id: 'actual-import',
    path: '/app/realizado/importar',
    target: 'actual-import',
    kicker: 'Realizado',
    title: 'O extrato vira realizado',
    body: 'Aqui é onde você importa os extratos bancários. OFX, CSV, planilha ou PDF estruturado — os lançamentos entram sozinhos, prontos para o próximo passo.',
    hook: 'O banco fala. A OrcaReal traduz.',
    nextLabel: 'Ver a apropriação',
  },
  {
    id: 'actual-classify',
    path: '/app/realizado/nao-apropriados',
    target: 'actual-classify',
    kicker: 'Realizado',
    title: 'Cada real precisa de um endereço',
    body: 'Aqui é onde você apropria as movimentações existentes: departamento e centro de custo. Sem isso o dinheiro só entra; com isso, ele conta a história da operação.',
    hook: 'Classificar é o que transforma extrato em gestão.',
    nextLabel: 'Ver o Orçado × Realizado',
  },
  {
    id: 'comparison',
    path: '/app/orcado-realizado',
    target: 'comparison',
    kicker: 'Orçado × Realizado',
    title: 'O desvio, sem cruzar planilha',
    body: 'Aqui é onde você compara o plano com o que de fato aconteceu, no mesmo recorte. O desvio aparece sozinho — e você vê o que saiu da rota antes de virar surpresa.',
    hook: 'Plano de um lado. Vida real do outro.',
    nextLabel: 'Encerrar o mapa',
  },
  {
    id: 'wrap-up',
    path: '/app',
    target: 'hero',
    kicker: 'Pronto',
    title: 'O mapa é seu. O ritmo também.',
    body: 'Nada precisa ser preenchido agora. Quando quiser, o orçamento e o extrato entram — e o dashboard ganha vida no instante em que os dados chegam.',
    hook: 'A plataforma já está no lugar. Você escolhe a hora de usar.',
    nextLabel: 'Explorar a plataforma',
    finish: true,
  },
]

export function mergeCollectedFormulas(
  fallback: TourFormula[] | undefined,
  collected: TourFormula[]
): TourFormula[] {
  const seen = new Set<string>()
  const merged: TourFormula[] = []
  for (const item of [...collected, ...(fallback ?? [])]) {
    const key = `${item.name}::${item.formula}`.toLowerCase()
    if (!item.formula || seen.has(key)) continue
    seen.add(key)
    merged.push(item)
  }
  return merged
}

export function collectFormulasFromDom(scope: string): TourFormula[] {
  if (typeof document === 'undefined') return []
  const root = document.querySelector(`[data-tour="${scope}"]`)
  if (!root) return []
  return [...root.querySelectorAll('[data-tour-formula]')].flatMap((node) => {
    const formula = node.getAttribute('data-tour-formula')?.trim()
    if (!formula) return []
    return [
      {
        name: node.getAttribute('data-tour-formula-name')?.trim() || 'Indicador',
        formula,
      },
    ]
  })
}
