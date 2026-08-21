import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

const COMPANY_BUDGETS_NEW_PATH = '/app/orcamentos/novo'

export function BudgetRequired({
  message,
}: {
  message?: string
}) {
  return (
    <div className="rounded-2xl border border-paper-muted bg-white p-6">
      <h2 className="font-display text-xl font-semibold text-ink">
        Crie um orçamento primeiro
      </h2>
      <p className="mt-2 max-w-xl text-sm text-mist">
        {message ??
          'Sem orçamento, o realizado importado não tem centros de custo e destinos alinhados. Defina o orçamento antes de importar extrato ou ERP.'}
      </p>
      <Link to={COMPANY_BUDGETS_NEW_PATH} className="mt-5 inline-block">
        <Button>Criar orçamento</Button>
      </Link>
    </div>
  )
}

export { COMPANY_BUDGETS_NEW_PATH }
