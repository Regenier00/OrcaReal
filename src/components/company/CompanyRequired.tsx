import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useCompany } from '@/features/company/useCompany'

export function CompanyRequired({
  message,
}: {
  message?: string
}) {
  const { loading, companies } = useCompany()

  if (loading) {
    return <p className="text-sm text-mist">Carregando empresa...</p>
  }

  return (
    <div className="rounded-2xl border border-paper-muted bg-white p-6">
      <h2 className="font-display text-xl font-semibold text-ink">
        {companies.length === 0 ? 'Crie uma empresa primeiro' : 'Selecione uma empresa'}
      </h2>
      <p className="mt-2 text-sm text-mist">
        {message ??
          'O orçamento pertence à empresa do usuário autenticado. Crie ou selecione uma empresa para continuar.'}
      </p>
      {companies.length === 0 ? (
        <Link to="/app/empresa" className="mt-5 inline-block">
          <Button>Criar empresa</Button>
        </Link>
      ) : null}
    </div>
  )
}
