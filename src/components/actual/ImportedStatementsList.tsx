import { Link } from 'react-router-dom'
import {
  ACTUAL_PATHS,
  FILE_TYPE_LABEL,
  IMPORT_STATUS_LABEL,
} from '@/features/actual/model'
import type { StatementImport } from '@/types/database'
import { Button } from '@/components/ui/Button'

export function ImportedStatementsList({
  imports,
  onDelete,
}: {
  imports: StatementImport[]
  onDelete?: (item: StatementImport) => void
}) {
  return (
    <ul className="mt-4 divide-y divide-paper-muted overflow-hidden rounded-2xl border border-paper-muted bg-white">
      {imports.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
        >
          <div>
            <p className="font-medium text-ink">{item.file_name}</p>
            <p className="mt-1 text-xs text-mist">
              {FILE_TYPE_LABEL[item.file_type]}
              {item.detected_bank ? ` · ${item.detected_bank}` : ''}
              {' · '}
              {IMPORT_STATUS_LABEL[item.status]}
              {' · '}
              {item.transaction_count} lançamentos
              {' · '}
              {item.pending_count} não apropriados
              {item.error_count > 0 ? ` · ${item.error_count} erros` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm tabular-nums text-mist">
              {item.income_count} entradas · {item.expense_count} saídas
            </p>
            <Link to={`${ACTUAL_PATHS.unappropriated}?importacao=${item.id}`}>
              <Button variant="secondary" className="!px-3 !py-2 !text-xs">
                Não apropriados
              </Button>
            </Link>
            {onDelete ? (
              <Button
                type="button"
                variant="secondary"
                className="!px-3 !py-2 !text-xs text-danger"
                onClick={() => onDelete(item)}
              >
                Excluir
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
