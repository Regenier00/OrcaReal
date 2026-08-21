import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

const COMPANY_CHART_ACCOUNTS_PATH = '/app/empresa?tab=classificacao'

export function ChartAccountsRequired({
  message,
}: {
  message?: string
}) {
  return (
    <div className="rounded-2xl border border-paper-muted bg-white p-6">
      <h2 className="font-display text-xl font-semibold text-ink">
        Defina a classificação das contas contábeis primeiro
      </h2>
      <p className="mt-2 max-w-xl text-sm text-mist">
        {message ??
          'Sem a classificação dos prefixos contábeis, a importação de extrato ou ERP não consegue agrupar os lançamentos. Cadastre os prefixos em Empresa → Classificação antes de importar.'}
      </p>
      <Link to={COMPANY_CHART_ACCOUNTS_PATH} className="mt-5 inline-block">
        <Button>Definir classificação</Button>
      </Link>
    </div>
  )
}

export { COMPANY_CHART_ACCOUNTS_PATH }
