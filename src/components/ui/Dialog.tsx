import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  wide?: boolean
}

export function Dialog({
  open,
  title,
  children,
  onClose,
  footer,
  wide,
}: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={cn(
          'relative z-10 w-full rounded-2xl border border-paper-muted bg-white p-6 shadow-soft',
          wide ? 'max-w-lg' : 'max-w-md'
        )}
      >
        <h2 id="dialog-title" className="font-display text-xl font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-3 text-sm text-ink-soft/80">{children}</div>
        {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{body}</p>
    </Dialog>
  )
}
