import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { updateCompanyLogo } from '@/features/company/companyService'
import { segmentLabel } from '@/features/company/segmentOptions'
import { appModules } from '@/content/appModules'
import { Button } from '@/components/ui/Button'
import { CompanyLogoAvatar } from '@/components/company/CompanyLogoAvatar'
import { PersonalizedDashboard } from '@/components/experience/PersonalizedDashboard'

export function AppHomePage() {
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

  const segment = segments.find((item) => item.id === companyProfile?.segment_id)
  const segmentName =
    companyProfile?.custom_segment ||
    segment?.name ||
    (segment ? segmentLabel(segment.code) : null)
  const activity = companyProfile?.primary_activity?.trim() || null

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

  return (
    <div>
      {activeCompany ? (
        <section className="rounded-2xl border border-danger bg-white px-5 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <CompanyLogoAvatar
              name={activeCompany.trade_name || activeCompany.name}
              logoUrl={activeCompany.logo_url}
              editable={isAdmin}
              onChange={isAdmin ? handleLogoChange : undefined}
            />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-mist">
                Empresa ativa
              </p>
              <h1 className="mt-1 truncate font-display text-2xl font-semibold text-navy sm:text-3xl">
                {activeCompany.trade_name || activeCompany.name}
              </h1>
              {segmentName || activity ? (
                <p className="mt-1 truncate text-sm text-mist">
                  {segmentName ? `Ramo: ${segmentName}` : null}
                  {segmentName && activity ? ' · ' : null}
                  {activity ? `Atividade: ${activity}` : null}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <h1 className="font-display text-3xl font-bold text-ink">Dashboard</h1>
      )}

      {activeCompany ? <PersonalizedDashboard /> : null}

      {activeCompany ? (
        <section className="mt-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-mist">
            Atalhos
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {appModules.map((module) => (
              <Link
                key={module.id}
                to={module.to}
                className="rounded-full border border-paper-muted bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/20 hover:bg-paper"
              >
                {module.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {companies.length > 1 ? (
        <section className="mt-8 rounded-2xl border border-paper-muted bg-white p-6">
          <h2 className="font-display text-xl font-semibold text-navy">
            Suas empresas
          </h2>
          <ul className="mt-4 divide-y divide-paper-muted">
            {memberships.map((membership) => {
              const active = membership.company_id === activeCompany?.id
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
                    <span className="text-xs font-medium uppercase tracking-wide text-navy-bright">
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
