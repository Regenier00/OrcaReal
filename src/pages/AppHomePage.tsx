import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { segmentLabel } from '@/features/company/segmentOptions'
import { formatCnpj } from '@/features/company/cnpj'
import { appModules } from '@/content/appModules'
import { Button } from '@/components/ui/Button'
import { FeatureIllustration } from '@/components/home/FeatureIllustration'

export function AppHomePage() {
  const {
    activeCompany,
    companies,
    companyProfile,
    segments,
    memberships,
    setActiveCompanyId,
  } = useCompany()

  const segment = segments.find((item) => item.id === companyProfile?.segment_id)
  const segmentName =
    companyProfile?.custom_segment ||
    segment?.name ||
    (segment ? segmentLabel(segment.code) : null)

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Início</h1>
      <p className="mt-2 max-w-2xl text-sm text-mist">
        Acompanhe o orçamento e os resultados da empresa ativa.
      </p>

      {activeCompany ? (
        <section className="mt-8 rounded-2xl border border-paper-muted bg-white p-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
            Empresa ativa
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-navy">
            Empresa: {activeCompany.trade_name || activeCompany.name}
          </h2>
          {activeCompany.trade_name && activeCompany.trade_name !== activeCompany.name ? (
            <p className="mt-1 text-sm text-mist">{activeCompany.name}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
            {activeCompany.document ? (
              <p>CNPJ: {formatCnpj(activeCompany.document)}</p>
            ) : null}
            {segmentName ? <p>Segmento: {segmentName}</p> : null}
          </div>

          {!companyProfile?.onboarding_completed ? (
            <div className="mt-6 rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">
              <p>Você ainda pode configurar departamentos e centros de custo.</p>
              <Link to="/app/configurar-ambiente" className="mt-3 inline-flex">
                <Button variant="secondary">Configure seu ambiente</Button>
              </Link>
            </div>
          ) : null}

          <div className="mt-6">
            <Link to="/app/empresa">
              <Button variant="secondary">Configurações da empresa</Button>
            </Link>
          </div>
        </section>
      ) : null}

      {activeCompany ? (
        <section className="mt-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
            Funcionalidades
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-navy">
            Tudo disponível para esta empresa
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-mist">
            Com usuário e empresa cadastrados, orçamento, realizado, a comparação
            e os indicadores ficam no mesmo ambiente.
          </p>

          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {appModules.map((module) => (
              <li key={module.id}>
                <Link
                  to={module.to}
                  className="flex h-full flex-col rounded-2xl border border-paper-muted bg-white p-6 transition hover:border-ink/20"
                >
                  <h3 className="font-display text-xl font-semibold text-ink">
                    {module.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft/75">
                    {module.summary}
                  </p>
                  <div className="mt-5 rounded-xl bg-paper px-4 py-4">
                    <FeatureIllustration id={module.id} />
                  </div>
                  <span className="mt-5 inline-flex items-center justify-center rounded-xl border border-paper-muted bg-white px-5 py-2.5 text-sm font-semibold text-ink">
                    Abrir
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {companies.length > 1 ? (
        <section className="mt-6 rounded-2xl border border-paper-muted bg-white p-6">
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
