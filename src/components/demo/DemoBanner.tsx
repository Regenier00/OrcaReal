import { GUEST_LIMITS } from '@/features/guest/guestLimits'
import { demoCompany } from '@/content/demoCompany'

interface DemoBannerProps {
  simulationsRemaining: number
}

export function DemoBanner({ simulationsRemaining }: DemoBannerProps) {
  const simulationLabel =
    simulationsRemaining === 1
      ? '1 simulação restante'
      : `${simulationsRemaining} simulações restantes`

  return (
    <div className="border-b border-paper-muted bg-brand-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-2 text-xs sm:text-sm">
        <p className="text-ink-soft">
          Você está na{' '}
          <span className="font-medium text-brand">{demoCompany.name}</span>
          <span className="text-mist"> — dados de exemplo, nada é salvo.</span>
        </p>
        <p className="text-mist">
          {simulationsRemaining > 0
            ? `${simulationLabel} de ${GUEST_LIMITS.maxSimulations}`
            : 'Simulações da demonstração esgotadas'}
        </p>
      </div>
    </div>
  )
}
