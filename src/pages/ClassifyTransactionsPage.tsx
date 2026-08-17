import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  applyTransactionSuggestions,
  classifyActualTransactions,
  costCentersForDepartment,
  listActualTransactions,
  loadActualCatalog,
  type ActualCatalog,
} from '@/features/actual/actualService'
import {
  ACTUAL_PATHS,
  EDITABLE_TRANSACTION_TYPES,
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_TYPE_LABEL,
  hasSuggestion,
} from '@/features/actual/model'
import type {
  ActualTransaction,
  ActualTransactionStatus,
  ActualTransactionType,
} from '@/types/database'
import { formatMoney } from '@/features/budget/money'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ActualPageShell } from '@/components/actual/ActualPageShell'
import { cn } from '@/lib/utils'

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export function ClassifyTransactionsPage() {
  const [params] = useSearchParams()
  const importId = params.get('importacao') ?? ''
  const { company } = useCompany()
  const [catalog, setCatalog] = useState<ActualCatalog | null>(null)
  const [items, setItems] = useState<ActualTransaction[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState<ActualTransactionStatus | ''>('pending')
  const [type, setType] = useState<ActualTransactionType | ''>('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [nextType, setNextType] = useState<ActualTransactionType | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)

  const loadKey = company
    ? `${company.id}:${importId}:${status}:${type}:${departmentFilter}:${search}`
    : null

  useEffect(() => {
    if (!company) return
    const companyId = company.id
    let mounted = true
    void loadActualCatalog(companyId)
      .then((data) => {
        if (mounted) setCatalog(data)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar a estrutura da empresa.')
      })
    return () => {
      mounted = false
    }
  }, [company])

  useEffect(() => {
    if (!company || !loadKey) return
    const companyId = company.id
    let mounted = true
    void listActualTransactions(companyId, {
      importId: importId || undefined,
      status,
      type,
      departmentId: departmentFilter || undefined,
      search,
    })
      .then((nextItems) => {
        if (!mounted) return
        setItems(nextItems)
        setSelected([])
        setError('')
        setFetchedFor(loadKey)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar movimentações.')
        setFetchedFor(loadKey)
      })
    return () => {
      mounted = false
    }
  }, [company, loadKey, importId, status, type, departmentFilter, search])

  const loading = Boolean(loadKey) && fetchedFor !== loadKey
  const selectedItems = items.filter((item) => selected.includes(item.id))
  const costCenters = catalog
    ? costCentersForDepartment(catalog, departmentId)
    : []

  const allSelected = items.length > 0 && selected.length === items.length

  const summary = useMemo(() => {
    return {
      pending: items.filter((item) => item.status === 'pending').length,
      classified: items.filter((item) => item.status === 'classified').length,
      withSuggestion: items.filter(hasSuggestion).length,
    }
  }, [items])

  const reload = async () => {
    if (!company) return
    const nextItems = await listActualTransactions(company.id, {
      importId: importId || undefined,
      status,
      type,
      departmentId: departmentFilter || undefined,
      search,
    })
    setItems(nextItems)
    setSelected((current) =>
      current.filter((id) => nextItems.some((item) => item.id === id)),
    )
  }

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const apply = async (nextStatus: ActualTransactionStatus) => {
    if (!company || selected.length === 0) return
    const effectiveTypes = selectedItems.map((item) => nextType || item.type)
    if (
      nextStatus === 'classified' &&
      effectiveTypes.some((itemType) => itemType === 'unknown')
    ) {
      setError('Defina se o lançamento é entrada ou saída antes de apropriar.')
      return
    }
    if (
      nextStatus === 'classified' &&
      effectiveTypes.some((itemType) => itemType === 'expense' || itemType === 'income') &&
      (!departmentId || !costCenterId)
    ) {
      setError('Informe departamento e centro de custo para apropriar.')
      return
    }
    setBusy(true)
    try {
      await classifyActualTransactions({
        companyId: company.id,
        transactionIds: selected,
        departmentId: departmentId || null,
        costCenterId: costCenterId || null,
        status: nextStatus,
        type: nextType || null,
      })
      await reload()
      setSelected([])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível classificar.')
    } finally {
      setBusy(false)
    }
  }

  const changeType = async (item: ActualTransaction, value: ActualTransactionType) => {
    if (!company || value === item.type) return
    setBusy(true)
    try {
      await classifyActualTransactions({
        companyId: company.id,
        transactionIds: [item.id],
        type: value,
        status: item.status === 'ignored' ? 'ignored' : item.status,
      })
      await reload()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar o tipo.')
    } finally {
      setBusy(false)
    }
  }

  const applySuggestions = async () => {
    if (!company) return
    const targets = selectedItems.length > 0 ? selectedItems : items.filter(hasSuggestion)
    if (targets.length === 0) return
    setBusy(true)
    try {
      await applyTransactionSuggestions({
        companyId: company.id,
        transactions: targets,
      })
      await reload()
      setSelected([])
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível aplicar as sugestões.')
    } finally {
      setBusy(false)
    }
  }

  const nameOf = (
    list: Array<{ id: string; name: string }>,
    id: string | null,
  ) => list.find((item) => item.id === id)?.name ?? '—'

  return (
    <ActualPageShell
      title="Realizados não apropriados"
      description="Classifique departamento e centro de custo. Se o tipo estiver errado, corrija entrada ou saída. O que for apropriado entra no Orçado × Realizado na linha do centro de custo."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={ACTUAL_PATHS.import}>
            <Button variant="secondary">Importar extrato</Button>
          </Link>
          <Link to="/app/orcado-realizado">
            <Button variant="secondary">Orçado × Realizado</Button>
          </Link>
        </div>
      }
    >
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as ActualTransactionStatus | '')}
        >
          <option value="">Todos</option>
          <option value="pending">Não apropriados</option>
          <option value="classified">Apropriados</option>
          <option value="ignored">Ignorados</option>
        </Select>
        <Select
          label="Tipo"
          value={type}
          onChange={(event) => setType(event.target.value as ActualTransactionType | '')}
        >
          <option value="">Todos</option>
          <option value="expense">Saídas</option>
          <option value="income">Entradas</option>
          <option value="transfer">Transferências</option>
          <option value="unknown">Não identificado</option>
        </Select>
        <Select
          label="Departamento"
          value={departmentFilter}
          onChange={(event) => setDepartmentFilter(event.target.value)}
        >
          <option value="">Todos</option>
          {(catalog?.departments ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
        <div className="lg:col-span-2">
          <Input
            label="Busca"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Descrição do lançamento"
          />
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-paper-muted bg-white p-5">
        <p className="text-sm text-mist">
          {summary.pending} não apropriados nesta lista · {summary.classified} apropriados
          {summary.withSuggestion > 0
            ? ` · ${summary.withSuggestion} com sugestão de histórico`
            : ''}
          {selected.length > 0 ? ` · ${selected.length} selecionada(s)` : ''}
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <Select
            label="Departamento"
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value)
              setCostCenterId('')
            }}
          >
            <option value="">Selecionar</option>
            {(catalog?.departments ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            label="Centro de custo"
            value={costCenterId}
            onChange={(event) => setCostCenterId(event.target.value)}
          >
            <option value="">Selecionar</option>
            {costCenters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            label="Tipo"
            hint="Use para corrigir entrada ou saída"
            value={nextType}
            onChange={(event) =>
              setNextType(event.target.value as ActualTransactionType | '')
            }
          >
            <option value="">Manter o tipo de cada lançamento</option>
            <option value="expense">Saída</option>
            <option value="income">Entrada</option>
            <option value="transfer">Transferência</option>
          </Select>
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              disabled={busy || selected.length === 0}
              onClick={() => void apply('classified')}
            >
              Apropriar
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || selected.length === 0}
              onClick={() => void apply('ignored')}
            >
              Ignorar
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || (selectedItems.length === 0 && summary.withSuggestion === 0)}
              onClick={() => void applySuggestions()}
            >
              Aplicar sugestão
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-mist">Carregando movimentações...</p>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-paper-muted bg-white px-6 py-12 text-center">
          <p className="font-display text-xl font-semibold text-ink">
            Nenhuma movimentação neste filtro
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-mist">
            Importe um extrato no Realizado para ver os lançamentos ainda sem
            apropriação, ou limpe os filtros.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-paper-muted bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-[11px] uppercase tracking-wide text-mist">
              <tr>
                <th className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? [] : items.map((item) => item.id))
                    }
                    aria-label="Selecionar todas"
                  />
                </th>
                <th className="px-3 py-2.5 font-medium">Data</th>
                <th className="px-3 py-2.5 font-medium">Descrição</th>
                <th className="px-3 py-2.5 font-medium">Tipo</th>
                <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                <th className="px-3 py-2.5 font-medium">Apropriação</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-paper-muted align-top">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => toggle(item.id)}
                      aria-label={`Selecionar ${item.description}`}
                    />
                  </td>
                  <td className="px-3 py-3 tabular-nums text-ink-soft">
                    {formatDate(item.posted_at)}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-ink">{item.description}</p>
                    {hasSuggestion(item) && item.status === 'pending' ? (
                      <p className="mt-1 text-xs text-navy-bright">
                        Sugestão de histórico:{' '}
                        {[
                          nameOf(catalog?.departments ?? [], item.suggested_department_id),
                          nameOf(catalog?.costCenters ?? [], item.suggested_cost_center_id),
                        ]
                          .filter((value) => value !== '—')
                          .join(' · ')}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <select
                      aria-label={`Tipo de ${item.description}`}
                      className="w-full min-w-32 rounded-lg border border-paper-muted bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-navy-bright focus:ring-2 focus:ring-navy-bright/20"
                      value={item.type}
                      disabled={busy}
                      onChange={(event) =>
                        void changeType(
                          item,
                          event.target.value as ActualTransactionType,
                        )
                      }
                    >
                      {EDITABLE_TRANSACTION_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {TRANSACTION_TYPE_LABEL[value]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className={cn(
                      'px-3 py-3 text-right tabular-nums font-medium',
                      item.type === 'expense' ? 'text-danger' : 'text-ok',
                    )}
                  >
                    {item.type === 'expense' ? '−' : ''}
                    {formatMoney(item.amount)}
                  </td>
                  <td className="px-3 py-3 text-xs text-mist">
                    {nameOf(catalog?.departments ?? [], item.department_id)}
                    {' · '}
                    {nameOf(catalog?.costCenters ?? [], item.cost_center_id)}
                  </td>
                  <td className="px-3 py-3 text-xs font-medium text-ink-soft">
                    {TRANSACTION_STATUS_LABEL[item.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ActualPageShell>
  )
}
