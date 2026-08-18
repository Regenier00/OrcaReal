import { useMemo, useState } from 'react'
import { formatMoney } from '@/features/budget/money'
import { type MonthFinancials } from '@/features/home/dashboardModel'
import { SectionHeading } from '@/components/home/FinancialSummary'
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
  const active = series.find((item) => item.key === activeKey) ?? series[series.length - 1]

  const geometry = useMemo(() => {
    const width = 640
    const height = 248
    const pad = { top: 18, right: 12, bottom: 34, left: 52 }
    const innerWidth = width - pad.left - pad.right
    const innerHeight = height - pad.top - pad.bottom
    const maxValue = Math.max(
      1,
      ...series.flatMap((item) => [item.budgeted, item.realized])
    )
    const slot = series.length === 0 ? innerWidth : innerWidth / series.length
    const pairWidth = Math.min(slot * 0.72, 52)
    const barWidth = pairWidth * 0.44
    const barGap = pairWidth - barWidth * 2
    const y = (value: number) =>
      pad.top + innerHeight - (Math.max(0, value) / maxValue) * innerHeight
    const groupX = (index: number) =>
      pad.left + index * slot + (slot - pairWidth) / 2
    const ticks = [0, 0.5, 1].map((ratio) => ({
      value: maxValue * ratio,
      y: y(maxValue * ratio),
    }))

    return {
      width,
      height,
      pad,
      innerHeight,
      innerWidth,
      slot,
      pairWidth,
      barWidth,
      barGap,
      y,
      groupX,
      ticks,
    }
  }, [series])

  return (
    <section className="rounded-2xl border border-paper-muted bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          kicker="Evolução"
          title="Orçado × realizado por mês"
          subtitle="Compare o total planejado com o total executado em cada mês."
        />
        <ul className="flex flex-wrap gap-3 text-xs font-medium text-mist">
          <LegendDot className="bg-navy-soft" label="Orçado" />
          <LegendDot className="bg-navy" label="Realizado" />
        </ul>
      </div>

      {loading && series.length === 0 ? (
        <div className="mt-6 h-52 animate-pulse rounded-xl bg-paper" />
      ) : !ready ? (
        <div className="mt-6 rounded-xl bg-paper px-4 py-10 text-center">
          <p className="font-display text-base font-semibold text-navy">
            Sem série para exibir
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-mist">
            Quando houver orçamento ou lançamentos apropriados, o gráfico compara
            o total orçado com o total realizado mês a mês.
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="h-auto w-full"
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
                  x={geometry.pad.left - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="fill-mist text-[10px]"
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
                    rx="2"
                    className={selected ? 'fill-sky' : 'fill-navy-soft'}
                  />
                  <rect
                    x={realizedX}
                    y={geometry.y(item.realized)}
                    width={geometry.barWidth}
                    height={realizedHeight}
                    rx="2"
                    className={selected ? 'fill-navy-mid' : 'fill-navy'}
                  />
                  <rect
                    x={x - 4}
                    y={geometry.pad.top}
                    width={geometry.pairWidth + 8}
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
                    y={geometry.height - 10}
                    textAnchor="middle"
                    className={cn(
                      'text-[10px]',
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
            <div className="mt-4 grid gap-3 rounded-xl bg-paper px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
              <ChartStat label={active.label} value="Mês em foco" muted />
              <ChartStat label="Orçado" value={formatMoney(active.budgeted)} />
              <ChartStat label="Realizado" value={formatMoney(active.realized)} />
              <ChartStat label="Desvio" value={formatMoney(active.variance)} />
            </div>
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
      <span className={cn('h-2.5 w-2.5 rounded-sm', className)} />
      {label}
    </li>
  )
}

function ChartStat({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mist">
        {muted ? value : label}
      </p>
      <p className={cn('mt-1 font-numeric text-sm font-semibold', muted ? 'text-navy' : 'text-ink')}>
        {muted ? label : value}
      </p>
    </div>
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
