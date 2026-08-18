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
import {
  FloatingNotice,
  SuggestionBalloon,
} from '@/components/actual/SuggestionBalloon'
import { cn } from '@/lib/utils'

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function suggestionLabel(
  item: ActualTransaction,
  catalog: ActualCatalog | null,
) {
  const parts = [
    catalog?.departments.find((entry) => entry.id === item.suggested_department_id)
      ?.name,
    catalog?.costCenters.find((entry) => entry.id === item.suggested_cost_center_id)
      ?.name,
  ].filter((value): value is string => Boolean(value))
  return parts.join(' · ')
}

export function ClassifyTransactionsPage() {
  const [params] = useSearchParams()
  const importId = params.get('importacao') ?? ''
  const { company } = useCompany()
  const [catalog, setCatalog] = useState<ActualCatalog | null>(null)
  const [items, setItems] = useState<ActualTransaction[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState<ActualTransactionStatus | ''>('pending')
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [nextType, setNextType] = useState<ActualTransactionType | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)

  const loadKey = company
    ? `${company.id}:${importId}:${status}:${search}`
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
  }, [company, loadKey, importId, status, search])

  const loading = Boolean(loadKey) && fetchedFor !== loadKey
  const selectedItems = items.filter((item) => selected.includes(item.id))
  const selectedWithSuggestion = selectedItems.filter(
    (item) => item.status === 'pending' && hasSuggestion(item),
  )
  const costCenters = catalog
    ? costCentersForDepartment(catalog, departmentId)
    : []

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4200)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const suggested = items.filter(
      (item) =>
        selected.includes(item.id) &&
        item.status === 'pending' &&
        hasSuggestion(item),
    )
    if (suggested.length === 0) return
    const nextDepartmentId = suggested[0]?.suggested_department_id ?? ''
    const nextCostCenterId = suggested[0]?.suggested_cost_center_id ?? ''
    const sameSuggestion = suggested.every(
      (item) =>
        (item.suggested_department_id ?? '') === nextDepartmentId &&
        (item.suggested_cost_center_id ?? '') === nextCostCenterId,
    )
    if (!sameSuggestion || !nextDepartmentId) return
    setDepartmentId(nextDepartmentId)
    setCostCenterId(nextCostCenterId)
  }, [items, selected])

  const suggestionPreview = useMemo(() => {
    const labels = [
      ...new Set(
        selectedWithSuggestion
          .map((item) => suggestionLabel(item, catalog))
          .filter(Boolean),
      ),
    ]
    if (labels.length === 0) return null
    return {
      lines: labels,
      hint:
        selectedWithSuggestion.length === 1
          ? 'Clique em Aplicar sugestão para apropriar com estes valores.'
          : `${selectedWithSuggestion.length} lançamentos selecionados. Clique em Aplicar sugestão para apropriar com o histórico.`,
    }
  }, [catalog, selectedWithSuggestion])

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
    const targets = selectedWithSuggestion
    if (targets.length === 0) {
      setError('Selecione um lançamento com sugestão de histórico.')
      return
    }
    const labels = [
      ...new Set(targets.map((item) => suggestionLabel(item, catalog)).filter(Boolean)),
    ]
    setBusy(true)
    try {
      await applyTransactionSuggestions({
        companyId: company.id,
        transactions: targets,
      })
      await reload()
      setSelected([])
      setError('')
      setNotice(
        targets.length === 1 && labels[0]
          ? `Apropriado com a sugestão: ${labels[0]}`
          : `${targets.length} lançamentos apropriados com sugestão de histórico.`,
      )
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
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
        <Input
          label="Busca"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Descrição do lançamento"
        />
      </div>

      <section className="mt-6 rounded-2xl border border-paper-muted bg-white p-5">
        <p className="text-sm text-mist">
          {summary.pending} não apropriados nesta lista · {summary.classified} apropriados
          {summary.withSuggestion > 0
            ? ` · ${summary.withSuggestion} com sugestão de histórico`
            : ''}
          {selected.length > 0 ? ` · ${selected.length} selecionada(s)` : ''}
        </p>
        {suggestionPreview ? (
          <div className="mt-4 mb-1 flex justify-end">
            <SuggestionBalloon
              className="w-full max-w-md"
              pointer="right"
              title="Sugestão do histórico"
              lines={suggestionPreview.lines}
              hint={suggestionPreview.hint}
            />
          </div>
        ) : null}
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
              disabled={busy || selectedWithSuggestion.length === 0}
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
                <tr
                  key={item.id}
                  className={cn(
                    'border-t border-paper-muted align-top',
                    selected.includes(item.id) && 'bg-navy-soft/70',
                  )}
                >
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
                      <span className="mt-1.5 inline-flex rounded-full bg-navy-soft px-2.5 py-1 text-[11px] font-medium text-navy-bright">
                        Sugestão: {suggestionLabel(item, catalog) || 'histórico disponível'}
                      </span>
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
      {notice ? (
        <FloatingNotice message={notice} onDismiss={() => setNotice('')} />
      ) : null}
    </ActualPageShell>
  )
}
