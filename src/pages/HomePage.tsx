import { Link } from 'react-router-dom'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/Button'

export function HomePage() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-hero-atmosphere text-paper">
      <div
        aria-hidden
        className="animate-glow-pulse pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-sky/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-navy-bright/30 blur-3xl"
      />

      <PublicHeader />

      <section className="relative z-10 mx-auto flex min-h-[calc(100svh-5.5rem)] max-w-6xl flex-col justify-center px-6 pb-16 pt-6 sm:px-10">
        <p className="animate-fade-up font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl">
          Orca<span className="text-sky">Real</span>
        </p>

        <h1 className="animate-fade-up-delayed mt-5 max-w-3xl text-balance font-display text-2xl font-semibold leading-tight text-white/95 sm:text-4xl">
          Transforme custos e orçamento em decisões claras.
        </h1>

        <p className="animate-fade-up-late mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
          Plataforma de análise financeira focada em Orçado × Realizado —
          experimente antes de criar conta.
        </p>

        <div className="animate-fade-up-late mt-10 flex flex-wrap items-center gap-3">
          <Link to="/funcionalidades">
            <Button size="lg" variant="primary">
              Conhecer funcionalidades
            </Button>
          </Link>
          <Link to="/cadastro">
            <Button size="lg" variant="inverse">
              Começar agora
            </Button>
          </Link>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink/50 to-transparent"
        />
      </section>
    </div>
  )
}
