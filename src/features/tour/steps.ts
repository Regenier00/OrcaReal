import { appModules } from '../../content/appModules.ts'
import { KPI_FORMULAS } from '../home/kpiFormulas.ts'
import { SKIP_TOUR_LABEL } from './storage.ts'

export const TOUR_SKIP_LABEL = SKIP_TOUR_LABEL

export interface TourFormula {
  name: string
  formula: string
}

export interface TourStep {
  id: string
  target?: string
  placement: 'center' | 'auto'
  kicker: string
  title: string
  body: string
  hook?: string
  collectFormulasFrom?: string
  formulas?: TourFormula[]
  highlights?: string[]
  nextLabel: string
  finish?: boolean
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    target: 'hero',
    placement: 'auto',
    kicker: 'Começando',
    title: 'Sua operação já está no ar',
    body: 'Em poucos toques você vê o pulso do mês, o plano, o extrato e os indicadores — no lugar certo, sem procurar.',
    hook: 'Sem aula. Só o mapa da OrcaReal.',
    nextLabel: 'Mostrar o dashboard',
  },
  {
    id: 'scoreboard',
    target: 'financial-summary',
    placement: 'auto',
    kicker: 'Dashboard',
    title: 'O placar do mês',
    body: 'Receita, saídas, o que sobrou e o desvio do plano. Cada card já traz a conta, para você não depender de outra planilha.',
    hook: 'Quanto entrou, quanto saiu, o que sobrou.',
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
    target: 'indicators',
    placement: 'auto',
    kicker: 'Indicadores',
    title: 'As contas do seu modelo',
    body: 'Aqui entram os indicadores da operação. A fórmula fica à vista em cada card — clique para informar o que falta e ver o cálculo.',
    hook: 'Nada de caixa-preta: a conta aparece junto do número.',
    collectFormulasFrom: 'indicators',
    formulas: [{ name: 'Total realizado', formula: KPI_FORMULAS.totalCost }],
    nextLabel: 'Ver os atalhos',
  },
  {
    id: 'shortcuts',
    target: 'quick-access',
    placement: 'auto',
    kicker: 'Acesso rápido',
    title: 'Os quatro caminhos do dia a dia',
    body: 'Planejar, importar o extrato, comparar o desvio e medir o modelo — cada um com atalho próprio no dashboard.',
    hook: 'Toque no card quando quiser ir direto.',
    highlights: appModules.map((module) => `${module.title} — ${module.summary}`),
    nextLabel: 'Ver o menu',
  },
  {
    id: 'menu',
    target: 'nav',
    placement: 'auto',
    kicker: 'Menu',
    title: 'Tudo isso mora aqui em cima',
    body: 'Dashboard, Orçamentos, Realizado, Orçado × Realizado, Indicadores, Empresa e Perfil. O mesmo destino dos atalhos, sempre à mão.',
    hook: 'Quando quiser voltar, é um clique no topo.',
    highlights: [
      'Dashboard — o placar do mês',
      'Orçamentos — o plano do exercício',
      'Realizado — o extrato importado',
      'Orçado × Realizado — o desvio no mesmo recorte',
      'Indicadores — as contas, com a fórmula à vista',
      'Empresa e Perfil — estrutura e sua conta',
    ],
    nextLabel: 'Escolher o primeiro passo',
  },
  {
    id: 'first-move',
    target: 'quick-access',
    placement: 'center',
    kicker: 'Sua vez',
    title: 'Agora o jogo começa',
    body: 'Importe o extrato ou monte o primeiro orçamento. O dashboard ganha vida no instante em que os dados entram.',
    hook: 'Dois minutos e o placar deixa de ser zero.',
    nextLabel: 'Começar pelo orçamento',
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
