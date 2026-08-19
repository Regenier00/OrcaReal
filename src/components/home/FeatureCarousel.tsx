import { useEffect, useRef, useState } from 'react'
import { features, type FeatureId } from '@/content/features'
import { FeatureIllustration } from '@/components/home/FeatureIllustration'
import { cn } from '@/lib/utils'

const INTERVAL_MS = 7000

interface FeatureCarouselProps {
  activeId: FeatureId
  onChange: (id: FeatureId) => void
}

export function FeatureCarousel({ activeId, onChange }: FeatureCarouselProps) {
  const index = features.findIndex((feature) => feature.id === activeId)
  const current = features[index] ?? features[0]
  const [paused, setPaused] = useState(false)
  const regionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (media.matches || paused) return

    const timer = window.setInterval(() => {
      const next = (index + 1) % features.length
      onChange(features[next].id)
    }, INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [index, onChange, paused])

  const goTo = (nextIndex: number) => {
    const wrapped = (nextIndex + features.length) % features.length
    onChange(features[wrapped].id)
  }

  return (
    <div
      ref={regionRef}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Explicação das funcionalidades"
      className="rounded-2xl border border-paper-muted bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!regionRef.current?.contains(event.relatedTarget as Node)) {
          setPaused(false)
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
          Como funciona
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Funcionalidade anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-paper-muted text-ink/70 outline-none transition hover:border-ink/25 hover:text-ink focus-visible:border-ink/40"
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Próxima funcionalidade"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-paper-muted text-ink/70 outline-none transition hover:border-ink/25 hover:text-ink focus-visible:border-ink/40"
          >
            <Chevron direction="right" />
          </button>
        </div>
      </div>

      <div
        key={current.id}
        className="animate-fade-up mt-6 grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <div>
          <h3 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
            {current.title}
          </h3>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft/80 sm:text-base">
            {current.explanation}
          </p>
          <p className="mt-4 text-sm text-mist">{current.detail}</p>
        </div>
        <div className="rounded-xl border border-paper-muted bg-white px-5 py-6">
          <FeatureIllustration id={current.id} />
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-2" role="tablist">
        {features.map((feature, featureIndex) => (
          <button
            key={feature.id}
            type="button"
            role="tab"
            aria-selected={feature.id === current.id}
            aria-label={feature.title}
            onClick={() => onChange(feature.id)}
            className={cn(
              'h-1.5 rounded-full outline-none transition-all duration-300',
              feature.id === current.id
                ? 'w-8 bg-brand'
                : 'w-3 bg-paper-muted hover:bg-brand/30'
            )}
          >
            <span className="sr-only">
              {featureIndex + 1}. {feature.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="h-4 w-4"
    >
      <path
        d={direction === 'left' ? 'M12.5 4.5 7 10l5.5 5.5' : 'M7.5 4.5 13 10l-5.5 5.5'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
