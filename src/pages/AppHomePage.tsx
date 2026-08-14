import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listUserCompanies } from '@/features/company/companyService'
import type { Company } from '@/types/database'
import { Button } from '@/components/ui/Button'

export function AppHomePage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    void listUserCompanies().then((data) => {
      if (!mounted) return
      setCompanies(data)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Área autenticada</h1>
      <p className="mt-2 max-w-2xl text-sm text-mist">
        Próximos passos do plano: onboarding personalizado e estrutura
        organizacional. Por enquanto, crie ou selecione sua empresa.
      </p>

      <div className="mt-8 rounded-2xl border border-paper-muted bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-navy">
            Suas empresas
          </h2>
          <Link to="/app/empresa">
            <Button>Criar empresa</Button>
          </Link>
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
              <li key={company.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-ink">{company.name}</p>
                  {company.trade_name ? (
                    <p className="text-xs text-mist">{company.trade_name}</p>
                  ) : null}
                </div>
                <span className="text-xs font-medium uppercase tracking-wide text-navy-bright">
                  Ativa
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
