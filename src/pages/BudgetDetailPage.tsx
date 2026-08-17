import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  deleteCompanyBudget,
  getCompanyBudget,
} from '@/features/budget/budgetService'
import type { LoadedBudget } from '@/features/budget/model'
import { BUDGET_STATUS_LABEL, grandTotal } from '@/features/budget/model'
import { formatPeriodRange, monthsBetween } from '@/features/budget/period'
import { formatMoney } from '@/features/budget/money'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { CompanyRequired } from '@/components/company/CompanyRequired'
import { BudgetItemsTable } from '@/components/budget/BudgetItemsTable'

export function BudgetDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { company, loading: companyLoading } = useCompany()
  const [budget, setBudget] = useState<LoadedBudget | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const fetchKey = company && id ? `${company.id}:${id}` : null

  useEffect(() => {
    if (!company || !id) return
    const companyId = company.id
    const budgetId = id
    const key = `${companyId}:${budgetId}`
    let mounted = true
    void getCompanyBudget(companyId, budgetId)
      .then((data) => {
        if (!mounted) return
        if (!data) {
          setError('Orçamento não encontrado nesta empresa.')
          setBudget(null)
          setFetchedFor(key)
          return
        }
        setBudget(data)
        setError('')
        setFetchedFor(key)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Não foi possível carregar o orçamento.')
        setBudget(null)
        setFetchedFor(key)
      })

    return () => {
      mounted = false
    }
  }, [company, id])

  const loading = Boolean(fetchKey) && fetchedFor !== fetchKey

  const months = useMemo(
    () => (budget ? monthsBetween(budget.startDate, budget.endDate) : []),
    [budget]
  )

  const labels = useMemo(() => {
    if (!budget) {
      return {
        businessUnit: () => '',
        department: () => '',
        costCenter: () => '',
      }
    }
    return {
      businessUnit: (value: string) =>
        budget.items.find((item) => item.businessUnitId === value)?.businessUnitName ?? '',
      department: (value: string) =>
        budget.items.find((item) => item.departmentId === value)?.departmentName ?? '',
      costCenter: (value: string) =>
        budget.items.find((item) => item.costCenterId === value)?.costCenterName ?? '',
    }
  }, [budget])

  const handleDelete = async () => {
    if (!company || !budget) return
    setDeleting(true)
    try {
      await deleteCompanyBudget(company.id, budget.id)
      navigate('/app/orcamentos')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir o orçamento.')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  if (!companyLoading && !company) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Orçamento</h1>
        <div className="mt-6">
          <CompanyRequired />
        </div>
      </div>
    )
  }

  if (loading || companyLoading) {
    return <p className="text-sm text-mist">Carregando orçamento...</p>
  }

  if (!budget) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Orçamento</h1>
        <p className="mt-4 text-sm text-danger">{error || 'Orçamento não encontrado.'}</p>
        <Link to="/app/orcamentos" className="mt-4 inline-block">
          <Button variant="secondary">Voltar aos orçamentos</Button>
        </Link>
      </div>
    )
  }

  const total = grandTotal(budget.items, months)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-mist">
            {company?.trade_name || company?.name} · {BUDGET_STATUS_LABEL[budget.status]}
          </p>
          <h1 className="font-display text-3xl font-bold text-ink">{budget.name}</h1>
          <p className="mt-2 text-sm text-mist">
            {budget.periodLabel} · {formatPeriodRange(budget.startDate, budget.endDate)}
            {budget.businessUnitName ? ` · ${budget.businessUnitName}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/app/realizado/novo?orcamento=${budget.id}`}>
            <Button variant="secondary">Lançar realizado</Button>
          </Link>
          <Link to={`/app/orcado-realizado?orcamento=${budget.id}`}>
            <Button variant="secondary">Orçado × Realizado</Button>
          </Link>
          <Link to={`/app/orcamentos/${budget.id}/editar`}>
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
            {budget.items.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-mist">Meses</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{months.length}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-mist">Total orçado</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-navy">
            {formatMoney(total)}
          </p>
        </div>
      </div>

      {budget.notes ? (
        <p className="rounded-2xl border border-paper-muted bg-white px-5 py-4 text-sm text-ink-soft/80">
          {budget.notes}
        </p>
      ) : null}

      <BudgetItemsTable items={budget.items} months={months} labels={labels} readOnly />

      <Link to="/app/orcamentos">
        <Button variant="secondary">Voltar aos orçamentos</Button>
      </Link>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir orçamento"
        body={`Excluir o orçamento “${budget.name}”? Todas as linhas e valores serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir orçamento'}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!deleting) void handleDelete()
        }}
      />
    </div>
  )
}
