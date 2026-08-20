import { Link } from 'react-router-dom'
import {
  ERP_FILE_TYPE_LABEL,
  ERP_IMPORT_STATUS_LABEL,
  ERP_PATHS,
} from '@/features/erp/model'
import type { ErpImport } from '@/types/database'
import { Button } from '@/components/ui/Button'

export function ImportedErpList({
  items,
  canDelete,
  onDelete,
}: {
  items: ErpImport[]
  canDelete?: boolean
  onDelete?: (item: ErpImport) => void
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        Nenhuma importação de ERP ainda.{' '}
        <Link className="text-brand underline" to={ERP_PATHS.import}>
          Importar planilha
        </Link>
      </p>
    )
  }

  return (
    <ul className="divide-y divide-paper-muted overflow-hidden rounded-xl bg-white ring-1 ring-paper-muted">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-ink">{item.file_name}</p>
            <p className="text-xs text-ink-soft">
              {ERP_FILE_TYPE_LABEL[item.file_type]} ·{' '}
              {ERP_IMPORT_STATUS_LABEL[item.status]} · {item.entry_count}{' '}
              lançamentos · {item.pending_count} pendentes
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
              <Button
                type="button"
                variant="quiet"
                onClick={() => onDelete(item)}
              >
                Excluir
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
