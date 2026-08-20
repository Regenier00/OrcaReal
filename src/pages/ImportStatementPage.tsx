import { useEffect, useState, type DragEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { useCompany } from '@/features/company/useCompany'
import {
  deleteStatementImport,
  listBankAccounts,
  pollStatementImport,
  uploadAndProcessStatement,
} from '@/features/actual/actualService'
import { completedStatementMessage } from '@/features/actual/importMessages'
import {
  ACCEPTED_STATEMENT_ACCEPT,
  ACTUAL_PATHS,
  FILE_TYPE_LABEL,
  IMPORT_STATUS_LABEL,
  MAX_STATEMENT_FILE_BYTES,
  isAcceptedStatementFile,
} from '@/features/actual/model'
import { canDeleteImportedStatements } from '@/features/actual/permissions'
import type { BankAccount, StatementImport } from '@/types/database'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Select'
import { ActualPageShell } from '@/components/actual/ActualPageShell'
import { ImportProgress } from '@/components/actual/ImportProgress'
import { ImportSummary } from '@/components/actual/ImportSummary'

export function ImportStatementPage() {
  const { user } = useAuth()
  const { company, activeMembership } = useCompany()
  const canDelete = canDeleteImportedStatements(activeMembership?.role)
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [accountId, setAccountId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [current, setCurrent] = useState<StatementImport | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadedAccountsFor, setLoadedAccountsFor] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<StatementImport | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (!company) return
    const companyId = company.id
    let mounted = true
    void listBankAccounts(companyId)
      .then((nextAccounts) => {
        if (!mounted) return
        setAccounts(nextAccounts)
        setAccountId((currentId) =>
          nextAccounts.some((item) => item.id === currentId)
            ? currentId
            : nextAccounts[0]?.id || '',
        )
        setError('')
        setLoadedAccountsFor(companyId)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setAccounts([])
        setLoadedAccountsFor(companyId)
        setError(err instanceof Error ? err.message : 'Erro ao carregar contas.')
      })
    return () => {
      mounted = false
    }
  }, [company])

  const loadingAccounts = Boolean(company) && loadedAccountsFor !== company?.id

  const handleFiles = (list: FileList | null) => {
    const next = list?.[0]
    if (!next) return
    if (!isAcceptedStatementFile(next.name)) {
      setError('Envie um arquivo OFX, CSV, XLSX ou PDF.')
      return
    }
    if (next.size > MAX_STATEMENT_FILE_BYTES) {
      setError('O arquivo excede o limite de 20 MB.')
      return
    }
    setError('')
    setFile(next)
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragOver(false)
    handleFiles(event.dataTransfer.files)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!company || !user || !file) return
    if (!accountId) {
      setError('Selecione o banco deste extrato.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const started = await uploadAndProcessStatement({
        companyId: company.id,
        bankAccountId: accountId,
        file,
        userId: user.id,
      })
      setCurrent(started)
      const finished = await pollStatementImport(
        company.id,
        started.id,
        setCurrent,
      )
      setCurrent(finished)
      if (finished.status === 'failed' || finished.status === 'ocr_required') {
        setError(finished.error_message || 'Falha ao processar o extrato.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na importação.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!company || !pendingDelete || !canDelete) return
    setDeleting(true)
    try {
      await deleteStatementImport(company.id, pendingDelete.id)
      setCurrent((currentImport) =>
        currentImport?.id === pendingDelete.id ? null : currentImport,
      )
      setPendingDelete(null)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir o extrato.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ActualPageShell
      title="Importar extrato"
      tourId="actual-import"
      description="O extrato vira realizado da empresa. Depois da leitura, os lançamentos entram em Realizados não apropriados para você classificar antes do Orçado × Realizado."
      actions={
        <Link to={ACTUAL_PATHS.unappropriated}>
          <Button variant="secondary">Não apropriados</Button>
        </Link>
      }
    >
      <div className="mt-8 grid gap-6">
        <section className="rounded-2xl border border-paper-muted bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Banco</h2>
          <p className="mt-1 text-sm text-mist">
            Selecione o banco do extrato entre os bancos padrão já cadastrados no sistema.
          </p>
          <div className="mt-4 max-w-md">
            <Select
              label="Banco"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              disabled={loadingAccounts || accounts.length === 0}
            >
              {accounts.length === 0 ? (
                <option value="">
                  {loadingAccounts ? 'Carregando bancos...' : 'Nenhum banco padrão disponível'}
                </option>
              ) : null}
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bank_code ? `${account.bank_code} · ` : ''}
                  {account.name}
                </option>
              ))}
            </Select>
          </div>
        </section>

        {error ? (
          <p className="rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <form
          className="grid gap-6"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <section className="rounded-2xl border border-paper-muted bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-navy">Arquivo</h2>
            <p className="mt-1 text-sm text-mist">
              Formatos: OFX, CSV, XLSX e PDF. PDFs digitalizados são lidos por OCR neste navegador.
            </p>
            <label
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`mt-4 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center ${
                dragOver ? 'border-brand bg-brand-soft/50' : 'border-paper-muted bg-white'
              }`}
            >
              <input
                type="file"
                accept={ACCEPTED_STATEMENT_ACCEPT}
                className="sr-only"
                onChange={(event) => handleFiles(event.target.files)}
              />
              <span className="font-medium text-ink">
                {file ? file.name : 'Arraste o extrato ou clique para selecionar'}
              </span>
              <span className="mt-1 text-xs text-mist">Até 20 MB · arquivo privado por empresa</span>
            </label>
          </section>

          <div>
            <Button type="submit" disabled={busy || !file || !accountId}>
              {busy ? 'Processando...' : 'Enviar e processar'}
            </Button>
          </div>
        </form>
      </div>

      {current ? (
        <section className="mt-8 rounded-2xl border border-paper-muted bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Progresso</h2>
          <p className="mt-1 text-sm text-mist">
            {FILE_TYPE_LABEL[current.file_type]} · {IMPORT_STATUS_LABEL[current.status]}
            {current.detected_bank ? ` · ${current.detected_bank}` : ''}
          </p>
          {current.status === 'completed' ? (
            <p
              role="status"
              className="mt-4 rounded-xl border border-ok/20 bg-ok-soft px-4 py-3 text-sm font-medium text-ok"
            >
              {completedStatementMessage(current)}
            </p>
          ) : null}
          <div className="mt-4">
            <ImportProgress status={current.status} />
          </div>
          {current.status === 'completed' || current.transaction_count > 0 ? (
            <div className="mt-6">
              <ImportSummary
                items={[
                  { label: 'Lançamentos', value: String(current.transaction_count) },
                  { label: 'Entradas', value: String(current.income_count) },
                  { label: 'Saídas', value: String(current.expense_count) },
                  {
                    label: 'Não apropriados',
                    value: String(current.pending_count),
                    hint:
                      current.duplicate_count > 0
                        ? `${current.duplicate_count} duplicidade(s) ignorada(s)`
                        : current.error_count > 0
                          ? `${current.error_count} erro(s)`
                          : undefined,
                  },
                ]}
              />
              <div className="mt-6 flex flex-wrap gap-2">
                <Link to={`${ACTUAL_PATHS.unappropriated}?importacao=${current.id}`}>
                  <Button type="button">Ir para não apropriados</Button>
                </Link>
                {canDelete ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-danger"
                    onClick={() => setPendingDelete(current)}
                  >
                    Excluir extrato
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {current.warnings.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-mist">
              {current.warnings.slice(0, 8).map((warning, index) => (
                <li key={`${warning.message}-${index}`}>{warning.message}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir extrato"
        body={`Excluir o extrato “${pendingDelete?.file_name ?? ''}”? Todos os lançamentos deste extrato serão removidos — inclusive os já apropriados. Esta ação não pode ser desfeita.`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir extrato'}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!deleting) void handleDelete()
        }}
      />
    </ActualPageShell>
  )
}
