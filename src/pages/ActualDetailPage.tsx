import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  deleteCompanyActual,
  getCompanyActual,
} from '@/features/actual/actualService'
import type { LoadedActual } from '@/features/actual/model'
import { BUDGET_STATUS_LABEL, grandTotal } from '@/features/budget/model'
import { formatPeriodRange, monthsBetween } from '@/features/budget/period'
import { formatMoney } from '@/features/budget/money'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { CompanyRequired } from '@/components/company/CompanyRequired'
import { BudgetItemsTable } from '@/components/budget/BudgetItemsTable'

export function ActualDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { company, loading: companyLoading } = useCompany()
  const [actual, setActual] = useState<LoadedActual | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fetchKey = company && id ? `${company.id}:${id}` : null

  useEffect(() => {
    if (!company || !id) return
    const companyId = company.id
    const actualId = id
    const key = `${companyId}:${actualId}`
    let mounted = true
    void getCompanyActual(companyId, actualId)
      .then((data) => {
        if (!mounted) return
        if (!data) {
          setError('Realizado não encontrado nesta empresa.')
          setActual(null)
          setFetchedFor(key)
          return
        }
        setActual(data)
        setError('')
        setFetchedFor(key)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Não foi possível carregar o realizado.')
        setActual(null)
        setFetchedFor(key)
      })

    return () => {
      mounted = false
    }
  }, [company, id])

  const loading = Boolean(fetchKey) && fetchedFor !== fetchKey

  const months = useMemo(
    () => (actual ? monthsBetween(actual.startDate, actual.endDate) : []),
    [actual]
  )

  const labels = useMemo(() => {
    if (!actual) {
      return {
        businessUnit: () => '',
        department: () => '',
        costCenter: () => '',
      }
    }
    return {
      businessUnit: (value: string) =>
        actual.items.find((item) => item.businessUnitId === value)?.businessUnitName ?? '',
      department: (value: string) =>
        actual.items.find((item) => item.departmentId === value)?.departmentName ?? '',
      costCenter: (value: string) =>
        actual.items.find((item) => item.costCenterId === value)?.costCenterName ?? '',
    }
  }, [actual])

  const handleDelete = async () => {
    if (!company || !actual) return
    setDeleting(true)
    try {
      await deleteCompanyActual(company.id, actual.id)
      navigate('/app/realizado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir o realizado.')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  if (!companyLoading && !company) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Realizado</h1>
        <div className="mt-6">
          <CompanyRequired />
        </div>
      </div>
    )
  }

  if (loading || companyLoading) {
    return <p className="text-sm text-mist">Carregando realizado...</p>
  }

  if (!actual) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Realizado</h1>
        <p className="mt-4 text-sm text-danger">{error || 'Realizado não encontrado.'}</p>
        <Link to="/app/realizado" className="mt-4 inline-block">
          <Button variant="secondary">Voltar aos realizados</Button>
        </Link>
      </div>
    )
  }

  const total = grandTotal(actual.items, months)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-mist">
            {company?.trade_name || company?.name} · {BUDGET_STATUS_LABEL[actual.status]}
          </p>
          <h1 className="font-display text-3xl font-bold text-ink">{actual.name}</h1>
          <p className="mt-2 text-sm text-mist">
            {actual.budgetName ? `Vinculado a ${actual.budgetName} · ` : ''}
            {actual.periodLabel} · {formatPeriodRange(actual.startDate, actual.endDate)}
            {actual.businessUnitName ? ` · ${actual.businessUnitName}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/app/orcado-realizado?orcamento=${actual.budgetId}`}>
            <Button variant="secondary">Orçado × Realizado</Button>
          </Link>
          <Link to={`/app/realizado/${actual.id}/editar`}>
            <Button>Editar</Button>
          </Link>
          <Button variant="secondary" className="text-danger" onClick={() => setConfirmDelete(true)}>
            Excluir
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 rounded-2xl border border-paper-muted bg-white p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-mist">Itens</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
            {actual.items.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-mist">Meses</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{months.length}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-mist">Total realizado</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-navy">
            {formatMoney(total)}
          </p>
        </div>
      </div>

      {actual.notes ? (
        <p className="rounded-2xl border border-paper-muted bg-white px-5 py-4 text-sm text-ink-soft/80">
          {actual.notes}
        </p>
      ) : null}

      <BudgetItemsTable
        items={actual.items}
        months={months}
        labels={labels}
        readOnly
        emptyMessage="Nenhum item neste realizado."
        totalLabel="Total do realizado"
      />

      <Link to="/app/realizado">
        <Button variant="secondary">Voltar aos realizados</Button>
      </Link>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir realizado"
        body={`Excluir o realizado “${actual.name}”? Todas as linhas e valores serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir realizado'}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!deleting) void handleDelete()
        }}
      />
    </div>
  )
}
