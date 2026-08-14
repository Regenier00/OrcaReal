import { features, type FeatureId } from '@/content/features'
import { cn } from '@/lib/utils'

interface FeatureCardsProps {
  activeId: FeatureId
  onSelect: (id: FeatureId) => void
}

export function FeatureCards({ activeId, onSelect }: FeatureCardsProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {features.map((feature, index) => {
        const selected = feature.id === activeId
        return (
          <li key={feature.id}>
            <button
              type="button"
              onClick={() => onSelect(feature.id)}
              aria-pressed={selected}
              className={cn(
                'flex h-full w-full flex-col rounded-2xl border p-6 text-left transition duration-200',
                'outline-none focus-visible:border-ink/40',
                selected
                  ? 'border-ink/35 bg-white'
                  : 'border-paper-muted bg-white/80 hover:border-ink/20 hover:bg-white'
              )}
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-mist">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-3 font-display text-xl font-semibold text-ink">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft/75">
                {feature.summary}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
