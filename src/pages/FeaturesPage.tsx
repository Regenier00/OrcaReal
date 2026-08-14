import { Link } from 'react-router-dom'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/Button'

const features = [
  {
    title: 'Orçado × Realizado',
    problem: 'Saber onde o plano e a execução divergem, sem planilha caótica.',
  },
  {
    title: 'Análise de Custos',
    problem: 'Enxergar os maiores custos e onde concentrar atenção.',
  },
  {
    title: 'Orçamento',
    problem: 'Montar e importar o plano financeiro de forma padronizada.',
  },
  {
    title: 'Indicadores',
    problem: 'Consultar e simular indicadores com explicação clara.',
  },
]

export function FeaturesPage() {
  return (
    <div className="min-h-svh bg-paper">
      <div className="bg-hero-atmosphere pb-16">
        <PublicHeader />
        <div className="mx-auto max-w-6xl px-6 pt-10 sm:px-10">
          <h1 className="animate-fade-up font-display text-4xl font-bold text-white sm:text-5xl">
            Funcionalidades
          </h1>
          <p className="animate-fade-up-delayed mt-4 max-w-2xl text-white/70">
            Experimente a proposta antes de criar conta. Cada funcionalidade
            resolve um problema concreto da rotina financeira.
          </p>
        </div>
      </div>

      <section className="mx-auto -mt-8 max-w-6xl px-6 pb-20 sm:px-10">
        <ul className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <li
              key={feature.title}
              className="rounded-2xl border border-paper-muted bg-white p-6 shadow-[var(--shadow-soft)]"
            >
              <h2 className="font-display text-xl font-semibold text-navy">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft/80">
                {feature.problem}
              </p>
              <div className="mt-5">
                <Link to="/cadastro">
                  <Button variant="secondary" className="!text-sm">
                    Quero usar com meus dados
                  </Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/">
            <Button variant="ghost" className="!text-navy hover:!bg-paper-muted">
              Voltar à Home
            </Button>
          </Link>
          <Link to="/cadastro">
            <Button>Criar conta</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
