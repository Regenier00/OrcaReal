export type AppModuleId =
  | 'budget'
  | 'actual'
  | 'budget-vs-actual'
  | 'indicators'

export interface AppModule {
  id: AppModuleId
  title: string
  summary: string
  to: string
}

export const appModules: AppModule[] = [
  {
    id: 'budget',
    title: 'Orçamentos',
    summary: 'Monte o plano do exercício na estrutura da empresa.',
    to: '/app/orcamentos',
  },
  {
    id: 'actual',
    title: 'Realizado',
    summary: 'Importe o extrato e lance o realizado no mesmo recorte do orçamento.',
    to: '/app/realizado',
  },
  {
    id: 'budget-vs-actual',
    title: 'Orçado × Realizado',
    summary: 'Compare o plano com o realizado e veja o desvio no mesmo vínculo.',
    to: '/app/orcado-realizado',
  },
  {
    id: 'indicators',
    title: 'Indicadores',
    summary: 'Desvio, percentual e concentração de custos, com a fórmula à vista.',
    to: '/app/indicadores',
  },
]
