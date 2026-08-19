import { useCompany } from '@/features/company/useCompany'
import { CompanyRequired } from '@/components/company/CompanyRequired'
import { ActualSubnav } from '@/components/actual/ActualSubnav'
import type { ReactNode } from 'react'

export function ActualPageShell({
  title,
  description,
  actions,
  children,
  tourId,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  tourId?: string
}) {
  const { company, loading } = useCompany()

  if (!loading && !company) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
        <div className="mt-6">
          <CompanyRequired message="O realizado pertence à empresa ativa. Crie ou selecione uma empresa para continuar." />
        </div>
      </div>
    )
  }

  return (
    <div data-tour={tourId}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-mist">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <ActualSubnav />
      {children}
    </div>
  )
}
