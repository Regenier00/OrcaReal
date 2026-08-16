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
    <div className="border-b border-white/10 bg-ink text-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-xs sm:text-sm">
        <p className="text-white/75">
          Você está na{' '}
          <span className="font-medium text-white">{demoCompany.name}</span>
          <span className="text-white/45"> — dados de exemplo, nada é salvo.</span>
        </p>
        <p className="text-white/55">
          {simulationsRemaining > 0
            ? `${simulationLabel} de ${GUEST_LIMITS.maxSimulations}`
            : 'Simulações da demonstração esgotadas'}
        </p>
      </div>
    </div>
  )
}
