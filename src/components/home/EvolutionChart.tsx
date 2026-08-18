import { useMemo, useState } from 'react'
import { formatMoney } from '@/features/budget/money'
import { type MonthFinancials } from '@/features/home/dashboardModel'
import { cn } from '@/lib/utils'

export function EvolutionChart({
  series,
  loading,
}: {
  series: MonthFinancials[]
  loading?: boolean
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const ready = series.some((item) => item.budgeted !== 0 || item.realized !== 0)
  const fallback =
    [...series].reverse().find((item) => item.realized !== 0) ?? series[series.length - 1]
  const active = series.find((item) => item.key === activeKey) ?? fallback

  const geometry = useMemo(() => {
    const width = 640
    const height = 118
    const pad = { top: 6, right: 8, bottom: 18, left: 34 }
    const innerWidth = width - pad.left - pad.right
    const innerHeight = height - pad.top - pad.bottom
    const maxValue = Math.max(
      1,
      ...series.flatMap((item) => [item.budgeted, item.realized])
    )
    const slot = series.length === 0 ? innerWidth : innerWidth / series.length
    const pairWidth = Math.min(slot * 0.72, 28)
    const barWidth = pairWidth * 0.44
    const barGap = pairWidth - barWidth * 2
    const y = (value: number) =>
      pad.top + innerHeight - (Math.max(0, value) / maxValue) * innerHeight
    const groupX = (index: number) =>
      pad.left + index * slot + (slot - pairWidth) / 2
    const ticks = [0, 1].map((ratio) => ({
      value: maxValue * ratio,
      y: y(maxValue * ratio),
    }))

    return {
      width,
      height,
      pad,
      innerHeight,
      pairWidth,
      barWidth,
      barGap,
      y,
      groupX,
      ticks,
    }
  }, [series])

  return (
    <section className="rounded-2xl border border-paper-muted bg-white px-4 py-3 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-bright">
            Evolução
          </p>
          <h2 className="mt-0.5 font-display text-sm font-semibold text-navy">
            Orçado × realizado por mês
          </h2>
        </div>
        <ul className="flex flex-wrap gap-3 text-[11px] font-medium text-mist">
          <LegendDot className="bg-navy-soft" label="Orçado" />
          <LegendDot className="bg-navy" label="Realizado" />
        </ul>
      </div>

      {loading && series.length === 0 ? (
        <div className="mt-3 h-[10rem] animate-pulse rounded-xl bg-paper" />
      ) : !ready ? (
        <div className="mt-3 rounded-xl bg-paper px-3 py-4 text-center">
          <p className="text-sm text-mist">
            Quando houver orçamento, o gráfico mostra todos os meses planejados.
          </p>
        </div>
      ) : (
        <div className="mt-2">
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="h-[10rem] w-full"
            role="img"
            aria-label="Gráfico de barras comparando orçado e realizado por mês"
          >
            {geometry.ticks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={geometry.pad.left}
                  x2={geometry.width - geometry.pad.right}
                  y1={tick.y}
                  y2={tick.y}
                  className="stroke-paper-muted"
                />
                <text
                  x={geometry.pad.left - 6}
                  y={tick.y + 3}
                  textAnchor="end"
                  className="fill-mist text-[9px]"
                >
                  {compactBRL(tick.value)}
                </text>
              </g>
            ))}

            {series.map((item, index) => {
              const selected = active?.key === item.key
              const x = geometry.groupX(index)
              const realizedX = x + geometry.barWidth + geometry.barGap
              const budgetHeight = barHeight(item.budgeted, geometry)
              const realizedHeight = barHeight(item.realized, geometry)

              return (
                <g key={item.key}>
                  <rect
                    x={x}
                    y={geometry.y(item.budgeted)}
                    width={geometry.barWidth}
                    height={budgetHeight}
                    rx="1.5"
                    className={selected ? 'fill-sky' : 'fill-navy-soft'}
                  />
                  <rect
                    x={realizedX}
                    y={geometry.y(item.realized)}
                    width={geometry.barWidth}
                    height={realizedHeight}
                    rx="1.5"
                    className={selected ? 'fill-navy-mid' : 'fill-navy'}
                  />
                  <rect
                    x={x - 3}
                    y={geometry.pad.top}
                    width={geometry.pairWidth + 6}
                    height={geometry.innerHeight}
                    className="cursor-pointer fill-transparent"
                    onMouseEnter={() => setActiveKey(item.key)}
                    onFocus={() => setActiveKey(item.key)}
                  >
                    <title>
                      {item.label}: orçado {formatMoney(item.budgeted)}, realizado{' '}
                      {formatMoney(item.realized)}
                    </title>
                  </rect>
                  <text
                    x={x + geometry.pairWidth / 2}
                    y={geometry.height - 4}
                    textAnchor="middle"
                    className={cn(
                      'text-[9px]',
                      selected ? 'fill-navy font-semibold' : 'fill-mist'
                    )}
                  >
                    {item.shortLabel}
                  </text>
                </g>
              )
            })}
          </svg>

          {active ? (
            <p className="mt-1.5 font-numeric text-xs text-mist">
              <span className="font-medium text-navy">{active.label}</span>
              {' · '}orçado {formatMoney(active.budgeted)}
              {' · '}realizado {formatMoney(active.realized)}
              {' · '}desvio {formatMoney(active.variance)}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}

function barHeight(
  value: number,
  geometry: { pad: { top: number }; innerHeight: number; y: (value: number) => number }
) {
  return Math.max(0, geometry.pad.top + geometry.innerHeight - geometry.y(value))
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-sm', className)} />
      {label}
    </li>
  )
}

function compactBRL(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  }
  if (abs >= 1_000) {
    return `${Math.round(value / 1_000).toLocaleString('pt-BR')} mil`
  }
  return Math.round(value).toLocaleString('pt-BR')
}
