import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { FormulaChip } from '@/components/indicators/FormulaChip'
import { cn } from '@/lib/utils'
import {
  collectFormulasFromDom,
  mergeCollectedFormulas,
  TOUR_STEPS,
  TOUR_SKIP_LABEL,
} from '@/features/tour/steps'
import { useTour } from '@/features/tour/useTour'
import { useTourTarget } from '@/features/tour/useTourTarget'
import { ACTUAL_PATHS } from '@/features/actual/model'

const PAD = 10
const DOCK_SPACE = 108

export function PlatformTour() {
  const { active, skip, complete } = useTour()
  const [index, setIndex] = useState(0)
  const step = TOUR_STEPS[index] ?? TOUR_STEPS[0]
  const rect = useTourTarget(step?.target, step?.id ?? 'welcome')
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
    const timer = window.setTimeout(refresh, 320)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [active, step])


  const cardStyle = useMemo(() => {
    if (!step || step.placement === 'center' || !rect) return null
    const cardWidth = Math.min(420, window.innerWidth - 32)
    const left = Math.min(
      Math.max(16, rect.left + rect.width / 2 - cardWidth / 2),
      window.innerWidth - cardWidth - 16
    )
    const belowTop = rect.top + rect.height + PAD + 16
    const spaceBelow = window.innerHeight - belowTop - DOCK_SPACE
    if (spaceBelow > 220) {
      return { top: belowTop, left, width: cardWidth }
    }
    return {
      bottom: Math.max(DOCK_SPACE, window.innerHeight - rect.top + 16),
      left,
      width: cardWidth,
    }
  }, [rect, step])

  if (!active || !step) return null

  const last = index === TOUR_STEPS.length - 1
  const progressLabel = `${index + 1} de ${TOUR_STEPS.length}`

  const goNext = () => {
    if (last) {
      complete()
      return
    }
    setIndex((current) => Math.min(current + 1, TOUR_STEPS.length - 1))
  }

  const goBack = () => {
    setIndex((current) => Math.max(current - 1, 0))
  }

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <Spotlight rect={rect} centered={step.placement === 'center'} />

      <div
        className={cn(
          'pointer-events-auto absolute z-10 px-1',
          step.placement === 'center' || !cardStyle
            ? 'left-1/2 top-[18%] w-[min(28rem,calc(100%-2rem))] -translate-x-1/2'
            : ''
        )}
        style={step.placement === 'center' || !cardStyle ? undefined : cardStyle}
      >
        <section
          key={step.id}
          className="tour-card animate-fade-up max-h-[min(32rem,calc(100vh-9rem))] overflow-y-auto rounded-3xl border border-white/15 bg-navy p-5 text-white shadow-soft sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky">
              {step.kicker}
            </p>
            <p className="text-[11px] font-medium text-white/50">{progressLabel}</p>
          </div>
          {step.hook ? (
            <p className="mt-3 text-sm font-medium text-sky/90">{step.hook}</p>
          ) : null}
          <h2 id="tour-title" className="mt-2 font-display text-2xl font-semibold tracking-tight">
            {step.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/72">{step.body}</p>

          {liveFormulas.length > 0 ? (
            <ul className="mt-4 grid gap-2">
              {liveFormulas.slice(0, 6).map((item) => (
                <li
                  key={`${item.name}-${item.formula}`}
                  className="rounded-2xl bg-white/8 px-3 py-2"
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

          {step.highlights && step.highlights.length > 0 ? (
            <ul className="mt-4 grid gap-1.5">
              {step.highlights.map((item) => (
                <li
                  key={item}
                  className="rounded-xl bg-white/8 px-3 py-2 text-sm text-white/80"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          {step.finish ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/app/orcamentos/novo" onClick={complete}>
                <Button variant="inverse">{step.nextLabel}</Button>
              </Link>
              <Link to={ACTUAL_PATHS.import} onClick={complete}>
                <Button variant="secondary" className="!border-white/15 !bg-white/10 !text-white hover:!bg-white/16">
                  Importar extrato
                </Button>
              </Link>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap gap-2">
              {index > 0 ? (
                <Button type="button" variant="secondary" className="!border-white/15 !bg-white/10 !text-white hover:!bg-white/16" onClick={goBack}>
                  Voltar
                </Button>
              ) : null}
              <Button type="button" variant="inverse" onClick={goNext}>
                {step.nextLabel}
              </Button>
            </div>
          )}
        </section>
      </div>

      <TourDock
        index={index}
        total={TOUR_STEPS.length}
        last={last}
        onSkip={skip}
        onBack={index > 0 ? goBack : undefined}
        onNext={step.finish ? complete : goNext}
        nextLabel={step.finish ? 'Explorar sozinho' : step.nextLabel}
      />
    </div>
  )
}

function Spotlight({
  rect,
  centered,
}: {
  rect: { top: number; left: number; width: number; height: number } | null
  centered: boolean
}) {
  if (centered || !rect) {
    return <div className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]" />
  }

  return (
    <div
      className="tour-spotlight pointer-events-none absolute rounded-[1.35rem] ring-2 ring-white/80"
      style={{
        top: Math.max(8, rect.top - PAD),
        left: Math.max(8, rect.left - PAD),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
        boxShadow: '0 0 0 9999px rgb(15 39 68 / 0.72)',
      }}
    />
  )
}

function TourDock({
  index,
  total,
  last,
  onSkip,
  onBack,
  onNext,
  nextLabel,
}: {
  index: number
  total: number
  last: boolean
  onSkip: () => void
  onBack?: () => void
  onNext: () => void
  nextLabel: string
}) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-navy/95 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="order-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky hover:bg-white/15 hover:text-sky sm:order-1"
        >
          {TOUR_SKIP_LABEL}
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
            {last ? 'Explorar sozinho' : nextLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
