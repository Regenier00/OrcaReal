import type { FeatureId } from '@/content/features'
import { sum } from '@/lib/money'

export const demoCompany = {
  name: 'Horizonte Consultoria',
  tradeName: 'Horizonte',
  segment: 'Serviços',
  activity: 'Consultoria',
  period: 'Jan–Jun 2026',
}

export const demoMonths = [
  { key: '2026-01', label: 'Jan' },
  { key: '2026-02', label: 'Fev' },
  { key: '2026-03', label: 'Mar' },
  { key: '2026-04', label: 'Abr' },
  { key: '2026-05', label: 'Mai' },
  { key: '2026-06', label: 'Jun' },
] as const

export type MonthKey = (typeof demoMonths)[number]['key'] | 'ytd'

export interface DemoLine {
  department: string
  costCenter: string
  category: string
  budget: number[]
  actual: number[]
}

export const demoLines: DemoLine[] = [
  {
    department: 'Operação',
    costCenter: 'Projetos',
    category: 'Pessoal',
    budget: [80_000, 80_000, 80_000, 85_000, 85_000, 85_000],
    actual: [82_400, 84_100, 88_200, 92_100, 90_300, 94_800],
  },
  {
    department: 'Administrativo',
    costCenter: 'Backoffice',
    category: 'Pessoal',
    budget: [25_000, 25_000, 25_000, 25_000, 25_000, 25_000],
    actual: [24_100, 25_000, 26_200, 24_800, 23_900, 26_100],
  },
  {
    department: 'Operação',
    costCenter: 'Projetos',
    category: 'Ferramentas',
    budget: [8_000, 8_000, 8_000, 8_000, 8_000, 8_000],
    actual: [9_200, 8_100, 10_400, 11_200, 8_900, 9_800],
  },
  {
    department: 'Comercial',
    costCenter: 'Vendas',
    category: 'Marketing',
    budget: [12_000, 12_000, 15_000, 15_000, 12_000, 12_000],
    actual: [10_100, 11_000, 12_300, 14_100, 9_200, 8_100],
  },
  {
    department: 'Administrativo',
    costCenter: 'Backoffice',
    category: 'Aluguel',
    budget: [10_000, 10_000, 10_000, 10_000, 10_000, 10_000],
    actual: [10_000, 10_000, 10_000, 10_000, 10_000, 10_000],
  },
  {
    department: 'Operação',
    costCenter: 'Projetos',
    category: 'Deslocamento',
    budget: [6_000, 6_000, 6_000, 7_000, 7_000, 7_000],
    actual: [8_100, 5_200, 9_400, 12_100, 6_300, 7_100],
  },
]

export type DemoGate = 'simulation' | 'import' | 'export' | 'save'

export const demoGates: Record<
  DemoGate,
  { title: string; body: string; action: string }
> = {
  simulation: {
    title: 'As simulações da demonstração acabaram',
    body: 'Você já viu o efeito no resultado. Crie conta para salvar cenários e simular com os números da sua empresa.',
    action: 'Criar conta para simular os meus dados',
  },
  import: {
    title: 'Importar planilha pede uma conta',
    body: 'Aqui você explora dados de exemplo. Para trazer o orçamento que a empresa já usa, crie uma conta — leva um minuto.',
    action: 'Criar conta para importar',
  },
  export: {
    title: 'Exportar relatórios pede uma conta',
    body: 'A demonstração mostra o recorte. Excel e PDF ficam disponíveis depois do cadastro, com os seus dados.',
    action: 'Criar conta para exportar',
  },
  save: {
    title: 'Nada da demonstração é salvo',
    body: 'Com uma conta você cria a empresa, importa a planilha e acompanha o realizado de verdade.',
    action: 'Criar conta e usar meus dados',
  },
}

export const demoFeatureOrder: FeatureId[] = [
  'budget-vs-actual',
  'cost-analysis',
  'budget',
  'indicators',
]

export function sliceByMonth(values: number[], month: MonthKey) {
  if (month === 'ytd') return sum(values)
  const index = demoMonths.findIndex((item) => item.key === month)
  return values[index] ?? 0
}

export function applyPersonnelCut(lines: DemoLine[], percent: number): DemoLine[] {
  const factor = 1 - percent / 100
  return lines.map((line) =>
    line.category === 'Pessoal'
      ? { ...line, actual: line.actual.map((value) => Math.round(value * factor)) }
      : line
  )
}

export function totals(lines: DemoLine[], month: MonthKey) {
  const budget = sum(lines.map((line) => sliceByMonth(line.budget, month)))
  const actual = sum(lines.map((line) => sliceByMonth(line.actual, month)))
  const variance = actual - budget
  const variancePct = budget === 0 ? 0 : variance / budget
  return { budget, actual, variance, variancePct }
}

export function groupCosts(
  lines: DemoLine[],
  month: MonthKey,
  by: 'category' | 'department'
) {
  const map = new Map<string, { actual: number; budget: number }>()

  for (const line of lines) {
    const key = by === 'category' ? line.category : line.department
    const current = map.get(key) ?? { actual: 0, budget: 0 }
    current.actual += sliceByMonth(line.actual, month)
    current.budget += sliceByMonth(line.budget, month)
    map.set(key, current)
  }

  const rows = [...map.entries()]
    .map(([label, values]) => ({ label, ...values }))
    .sort((a, b) => b.actual - a.actual)

  const totalActual = sum(rows.map((row) => row.actual))
  let cumulative = 0

  return rows.map((row) => {
    const share = totalActual === 0 ? 0 : row.actual / totalActual
    cumulative += share
    return { ...row, share, cumulative }
  })
}
