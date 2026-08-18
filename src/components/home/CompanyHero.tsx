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
    <section className="rounded-3xl bg-navy bg-dashboard-hero text-white shadow-soft">
      <div className="flex flex-col gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <div className="rounded-full ring-2 ring-white/25">
            <CompanyLogoAvatar
              name={name}
              logoUrl={logoUrl}
              editable={editable}
              onChange={editable ? onLogoChange : undefined}
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
              Empresa ativa
            </p>
            <h1 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {segmentName ? (
                <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                  {segmentName}
                </span>
              ) : null}
              {activity ? (
                <span className="truncate text-sm text-white/70">{activity}</span>
              ) : null}
            </div>
          </div>
        </div>

        {periodLabel ? (
          <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/85 lg:self-end">
            <CalendarIcon className="h-4 w-4 text-white/70" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                Período
              </p>
              <p className="font-medium text-white">{periodLabel}</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
