import {
  ERP_FILE_TYPE_LABEL,
  ERP_IMPORT_STATUS_LABEL,
  ERP_PATHS,
} from '@/features/erp/model'
import type { ErpImport } from '@/types/database'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function ErpImportSummary({
  item,
  onDelete,
  canDelete,
}: {
  item: ErpImport
  onDelete?: () => void
  canDelete?: boolean
}) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-paper-muted">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{item.file_name}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {ERP_FILE_TYPE_LABEL[item.file_type]} ·{' '}
            {ERP_IMPORT_STATUS_LABEL[item.status]}
            {item.period_start && item.period_end
              ? ` · ${item.period_start} → ${item.period_end}`
              : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {item.status === 'completed' && (
            <Link to={`${ERP_PATHS.review}?importacao=${item.id}`}>
              <Button type="button" variant="secondary">
                Revisar
              </Button>
            </Link>
          )}
          {canDelete && onDelete && (
            <Button type="button" variant="quiet" onClick={onDelete}>
              Excluir
            </Button>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-ink-soft">Lançamentos</dt>
          <dd className="font-semibold text-ink">{item.entry_count}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Classificados</dt>
          <dd className="font-semibold text-ink">{item.classified_count}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Pendentes</dt>
          <dd className="font-semibold text-ink">{item.pending_count}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">Duplicados</dt>
          <dd className="font-semibold text-ink">{item.duplicate_count}</dd>
        </div>
      </dl>

      {(item.revenue_count > 0 ||
        item.cost_count > 0 ||
        item.expense_count > 0 ||
        item.investment_count > 0) && (
        <p className="mt-3 text-xs text-ink-soft">
          Receita {item.revenue_count} · Custo {item.cost_count} · Despesa{' '}
          {item.expense_count} · Investimento {item.investment_count}
        </p>
      )}

      {item.error_message && (
        <p className="mt-3 text-sm text-red-700">{item.error_message}</p>
      )}

      {item.warnings?.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-soft">
          {item.warnings.slice(0, 5).map((warning, index) => (
            <li key={`${warning.message}-${index}`}>
              {warning.row ? `Linha ${warning.row}: ` : ''}
              {warning.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
