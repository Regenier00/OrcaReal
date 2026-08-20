export type FeatureId =
  | 'budget-vs-actual'
  | 'cost-analysis'
  | 'budget'
  | 'indicators'

export interface Feature {
  id: FeatureId
  title: string
  summary: string
  explanation: string
  detail: string
}

export const features: Feature[] = [
  {
    id: 'budget-vs-actual',
    title: 'Orçado × Realizado',
    summary: 'Compare o plano com o que de fato aconteceu, sem cruzar planilhas.',
    explanation:
      'O desvio entre o orçado e o realizado aparece por período, departamento ou centro de custo. Você vê o que saiu do plano e o quanto isso pesou no resultado — no mesmo recorte, sem montar uma nova aba a cada pergunta.',
    detail: 'Desvios por período, área e centro de custo.',
  },
  {
    id: 'cost-analysis',
    title: 'Análise de Custos',
    summary: 'Enxergue onde o dinheiro se concentra e o que merece revisão.',
    explanation:
      'Os custos são agrupados e ranqueados para mostrar concentração e tendência. Em vez de uma lista longa, você identifica os poucos itens que realmente movem o resultado e decide o que olhar primeiro.',
    detail: 'Concentração, ranking e tendência dos custos.',
  },
  {
    id: 'budget',
    title: 'Orçamento',
    summary: 'Monte o plano financeiro numa estrutura padrão, ou importe o que já existe.',
    explanation:
      'O orçamento fica organizado em Receitas, Custos, Despesas e Investimentos, com destinos simples que você cria. Dá para começar do zero ou trazer a planilha que a empresa já usa. O formato é o mesmo para quem planeja e para quem acompanha o realizado.',
    detail: 'Estrutura padronizada, com importação opcional.',
  },
  {
    id: 'indicators',
    title: 'Indicadores',
    summary: 'Consulte e simule os números que importam, com a conta à vista.',
    explanation:
      'Indicadores como desvio orçamentário e concentração de custos vêm com a fórmula visível. Antes de mudar o plano, você simula o cenário e entende o efeito — sem depender de um modelo escondido em outra planilha.',
    detail: 'Fórmulas claras e simulação de cenários.',
  },
]
