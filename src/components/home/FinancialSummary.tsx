import { formatMoney } from '@/features/budget/money'
import { formatPct } from '@/lib/money'
import { changeRatio, type MonthFinancials } from '@/features/home/dashboardModel'
import { KpiCard } from '@/components/home/KpiCard'
import {
  ReceiptIcon,
  ScaleIcon,
  TrendUpIcon,
  WalletIcon,
} from '@/components/home/DashboardIcons'

export function FinancialSummary({
  current,
  previous,
  monthLabel,
  loading,
}: {
  current: MonthFinancials | null
  previous: MonthFinancials | null
  monthLabel: string
  loading?: boolean
}) {
  if (loading && !current) {
    return (
      <section>
        <SectionHeading
          kicker="Resumo financeiro"
          title="Principais indicadores do mês"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-2xl border border-paper-muted bg-white"
            />
          ))}
        </div>
      </section>
    )
  }

  const profitTone =
    !current || current.revenue === 0
      ? 'navy'
      : current.profit >= 0
        ? 'ok'
        : 'danger'
  const varianceTone =
    !current || current.budgeted === 0
      ? 'navy'
      : current.variance > 0
        ? 'danger'
        : current.variance < 0
          ? 'ok'
          : 'navy'

  return (
    <section>
      <SectionHeading
        kicker="Resumo financeiro"
        title="Principais indicadores do mês"
        subtitle={
          monthLabel
            ? `Leitura consolidada de ${monthLabel}.`
            : 'Leitura consolidada do período ativo.'
        }
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          to="/app/orcado-realizado"
          kicker="Receita"
          title="Entradas do período"
          value={formatMoney(current?.revenue ?? 0)}
          hint={
            previous
              ? `Anterior: ${formatMoney(previous.revenue)}`
              : 'Receitas apropriadas no mês'
          }
          change={changeRatio(current?.revenue ?? Number.NaN, previous?.revenue)}
          icon={<WalletIcon />}
        />
        <KpiCard
          to="/app/orcado-realizado"
          kicker="Custos e despesas"
          title="Saídas realizadas"
          value={formatMoney(current?.realized ?? 0)}
          hint={
            previous
              ? `Anterior: ${formatMoney(previous.realized)}`
              : 'Custos e despesas do mês'
          }
          change={changeRatio(current?.realized ?? Number.NaN, previous?.realized)}
          invertChange
          icon={<ReceiptIcon />}
          tone="warn"
        />
        <KpiCard
          to="/app/indicadores"
          kicker="Resultado"
          title="Receita menos saídas"
          value={formatMoney(current?.profit ?? 0)}
          hint={
            current?.margin != null
              ? `Margem de ${formatPct(current.margin)}`
              : 'Informe a receita para ver a margem'
          }
          change={changeRatio(current?.profit ?? Number.NaN, previous?.profit)}
          icon={<TrendUpIcon />}
          tone={profitTone}
        />
        <KpiCard
          to="/app/orcado-realizado"
          kicker="Desvio"
          title="Realizado × orçado"
          value={formatMoney(current?.variance ?? 0)}
          hint={
            current?.variancePct != null
              ? `${formatPct(Math.abs(current.variancePct))} em relação ao plano`
              : 'Crie um orçamento para comparar'
          }
          change={current?.variancePct ?? null}
          invertChange
          icon={<ScaleIcon />}
          tone={varianceTone}
        />
      </div>
    </section>
  )
}

export function SectionHeading({
  kicker,
  title,
  subtitle,
}: {
  kicker: string
  title: string
  subtitle?: string
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-bright">
        {kicker}
      </p>
      <h2 className="mt-1 font-display text-lg font-semibold text-navy sm:text-xl">
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-sm text-mist">{subtitle}</p> : null}
    </div>
  )
}
