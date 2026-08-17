export function ExperienceProgress({
  current,
  total,
}: {
  current: number
  total: number
}) {
  const safeTotal = Math.max(total, 1)
  const width = Math.min(100, Math.round((current / safeTotal) * 100))

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-mist">
        <span>
          {current} de {total}
        </span>
        <span>{width}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-muted">
        <div className="h-full rounded-full bg-navy transition-all" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}
