import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { Button } from '@/components/ui/Button'
import { FeatureCards } from '@/components/home/FeatureCards'
import { FeatureCarousel } from '@/components/home/FeatureCarousel'
import { features, type FeatureId } from '@/content/features'

export function HomePage() {
  const [activeId, setActiveId] = useState<FeatureId>(features[0].id)

  const selectFeature = useCallback((id: FeatureId) => {
    setActiveId(id)
    document.getElementById('como-funciona')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }, [])

  return (
    <div className="min-h-svh bg-paper text-ink">
      <div className="relative overflow-hidden bg-hero-atmosphere text-paper">
        <div
          aria-hidden
          className="animate-glow-pulse pointer-events-none absolute -left-28 top-16 h-80 w-80 rounded-full bg-white/[0.04] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-navy-mid/40 blur-3xl"
        />

        <PublicHeader />

        <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-10 sm:px-10 sm:pb-24 sm:pt-16">
          <p className="animate-fade-up font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl md:text-7xl">
            Orca<span className="text-sky">Real</span>
          </p>

          <h1 className="animate-fade-up-delayed mt-5 max-w-3xl text-balance font-display text-2xl font-semibold leading-tight text-white/92 sm:text-4xl">
            Transforme custos e orçamento em decisões claras.
          </h1>

          <p className="animate-fade-up-late mt-5 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
            Plataforma de análise financeira focada em Orçado × Realizado —
            experimente antes de criar conta.
          </p>

          <div className="animate-fade-up-late mt-10 flex flex-wrap items-center gap-3">
            <Link to="/cadastro">
              <Button size="lg" variant="inverse">
                Começar agora
              </Button>
            </Link>
            <a href="#funcionalidades">
              <Button size="lg" variant="ghost">
                Ver funcionalidades
              </Button>
            </a>
          </div>
        </section>
      </div>

      <section
        id="funcionalidades"
        className="mx-auto max-w-6xl scroll-mt-8 px-6 py-16 sm:px-10 sm:py-20"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
          Funcionalidades
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold text-ink sm:text-4xl">
          O essencial para acompanhar o plano e o realizado.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft/70 sm:text-base">
          Escolha um card para ver a explicação no carrossel.
        </p>

        <div className="mt-10">
          <FeatureCards activeId={activeId} onSelect={selectFeature} />
        </div>

        <div id="como-funciona" className="mt-8 scroll-mt-8">
          <FeatureCarousel activeId={activeId} onChange={setActiveId} />
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <Link to="/funcionalidades">
            <Button variant="secondary">Ver detalhes</Button>
          </Link>
          <Link to="/cadastro">
            <Button>Criar conta</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
