import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import { listCompanyBudgets, deleteCompanyBudget } from '@/features/budget/budgetService'
import type { LoadedBudget } from '@/features/budget/model'
import { grandTotal, BUDGET_STATUS_LABEL } from '@/features/budget/model'
import { monthsBetween, formatPeriodRange } from '@/features/budget/period'
import { formatMoney } from '@/features/budget/money'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { CompanyRequired } from '@/components/company/CompanyRequired'

export function BudgetsPage() {
  const { company, loading: companyLoading } = useCompany()
  const [budgets, setBudgets] = useState<LoadedBudget[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<LoadedBudget | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!company) return
    const companyId = company.id
    let mounted = true
    void listCompanyBudgets(companyId)
      .then((data) => {
        if (!mounted) return
        setBudgets(data)
        setError('')
        setFetchedFor(companyId)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar orçamentos.')
        setBudgets([])
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
      await deleteCompanyBudget(company.id, pendingDelete.id)
      setBudgets((current) => current.filter((item) => item.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir o orçamento.')
    } finally {
      setDeleting(false)
    }
  }

  if (!companyLoading && !company) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Orçamentos</h1>
        <div className="mt-6">
          <CompanyRequired />
        </div>
      </div>
    )
  }

  return (
    <div data-tour="budgets">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Orçamentos</h1>
          <p className="mt-2 max-w-2xl text-sm text-mist">
            Planeje para onde o dinheiro da{' '}
            <span className="font-medium text-ink-soft/80">
              {company?.trade_name || company?.name || 'sua empresa'}
            </span>{' '}
            vai — em Receitas, Custos, Despesas e Investimentos.
            . Cada orçamento fica isolado por empresa.
          </p>
        </div>
        <Link to="/app/orcamentos/novo">
          <Button>Novo orçamento</Button>
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading || companyLoading ? (
        <p className="mt-8 text-sm text-mist">Carregando orçamentos...</p>
      ) : budgets.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-paper-muted bg-white px-6 py-12 text-center">
          <p className="font-display text-xl font-semibold text-ink">
            Nenhum orçamento ainda
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist">
            Crie o primeiro orçamento, defina o período e diga para onde o dinheiro
            vai — em Receitas, Custos, Despesas e Investimentos.
          </p>
          <Link to="/app/orcamentos/novo" className="mt-6 inline-block">
            <Button>Novo orçamento</Button>
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-paper-muted overflow-hidden rounded-2xl border border-paper-muted bg-white">
          {budgets.map((budget) => (
            <BudgetListRow
              key={budget.id}
              budget={budget}
              onDelete={() => setPendingDelete(budget)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir orçamento"
        body={`Excluir o orçamento “${pendingDelete?.name ?? ''}”? Todas as linhas e valores serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir orçamento'}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!deleting) void handleDelete()
        }}
      />
    </div>
  )
}

function BudgetListRow({
  budget,
  onDelete,
}: {
  budget: LoadedBudget
  onDelete: () => void
}) {
  const months = useMemo(
    () => monthsBetween(budget.startDate, budget.endDate),
    [budget.startDate, budget.endDate]
  )
  const total = grandTotal(budget.items, months)

  return (
    <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div>
        <Link
          to={`/app/orcamentos/${budget.id}`}
          className="font-medium text-ink hover:underline"
        >
          {budget.name}
        </Link>
        <p className="mt-1 text-xs text-mist">
          {budget.periodLabel} · {formatPeriodRange(budget.startDate, budget.endDate)} ·{' '}
          {budget.items.length} {budget.items.length === 1 ? 'item' : 'itens'} ·{' '}
          {BUDGET_STATUS_LABEL[budget.status]}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold tabular-nums text-navy">
          {formatMoney(total)}
        </p>
        <Link to={`/app/orcamentos/${budget.id}`}>
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
