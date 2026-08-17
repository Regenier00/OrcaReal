import { Link } from 'react-router-dom'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/Button'
import { features } from '@/content/features'

export function FeaturesPage() {
  return (
    <div className="min-h-svh bg-paper">
      <div className="bg-ink bg-hero-atmosphere pb-16">
        <PublicHeader />
        <div className="mx-auto max-w-6xl px-6 pt-10 sm:px-10">
          <h1 className="animate-fade-up font-display text-4xl font-bold text-white sm:text-5xl">
            Funcionalidades
          </h1>
          <p className="animate-fade-up-delayed mt-4 max-w-2xl text-white/65">
            Cada funcionalidade resolve um problema concreto da rotina
            financeira. Na demonstração você testa com dados de exemplo; a conta
            entra quando for usar os seus.
          </p>
        </div>
      </div>

      <section className="mx-auto -mt-8 max-w-6xl px-6 pb-20 sm:px-10">
        <ul className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <li
              key={feature.id}
              className="rounded-2xl border border-paper-muted bg-white p-6 shadow-[var(--shadow-soft)]"
            >
              <h2 className="font-display text-xl font-semibold text-ink">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft/80">
                {feature.summary}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-mist">
                {feature.explanation}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to={`/demo?f=${feature.id}`}>
                  <Button variant="secondary" className="!text-sm">
                    Ver na prática
                  </Button>
                </Link>
                <Link to="/cadastro">
                  <Button className="!text-sm">Quero usar com meus dados</Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/demo">
            <Button>Experimentar sem conta</Button>
          </Link>
          <Link to="/cadastro">
            <Button variant="secondary">Criar conta</Button>
          </Link>
          <Link to="/">
            <Button variant="ghost" className="!text-navy hover:!bg-paper-muted">
              Voltar à Home
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
