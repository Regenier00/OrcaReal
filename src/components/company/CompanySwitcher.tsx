import { useCompany } from '@/features/company/useCompany'
import { cn } from '@/lib/utils'

export function CompanySwitcher({ className }: { className?: string }) {
  const { companies, company, selectCompany, loading } = useCompany()

  if (loading || companies.length === 0) return null

  if (companies.length === 1) {
    return (
      <span className={cn('hidden text-xs text-mist lg:inline', className)}>
        {companies[0].trade_name || companies[0].name}
      </span>
    )
  }

  return (
    <label className={cn('hidden items-center gap-2 text-xs text-mist md:flex', className)}>
      <span className="whitespace-nowrap">Empresa</span>
      <select
        value={company?.id ?? ''}
        onChange={(event) => selectCompany(event.target.value)}
        className="max-w-48 rounded-lg border border-paper-muted bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        {companies.map((item) => (
          <option key={item.id} value={item.id} className="text-ink">
            {item.trade_name || item.name}
          </option>
        ))}
      </select>
    </label>
  )
}
