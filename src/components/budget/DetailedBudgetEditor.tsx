import { useEffect, useMemo, useRef, useState } from 'react'
import type { DraftBudgetAccount, DraftBudgetItem } from '@/features/budget/model'
import {
  accountLineTotal,
  accountsAllocatedTotal,
  accountsRemaining,
  createBudgetAccount,
  distributeAmounts,
  itemIsDetailed,
  lineTotal,
} from '@/features/budget/model'
import type { BudgetMonth } from '@/features/budget/period'
import { formatMoney, roundMoney } from '@/features/budget/money'
import {
  importLedgerAccountsFromFile,
  listCompanyLedgerAccounts,
} from '@/features/budget/ledgerAccountService'
import type { CompanyLedgerAccount } from '@/types/database'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface DetailedBudgetEditorProps {
  companyId: string
  item: DraftBudgetItem
  months: BudgetMonth[]
  onChange: (next: DraftBudgetItem) => void
}

export function DetailedBudgetEditor({
  companyId,
  item,
  months,
  onChange,
}: DetailedBudgetEditorProps) {
  const detailed = itemIsDetailed(item)
  const [catalog, setCatalog] = useState<CompanyLedgerAccount[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const destinationTotal = lineTotal(item, months)
  const allocated = accountsAllocatedTotal(item, months)
  const remaining = accountsRemaining(item, months)
  const accounts = item.accounts ?? []

  const selectedCodes = useMemo(
    () => new Set(accounts.map((account) => account.accountCode.trim().toLowerCase())),
    [accounts]
  )

  const filteredCatalog = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return catalog.filter((account) => {
      if (selectedCodes.has(account.account_code.trim().toLowerCase())) return false
      if (!q) return true
      return (
        account.account_code.toLowerCase().includes(q) ||
        account.account_name.toLowerCase().includes(q)
      )
    })
  }, [catalog, filter, selectedCodes])

  const reloadCatalog = async () => {
    setLoadingCatalog(true)
    setError('')
    try {
      const rows = await listCompanyLedgerAccounts(companyId)
      setCatalog(rows)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o plano de contas.'
      )
    } finally {
      setLoadingCatalog(false)
    }
  }

  useEffect(() => {
    if (!detailed) return
    void reloadCatalog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailed, companyId])

  const enableDetailed = () => {
    onChange({
      ...item,
      isDetailed: true,
      accounts: item.accounts ?? [],
    })
  }

  const disableDetailed = () => {
    onChange({
      ...item,
      isDetailed: false,
      accounts: [],
    })
    setMessage('')
    setError('')
  }

  const updateAccounts = (nextAccounts: DraftBudgetAccount[]) => {
    onChange({
      ...item,
      isDetailed: true,
      accounts: nextAccounts,
    })
  }

  const addAccount = (account: CompanyLedgerAccount) => {
    if (selectedCodes.has(account.account_code.trim().toLowerCase())) return
    const seed = remaining > 0 ? remaining : 0
    updateAccounts([
      ...accounts,
      createBudgetAccount(
        months,
        account.account_code,
        account.account_name,
        seed,
        account.id
      ),
    ])
  }

  const updateAccountAmount = (localId: string, total: number) => {
    updateAccounts(
      accounts.map((account) =>
        account.localId === localId
          ? { ...account, amounts: distributeAmounts(total, months) }
          : account
      )
    )
  }

  const removeAccount = (localId: string) => {
    updateAccounts(accounts.filter((account) => account.localId !== localId))
  }

  const distributeRemainingEqually = () => {
    if (accounts.length === 0 || remaining <= 0) return
    const cents = Math.round(remaining * 100)
    const base = Math.floor(cents / accounts.length)
    const rem = cents - base * accounts.length
    updateAccounts(
      accounts.map((account, index) => {
        const extra = (base + (index < rem ? 1 : 0)) / 100
        const nextTotal = roundMoney(accountLineTotal(account, months) + extra)
        return {
          ...account,
          amounts: distributeAmounts(nextTotal, months),
        }
      })
    )
  }

  const onImportFile = async (file: File | null) => {
    if (!file) return
    setImporting(true)
    setError('')
    setMessage('')
    try {
      const result = await importLedgerAccountsFromFile({
        companyId,
        file,
      })
      setMessage(
        `Plano importado: ${result.summary.inserted} novas, ${result.summary.updated} atualizadas, ${result.summary.skipped} ignoradas.`
      )
      await reloadCatalog()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao importar o plano de contas.'
      )
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (!detailed) {
    return (
      <div className="mt-2">
        <Button
          type="button"
          variant="secondary"
          className="text-xs"
          onClick={enableDetailed}
          disabled={destinationTotal <= 0}
        >
          Orçamento detalhado
        </Button>
        {destinationTotal <= 0 ? (
          <p className="mt-1 text-xs text-mist">
            Defina o valor do destino antes de detalhar por conta contábil.
          </p>
        ) : (
          <p className="mt-1 text-xs text-mist">
            Opcional: importe o plano de contas e distribua o total entre contas.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-navy/20 bg-navy/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-navy">
            Orçamento detalhado
          </p>
          <p className="mt-1 text-xs text-mist">
            Importe o plano (coluna 1 = número, coluna 2 = descrição), selecione as
            contas e feche o total do destino.
          </p>
        </div>
        <div className="rounded-lg bg-white px-3 py-2 text-xs shadow-sm">
          <p className="text-mist">Contas / destino</p>
          <p className="font-numeric font-semibold text-ink">
            {formatMoney(allocated)} / {formatMoney(destinationTotal)}
          </p>
          <p
            className={cn(
              'mt-0.5',
              remaining === 0 ? 'text-ok' : remaining > 0 ? 'text-mist' : 'text-danger'
            )}
          >
            {remaining === 0
              ? 'Distribuição fechada'
              : remaining > 0
                ? `Restam ${formatMoney(remaining)}`
                : `Excedeu ${formatMoney(Math.abs(remaining))}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
          className="hidden"
          onChange={(event) => void onImportFile(event.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="secondary"
          className="text-xs"
          disabled={importing}
          onClick={() => fileRef.current?.click()}
        >
          {importing ? 'Importando…' : 'Importar plano de contas'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="text-xs"
          disabled={loadingCatalog}
          onClick={() => void reloadCatalog()}
        >
          Atualizar lista
        </Button>
        {remaining > 0 && accounts.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            onClick={distributeRemainingEqually}
          >
            Distribuir restante
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="text-xs text-danger"
          onClick={disableDetailed}
        >
          Remover detalhamento
        </Button>
      </div>

      {message ? <p className="mt-2 text-xs text-ok">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-paper-muted bg-white p-3">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-ink">Buscar contas do plano</span>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Número ou descrição"
              className="rounded-lg border border-paper-muted px-3 py-2 text-sm outline-none focus:border-navy-bright focus:ring-2 focus:ring-navy-bright/20"
            />
          </label>
          <div className="mt-2 max-h-48 overflow-y-auto">
            {loadingCatalog ? (
              <p className="px-1 py-4 text-center text-xs text-mist">Carregando…</p>
            ) : filteredCatalog.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-mist">
                {catalog.length === 0
                  ? 'Importe o plano de contas para selecionar as contas.'
                  : 'Nenhuma conta disponível com este filtro.'}
              </p>
            ) : (
              <ul className="divide-y divide-paper-muted">
                {filteredCatalog.slice(0, 80).map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center justify-between gap-2 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">
                        {account.account_code}
                      </p>
                      <p className="truncate text-mist">{account.account_name}</p>
                    </div>
                    <Button
                      type="button"
                      className="shrink-0 text-xs"
                      onClick={() => addAccount(account)}
                    >
                      Usar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-paper-muted bg-white p-3">
          <p className="text-xs font-medium text-ink">Contas neste destino</p>
          {accounts.length === 0 ? (
            <p className="mt-4 text-center text-xs text-mist">
              Selecione ao menos uma conta e distribua o valor total.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {accounts.map((account) => (
                <li
                  key={account.localId}
                  className="grid gap-2 rounded-lg border border-paper-muted p-2 sm:grid-cols-[1fr_120px_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-ink">
                      {account.accountCode}
                    </p>
                    <p className="truncate text-xs text-mist">{account.accountName}</p>
                  </div>
                  <MoneyInput
                    label="Valor"
                    value={accountLineTotal(account, months)}
                    onChange={(value) => updateAccountAmount(account.localId, value)}
                    className="!rounded-lg !px-2.5 !py-1.5 !text-sm"
                  />
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full text-xs text-danger"
                      onClick={() => removeAccount(account.localId)}
                    >
                      Remover
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
