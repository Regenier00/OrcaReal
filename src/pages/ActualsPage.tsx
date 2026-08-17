import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  deleteCompanyActual,
  listCompanyActuals,
} from '@/features/actual/actualService'
import type { LoadedActual } from '@/features/actual/model'
import { BUDGET_STATUS_LABEL, grandTotal } from '@/features/budget/model'
import { formatPeriodRange, monthsBetween } from '@/features/budget/period'
import { formatMoney } from '@/features/budget/money'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { ActualPageShell } from '@/components/actual/ActualPageShell'

export function ActualsPage() {
  const { company, loading: companyLoading } = useCompany()
  const [actuals, setActuals] = useState<LoadedActual[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<LoadedActual | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!company) return
    const companyId = company.id
    let mounted = true
    void listCompanyActuals(companyId)
      .then((data) => {
        if (!mounted) return
        setActuals(data)
        setError('')
        setFetchedFor(companyId)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar realizados.')
        setActuals([])
        setFetchedFor(companyId)
      })

    return () => {
      mounted = false
    }
  }, [company])

  const loading = company ? fetchedFor !== company.id : false

  const handleDelete = async () => {
    if (!company || !pendingDelete) return
    setDeleting(true)
    try {
      await deleteCompanyActual(company.id, pendingDelete.id)
      setActuals((current) => current.filter((item) => item.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir o realizado.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ActualPageShell
      title="Realizado por orçamento"
      description={`Lance os valores que de fato aconteceram na ${company?.trade_name || company?.name || 'sua empresa'}. Cada realizado fica vinculado a um orçamento da mesma empresa e alimenta o Orçado × Realizado.`}
      actions={
        <Link to="/app/realizado/novo">
          <Button>Novo realizado</Button>
        </Link>
      }
    >

      {error ? (
        <p className="mt-4 rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading || companyLoading ? (
        <p className="mt-8 text-sm text-mist">Carregando realizados...</p>
      ) : actuals.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-paper-muted bg-white px-6 py-12 text-center">
          <p className="font-display text-xl font-semibold text-ink">
            Nenhum realizado ainda
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist">
            Vincule um orçamento e preencha os valores mensais. A comparação
            Orçado × Realizado usa esse vínculo.
          </p>
          <Link to="/app/realizado/novo" className="mt-6 inline-block">
            <Button>Novo realizado</Button>
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-paper-muted overflow-hidden rounded-2xl border border-paper-muted bg-white">
          {actuals.map((actual) => (
            <ActualListRow
              key={actual.id}
              actual={actual}
              onDelete={() => setPendingDelete(actual)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir realizado"
        body={`Excluir o realizado “${pendingDelete?.name ?? ''}”? Todas as linhas e valores serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir realizado'}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!deleting) void handleDelete()
        }}
      />
    </ActualPageShell>
  )
}

function ActualListRow({
  actual,
  onDelete,
}: {
  actual: LoadedActual
  onDelete: () => void
}) {
  const months = useMemo(
    () => monthsBetween(actual.startDate, actual.endDate),
    [actual.startDate, actual.endDate]
  )
  const total = grandTotal(actual.items, months)

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div>
        <Link
          to={`/app/realizado/${actual.id}`}
          className="font-medium text-ink hover:underline"
        >
          {actual.name}
        </Link>
        <p className="mt-1 text-xs text-mist">
          {actual.budgetName ? `Vinculado a ${actual.budgetName} · ` : ''}
          {actual.periodLabel} · {formatPeriodRange(actual.startDate, actual.endDate)} ·{' '}
          {actual.items.length} {actual.items.length === 1 ? 'item' : 'itens'} ·{' '}
          {BUDGET_STATUS_LABEL[actual.status]}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold tabular-nums text-navy">
          {formatMoney(total)}
        </p>
        <Link to={`/app/orcado-realizado?orcamento=${actual.budgetId}`}>
          <Button variant="secondary" className="!px-3 !py-2 !text-xs">
            Comparar
          </Button>
        </Link>
        <Link to={`/app/realizado/${actual.id}`}>
          <Button variant="secondary" className="!px-3 !py-2 !text-xs">
            Abrir
          </Button>
        </Link>
        <Button
          type="button"
          variant="secondary"
          className="!px-3 !py-2 !text-xs text-danger"
          onClick={onDelete}
        >
          Excluir
        </Button>
      </div>
    </li>
  )
}
