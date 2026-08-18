import { useMemo, useState } from 'react'
import { formatMoney } from '@/features/budget/money'
import { hasAnyAmount, type MonthFinancials } from '@/features/home/dashboardModel'
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
  const ready = hasAnyAmount(series)
  const showRevenue = series.some((item) => item.revenue !== 0)
  const active = series.find((item) => item.key === activeKey) ?? series[series.length - 1]

  const geometry = useMemo(() => {
    const width = 640
    const height = 248
    const pad = { top: 18, right: 12, bottom: 34, left: 52 }
    const innerWidth = width - pad.left - pad.right
    const innerHeight = height - pad.top - pad.bottom
    const maxValue = Math.max(
      1,
      ...series.flatMap((item) => [
        item.budgeted,
        item.realized,
        showRevenue ? item.revenue : 0,
      ])
    )
    const x = (index: number) =>
      pad.left + (series.length <= 1 ? innerWidth / 2 : (index / (series.length - 1)) * innerWidth)
    const y = (value: number) =>
      pad.top + innerHeight - (Math.max(0, value) / maxValue) * innerHeight

    const ticks = [0, 0.5, 1].map((ratio) => ({
      value: maxValue * ratio,
      y: y(maxValue * ratio),
    }))

    return { width, height, pad, innerHeight, innerWidth, x, y, ticks, maxValue }
  }, [series, showRevenue])

  return (
    <section className="rounded-2xl border border-paper-muted bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          kicker="Evolução"
          title="Orçado e realizado no tempo"
          subtitle="Acompanhe o ritmo do plano e das saídas mês a mês."
        />
        <ul className="flex flex-wrap gap-3 text-xs font-medium text-mist">
          <LegendDot className="bg-navy" label="Realizado" />
          <LegendDot className="border border-sky bg-transparent" label="Orçado" />
          {showRevenue ? <LegendDot className="bg-ok" label="Receita" /> : null}
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
            Quando houver orçamento ou lançamentos apropriados, o gráfico mostra a
            evolução financeira da empresa.
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <svg
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            className="h-auto w-full"
            role="img"
            aria-label="Gráfico de evolução financeira"
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

            <path
              d={areaPath(series, geometry.x, geometry.y, geometry.height - geometry.pad.bottom)}
              className="fill-navy/10"
            />
            <path
              d={linePath(series, geometry.x, (item) => geometry.y(item.realized))}
              className="stroke-navy"
              fill="none"
              strokeWidth="2.4"
            />
            <path
              d={linePath(series, geometry.x, (item) => geometry.y(item.budgeted))}
              className="stroke-sky"
              fill="none"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
            {showRevenue ? (
              <path
                d={linePath(series, geometry.x, (item) => geometry.y(item.revenue))}
                className="stroke-ok"
                fill="none"
                strokeWidth="1.8"
              />
            ) : null}

            {series.map((item, index) => {
              const cx = geometry.x(index)
              const selected = active?.key === item.key
              return (
                <g key={item.key}>
                  <circle
                    cx={cx}
                    cy={geometry.y(item.realized)}
                    r={selected ? 4.5 : 3.2}
                    className="fill-navy"
                  />
                  <rect
                    x={cx - 18}
                    y={geometry.pad.top}
                    width="36"
                    height={geometry.innerHeight}
                    className="cursor-pointer fill-transparent"
                    onMouseEnter={() => setActiveKey(item.key)}
                    onFocus={() => setActiveKey(item.key)}
                  />
                  <text
                    x={cx}
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
              <ChartStat label={active.label} value="Período em foco" muted />
              <ChartStat label="Realizado" value={formatMoney(active.realized)} />
              <ChartStat label="Orçado" value={formatMoney(active.budgeted)} />
              {showRevenue ? (
                <ChartStat label="Receita" value={formatMoney(active.revenue)} />
              ) : (
                <ChartStat
                  label="Desvio"
                  value={formatMoney(active.variance)}
                />
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-full', className)} />
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

function linePath(
  series: MonthFinancials[],
  x: (index: number) => number,
  y: (item: MonthFinancials) => number
) {
  return series
    .map((item, index) => {
      const command = index === 0 ? 'M' : 'L'
      return `${command}${x(index)} ${y(item)}`
    })
    .join(' ')
}

function areaPath(
  series: MonthFinancials[],
  x: (index: number) => number,
  y: (value: number) => number,
  baseline: number
) {
  if (series.length === 0) return ''
  const line = series
    .map((item, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${y(item.realized)}`)
    .join(' ')
  return `${line} L${x(series.length - 1)} ${baseline} L${x(0)} ${baseline} Z`
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
