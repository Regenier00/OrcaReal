interface SummaryItem {
  label: string
  value: string
  hint?: string
}

export function ImportSummary({ items }: { items: SummaryItem[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-paper-muted bg-white px-4 py-3"
        >
          <dt className="text-[11px] font-medium uppercase tracking-wide text-mist">
            {item.label}
          </dt>
          <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
            {item.value}
          </dd>
          {item.hint ? <p className="mt-1 text-xs text-mist">{item.hint}</p> : null}
        </div>
      ))}
    </dl>
  )
}
