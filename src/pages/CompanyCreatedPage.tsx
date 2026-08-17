import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { Button } from '@/components/ui/Button'

export function CompanyCreatedPage() {
  const { activeCompany, refresh, error } = useCompany()
  const [ready, setReady] = useState(Boolean(activeCompany))

  useEffect(() => {
    let mounted = true
    void refresh().finally(() => {
      if (mounted) setReady(true)
    })
    return () => {
      mounted = false
    }
  }, [refresh])

  const companyName = activeCompany?.trade_name || activeCompany?.name

  return (
    <div className="rounded-2xl border border-paper-muted bg-white px-6 py-10 text-center sm:px-10">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ok">
        Tudo certo
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold text-ink sm:text-4xl">
        Empresa criada com sucesso!
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-mist sm:text-base">
        Agora vamos preparar seu ambiente para você começar a controlar seus
        orçamentos e analisar seus resultados.
      </p>
      {companyName ? (
        <p className="mt-5 text-sm font-medium text-navy">Empresa: {companyName}</p>
      ) : null}

      {!ready || !activeCompany ? (
        <div className="mt-8">
          <p className="text-sm text-mist">Preparando seu ambiente...</p>
          {error ? (
            <div className="mt-4">
              <p className="text-sm text-danger">{error}</p>
              <Button className="mt-3" onClick={() => void refresh()}>
                Tentar de novo
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <Link to="/app/configurar-ambiente" className="mt-8 inline-flex">
          <Button>Continuar</Button>
        </Link>
      )}
    </div>
  )
}
