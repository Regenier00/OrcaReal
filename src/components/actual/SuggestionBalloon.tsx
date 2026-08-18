import { cn } from '@/lib/utils'

export function SuggestionBalloon({
  title,
  lines,
  hint,
  pointer = 'left',
  className,
}: {
  title: string
  lines: string[]
  hint?: string
  pointer?: 'left' | 'right'
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        'relative rounded-2xl border border-navy-bright/20 bg-white px-4 py-3 shadow-card',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute -bottom-1.5 h-3 w-3 rotate-45 border-b border-r border-navy-bright/20 bg-white',
          pointer === 'right' ? 'right-8' : 'left-8',
        )}
      />
      <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-bright">
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {lines.map((line) => (
          <li key={line} className="text-sm font-medium text-navy">
            {line}
          </li>
        ))}
      </ul>
      {hint ? <p className="mt-1.5 text-xs text-mist">{hint}</p> : null}
    </div>
  )
}

export function FloatingNotice({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <p
        role="status"
        className="pointer-events-auto max-w-lg rounded-2xl border border-navy-bright/15 bg-navy px-4 py-3 text-sm font-medium text-paper shadow-soft"
      >
        <span>{message}</span>
        <button
          type="button"
          className="ml-3 text-xs text-paper/70 underline-offset-2 hover:text-paper hover:underline"
          onClick={onDismiss}
        >
          Fechar
        </button>
      </p>
    </div>
  )
}
