import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FormulaChip } from '@/components/indicators/FormulaChip'
import { cn } from '@/lib/utils'
import { collectFormulasFromDom, mergeCollectedFormulas } from '@/features/tour/steps'
import { useTour } from '@/features/tour/useTour'
import { useTourTarget } from '@/features/tour/useTourTarget'

const PAD = 10

export function PlatformTour() {
  const {
    active,
    step,
    skip,
    complete,
    goNext,
    goBack,
    stepNumber,
    stepCount,
    isLast,
    nextLabel,
    skipLabel,
  } = useTour()
  const rect = useTourTarget(step?.target, `${step?.id ?? 'welcome'}:${step?.path ?? ''}`)
  const [liveFormulas, setLiveFormulas] = useState(step?.formulas ?? [])

  useEffect(() => {
    if (!active || !step) return
    const refresh = () => {
      const collected = step.collectFormulasFrom
        ? collectFormulasFromDom(step.collectFormulasFrom)
        : []
      setLiveFormulas(mergeCollectedFormulas(step.formulas, collected))
    }
    const frame = window.requestAnimationFrame(refresh)
    const timer = window.setTimeout(refresh, 360)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [active, step])

  if (!active || !step) return null

  const progressLabel = `${stepNumber} de ${stepCount}`

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <Spotlight rect={rect} />

      <div className="pointer-events-auto absolute inset-x-0 bottom-[4.75rem] z-10 flex justify-center px-4 sm:px-6">
        <section
          key={step.id}
          className="tour-card animate-fade-up w-full max-w-6xl overflow-hidden rounded-2xl border border-white/15 bg-navy text-white shadow-soft"
        >
          <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-8">
            <div className="min-w-0 lg:max-w-md lg:shrink-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky">
                  {step.kicker}
                </p>
                <p className="text-[11px] font-medium text-white/50">{progressLabel}</p>
              </div>
              {step.hook ? (
                <p className="mt-2 text-sm font-medium text-sky/90">{step.hook}</p>
              ) : null}
              <h2
                id="tour-title"
                className="mt-1 font-display text-xl font-semibold tracking-tight sm:text-2xl"
              >
                {step.title}
              </h2>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed text-white/78 sm:text-[15px]">{step.body}</p>

              {liveFormulas.length > 0 ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {liveFormulas.slice(0, 8).map((item) => (
                    <li
                      key={`${item.name}-${item.formula}`}
                      className="rounded-xl bg-white/8 px-3 py-2"
                    >
                      <p className="text-[11px] font-semibold text-white/80">{item.name}</p>
                      <FormulaChip
                        name={item.name}
                        formula={item.formula}
                        tone="dark"
                        capture={false}
                        className="mt-1"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {stepNumber > 1 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="!border-white/15 !bg-white/10 !text-white hover:!bg-white/16"
                    onClick={goBack}
                  >
                    Voltar
                  </Button>
                ) : null}
                <Button type="button" variant="inverse" onClick={isLast ? complete : goNext}>
                  {nextLabel}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <TourDock
        index={stepNumber - 1}
        total={stepCount}
        skipLabel={skipLabel}
        onSkip={skip}
        onBack={stepNumber > 1 ? goBack : undefined}
        onNext={isLast ? complete : goNext}
        nextLabel={nextLabel}
      />
    </div>
  )
}

function Spotlight({
  rect,
}: {
  rect: { top: number; left: number; width: number; height: number } | null
}) {
  if (!rect) {
    return <div className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]" />
  }

  return (
    <div
      className="tour-spotlight pointer-events-none absolute rounded-[1.35rem] ring-2 ring-white/80"
      style={{
        top: Math.max(8, rect.top - PAD),
        left: Math.max(8, rect.left - PAD),
        width: rect.width + PAD * 2,
        height: Math.min(rect.height + PAD * 2, window.innerHeight - 220),
        boxShadow: '0 0 0 9999px rgb(15 39 68 / 0.72)',
      }}
    />
  )
}

function TourDock({
  index,
  total,
  skipLabel,
  onSkip,
  onBack,
  onNext,
  nextLabel,
}: {
  index: number
  total: number
  skipLabel: string
  onSkip: () => void
  onBack?: () => void
  onNext: () => void
  nextLabel: string
}) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-navy/95 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="order-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky hover:bg-white/15 hover:text-sky sm:order-1"
        >
          {skipLabel}
        </button>

        <ol className="order-1 flex items-center justify-center gap-1.5 sm:order-2" aria-hidden>
          {Array.from({ length: total }, (_, item) => (
            <li
              key={item}
              className={cn(
                'h-1.5 rounded-full transition-all',
                item === index ? 'w-6 bg-sky' : item < index ? 'w-2 bg-white/55' : 'w-2 bg-white/20'
              )}
            />
          ))}
        </ol>

        <div className="order-3 flex flex-wrap items-center justify-end gap-2">
          {onBack ? (
            <Button
              type="button"
              variant="secondary"
              className="!border-white/15 !bg-white/10 !py-2 !text-xs !text-white hover:!bg-white/16"
              onClick={onBack}
            >
              Voltar
            </Button>
          ) : null}
          <Button type="button" variant="inverse" className="!py-2 !text-xs" onClick={onNext}>
            {nextLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
