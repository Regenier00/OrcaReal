import { useEffect } from 'react'
import { demoGates, type DemoGate } from '@/content/demoCompany'
import { Button } from '@/components/ui/Button'

interface AuthGateModalProps {
  gate: DemoGate
  onClose: () => void
  onSignUp: () => void
}

export function AuthGateModal({ gate, onClose, onSignUp }: AuthGateModalProps) {
  const copy = demoGates[gate]

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/45 px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-gate-title"
        className="w-full max-w-md rounded-2xl border border-paper-muted bg-white p-6 shadow-[var(--shadow-soft)]"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
          Modo demonstração
        </p>
        <h2 id="demo-gate-title" className="mt-2 font-display text-2xl font-semibold text-ink">
          {copy.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft/75">{copy.body}</p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={onSignUp}>
            {copy.action}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Continuar explorando
          </Button>
        </div>
      </div>
    </div>
  )
}
