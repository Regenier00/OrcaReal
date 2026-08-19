import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/useAuth'
import { getUserProfile } from '@/features/auth/profileService'
import { useCompany } from '@/features/company/useCompany'
import { updateCompanyLogo } from '@/features/company/companyService'
import { segmentLabel } from '@/features/company/segmentOptions'
import { monthResultGreeting } from '@/lib/greeting'
import { defaultUnitCostMonth } from '@/features/experience/unitCost'
import type { ComparisonMonthKey } from '@/features/comparison/model'
import { Button } from '@/components/ui/Button'
import { CompanyHero } from '@/components/home/CompanyHero'
import { QuickAccess } from '@/components/home/QuickAccess'
import { PersonalizedDashboard } from '@/components/experience/PersonalizedDashboard'
import { CompanyRequired } from '@/components/company/CompanyRequired'
import { PeriodFilter } from '@/components/comparison/PeriodFilter'
import { useUnitCostCards } from '@/features/experience/useUnitCostCards'

export function AppHomePage() {
  const { user } = useAuth()
  const {
    activeCompany,
    companies,
    companyProfile,
    segments,
    memberships,
    isAdmin,
    setActiveCompanyId,
    refresh,
  } = useCompany()
  const metadataName = String(user?.user_metadata?.name ?? '')
  const [profileName, setProfileName] = useState('')
  const [period, setPeriod] = useState<ComparisonMonthKey | null>(null)
  const dashboard = useUnitCostCards(
    period != null ? { preferredMonth: period } : undefined
  )

  useEffect(() => {
    if (dashboard.months.length === 0) return
    setPeriod((current) => {
      if (current === 'all') return current
      if (current && dashboard.months.some((item) => item.key === current)) return current
      return defaultUnitCostMonth(dashboard.months) ?? dashboard.months[dashboard.months.length - 1]?.key ?? 'all'
    })
  }, [dashboard.months])

  const selectedPeriod = period ?? dashboard.periodKey

  const segment = segments.find((item) => item.id === companyProfile?.segment_id)
  const segmentName =
    companyProfile?.custom_segment ||
    segment?.name ||
    (segment ? segmentLabel(segment.code) : null)
  const activity = companyProfile?.primary_activity?.trim() || null

  useEffect(() => {
    if (!user) return
    let mounted = true
    void getUserProfile(user.id).then((profile) => {
      if (!mounted) return
      setProfileName(profile?.name || '')
    })
    return () => {
      mounted = false
    }
  }, [user])

  const handleLogoChange = async (logoUrl: string | null) => {
    if (!activeCompany) return
    const result = await updateCompanyLogo({
      companyId: activeCompany.id,
      logoUrl,
    })
    if (!result.ok) {
      throw new Error(result.message)
    }
    await refresh()
  }

  if (!activeCompany) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-navy">Dashboard</h1>
        <div className="mt-6">
          <CompanyRequired message="Selecione ou crie uma empresa para ver o painel financeiro." />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <CompanyHero
        name={activeCompany.trade_name || activeCompany.name}
        segmentName={segmentName}
        activity={activity}
        periodLabel={dashboard.monthLabel || currentPeriodLabel()}
        logoUrl={activeCompany.logo_url}
        editable={isAdmin}
        onLogoChange={isAdmin ? handleLogoChange : undefined}
      />

      {dashboard.months.length > 0 ? (
        <PeriodFilter
          months={dashboard.months}
          value={selectedPeriod}
          onChange={setPeriod}
        />
      ) : null}

      <PersonalizedDashboard
        data={dashboard}
        greeting={monthResultGreeting(profileName || metadataName, user?.email)}
        isConsolidated={dashboard.isConsolidated}
      />

      <QuickAccess />

      {companies.length > 1 ? (
        <section className="rounded-2xl border border-paper-muted bg-white p-6 shadow-card">
          <h2 className="font-display text-xl font-semibold text-navy">
            Suas empresas
          </h2>
          <ul className="mt-4 divide-y divide-paper-muted">
            {memberships.map((membership) => {
              const active = membership.company_id === activeCompany.id
              return (
                <li
                  key={membership.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium text-ink">{membership.company.name}</p>
                    <p className="text-xs text-mist">
                      {membership.role === 'owner' || membership.role === 'admin'
                        ? 'Administrador'
                        : membership.role === 'viewer'
                          ? 'Visualizador'
                          : 'Membro'}
                    </p>
                  </div>
                  {active ? (
                    <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
                      Ativa
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => setActiveCompanyId(membership.company_id)}
                    >
                      Usar esta
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function currentPeriodLabel(now = new Date()) {
  const raw = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(now)
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
