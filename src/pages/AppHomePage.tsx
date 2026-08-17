import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { segmentLabel } from '@/features/company/segmentOptions'
import { formatCnpj } from '@/features/company/cnpj'
import { Button } from '@/components/ui/Button'

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

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/app/orcamentos">
              <Button>Orçamentos</Button>
            </Link>
            <Link to="/app/empresa">
              <Button variant="secondary">Configurações da empresa</Button>
            </Link>
          </div>
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
