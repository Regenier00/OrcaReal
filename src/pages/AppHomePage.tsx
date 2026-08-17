import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { Button } from '@/components/ui/Button'

export function AppHomePage() {
  const { companies, loading, selectCompany } = useCompany()

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Área autenticada</h1>
      <p className="mt-2 max-w-2xl text-sm text-mist">
        Crie a empresa e monte o orçamento do exercício — janeiro a dezembro —
        com a estrutura já cadastrada.
      </p>

      <div className="mt-8 rounded-2xl border border-paper-muted bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-navy">
            Suas empresas
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/orcamentos">
              <Button variant="secondary">Orçamentos</Button>
            </Link>
            <Link to="/app/empresa">
              <Button>Criar empresa</Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-mist">Carregando empresas...</p>
        ) : companies.length === 0 ? (
          <p className="mt-6 text-sm text-mist">
            Nenhuma empresa ainda. Crie a primeira para inicializar a estrutura
            padrão (departamentos, centros de custo, categorias e dashboard).
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-paper-muted">
            {companies.map((company) => (
              <li key={company.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-ink">{company.name}</p>
                  {company.trade_name ? (
                    <p className="text-xs text-mist">{company.trade_name}</p>
                  ) : null}
                </div>
                <Link
                  to="/app/orcamentos"
                  onClick={() => selectCompany(company.id)}
                  className="text-xs font-medium uppercase tracking-wide text-navy-bright hover:underline"
                >
                  Orçamentos
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
