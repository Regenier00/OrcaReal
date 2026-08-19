import { CompanyLogoAvatar } from '@/components/company/CompanyLogoAvatar'
import { CalendarIcon } from '@/components/home/DashboardIcons'

export function CompanyHero({
  name,
  segmentName,
  activity,
  periodLabel,
  logoUrl,
  editable,
  onLogoChange,
}: {
  name: string
  segmentName: string | null
  activity: string | null
  periodLabel: string
  logoUrl: string | null
  editable: boolean
  onLogoChange?: (logoUrl: string | null) => Promise<void>
}) {
  return (
    <section
      data-tour="hero"
      className="rounded-2xl border border-paper-muted bg-white text-ink shadow-card"
    >
      <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="rounded-full ring-2 ring-brand/20">
            <CompanyLogoAvatar
              name={name}
              logoUrl={logoUrl}
              editable={editable}
              onChange={editable ? onLogoChange : undefined}
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              Empresa ativa
            </p>
            <h1 className="mt-0.5 truncate font-display text-xl font-semibold tracking-tight text-navy sm:text-2xl">
              {name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {segmentName ? (
                <span className="inline-flex rounded-full bg-brand-soft px-3 py-0.5 text-xs font-medium text-brand">
                  {segmentName}
                </span>
              ) : null}
              {activity ? (
                <span className="truncate text-sm text-mist">{activity}</span>
              ) : null}
            </div>
          </div>
        </div>

        {periodLabel ? (
          <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-paper-muted bg-paper px-3 py-2 text-sm text-ink-soft lg:self-center">
            <CalendarIcon className="h-4 w-4 text-brand" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">
                Período
              </p>
              <p className="font-medium text-navy">{periodLabel}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
