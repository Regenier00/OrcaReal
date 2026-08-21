import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

const COMPANY_COST_CENTERS_PATH = '/app/empresa?tab=centros'

export function CostCentersRequired({
  message,
}: {
  message?: string
}) {
  return (
    <div className="rounded-2xl border border-paper-muted bg-white p-6">
      <h2 className="font-display text-xl font-semibold text-ink">
        Defina os centros de custo primeiro
      </h2>
      <p className="mt-2 max-w-xl text-sm text-mist">
        {message ??
          'Sem centros de custo cadastrados, o orçamento fica sem destino. Aplique as sugestões ou importe sua lista em Empresa → Centros de custo antes de criar um orçamento.'}
      </p>
      <Link to={COMPANY_COST_CENTERS_PATH} className="mt-5 inline-block">
        <Button>Definir centros de custo</Button>
      </Link>
    </div>
  )
}

export { COMPANY_COST_CENTERS_PATH }
