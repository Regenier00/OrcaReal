import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { companyInitials, fileToLogoDataUrl } from '@/lib/companyLogo'

export function CompanyLogoAvatar({
  name,
  logoUrl,
  editable = false,
  size = 'lg',
  showRemove = false,
  onChange,
}: {
  name: string
  logoUrl: string | null
  editable?: boolean
  size?: 'sm' | 'lg'
  showRemove?: boolean
  onChange?: (logoUrl: string | null) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const initials = companyInitials(name)
  const canEdit = editable && Boolean(onChange)

  const handleFile = async (file: File | undefined) => {
    if (!file || !onChange || busy) return
    setBusy(true)
    setError('')
    try {
      const dataUrl = await fileToLogoDataUrl(file)
      await onChange(dataUrl)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível salvar a logo.'
      )
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    if (!onChange || busy) return
    setBusy(true)
    setError('')
    try {
      await onChange(null)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível remover a logo.'
      )
    } finally {
      setBusy(false)
    }
  }

  const frame = (
    <span className="relative inline-flex shrink-0">
      <span
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-full',
          size === 'lg'
            ? 'h-[4.5rem] w-[4.5rem] bg-paper text-lg text-navy ring-1 ring-paper-muted'
            : 'h-8 w-8 bg-white/15 text-[10px] text-white ring-1 ring-white/20'
        )}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="font-display font-semibold tracking-tight">{initials}</span>
        )}
        {canEdit ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center bg-ink/55 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            {busy ? '...' : logoUrl ? 'Trocar' : 'Logo'}
          </span>
        ) : null}
      </span>
      {canEdit && !logoUrl ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-white ring-2 ring-white">
          +
        </span>
      ) : null}
    </span>
  )

  if (!canEdit) {
    return frame
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          className="group cursor-pointer rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-bright"
          aria-label={logoUrl ? 'Trocar logo da empresa' : 'Definir logo da empresa'}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {frame}
        </button>
        {showRemove && logoUrl ? (
          <button
            type="button"
            className="text-[11px] text-mist hover:text-ink"
            disabled={busy}
            onClick={() => void handleRemove()}
          >
            Remover
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      {error ? <p className="max-w-40 text-xs text-danger">{error}</p> : null}
    </div>
  )
}
