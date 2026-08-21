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
      <div className="relative overflow-hidden border-b border-paper-muted bg-white">
        <div
          aria-hidden
          className="animate-glow-pulse pointer-events-none absolute -left-28 top-8 h-56 w-56 rounded-full bg-brand/[0.08] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-brand/[0.05] blur-3xl"
        />

        <PublicHeader />

        <section className="relative z-10 mx-auto max-w-6xl px-6 pb-10 pt-6 sm:px-10 sm:pb-12 sm:pt-8">
          <p className="animate-fade-up font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl md:text-6xl">
            Orca<span className="text-brand">Real</span>
          </p>

          <h1 className="animate-fade-up-delayed mt-4 max-w-3xl text-balance font-display text-2xl font-semibold leading-tight text-navy sm:text-3xl">
            Transforme custos e orçamento em decisões claras.
          </h1>

          <p className="animate-fade-up-late mt-4 max-w-xl text-base leading-relaxed text-mist sm:text-lg">
            Você define quanto pretende gastar. O sistema acompanha automaticamente
            onde o dinheiro está indo e mostra onde você está fugindo do planejado.
          </p>

          <div className="animate-fade-up-late mt-7 flex flex-wrap items-center gap-3">
            <Link to="/demo">
              <Button size="lg">Experimentar sem conta</Button>
            </Link>
            <Link to="/cadastro">
              <Button size="lg" variant="secondary">
                Criar conta
              </Button>
            </Link>
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
          <Link to="/demo">
            <Button>Experimentar sem conta</Button>
          </Link>
          <Link to="/funcionalidades">
            <Button variant="secondary">Ver detalhes</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
