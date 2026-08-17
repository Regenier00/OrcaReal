import { useEffect, useState, type DragEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { useCompany } from '@/features/company/useCompany'
import {
  createBankAccount,
  listBankAccounts,
  pollStatementImport,
  uploadAndProcessStatement,
} from '@/features/actual/actualService'
import {
  ACCEPTED_STATEMENT_ACCEPT,
  ACTUAL_PATHS,
  FILE_TYPE_LABEL,
  IMPORT_STATUS_LABEL,
  MAX_STATEMENT_FILE_BYTES,
  isAcceptedStatementFile,
} from '@/features/actual/model'
import type { BankAccount, StatementImport } from '@/types/database'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ActualPageShell } from '@/components/actual/ActualPageShell'
import { ImportProgress } from '@/components/actual/ImportProgress'
import { ImportSummary } from '@/components/actual/ImportSummary'

export function ImportStatementPage() {
  const { user } = useAuth()
  const { company } = useCompany()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [accountId, setAccountId] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [current, setCurrent] = useState<StatementImport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    if (!company) return
    const companyId = company.id
    let mounted = true
    void listBankAccounts(companyId)
      .then((data) => {
        if (!mounted) return
        setAccounts(data)
        setAccountId((currentId) => currentId || data[0]?.id || '')
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar contas.')
      })
    return () => {
      mounted = false
    }
  }, [company])

  const handleFiles = (list: FileList | null) => {
    const next = list?.[0]
    if (!next) return
    if (!isAcceptedStatementFile(next.name)) {
      setError('Envie um arquivo OFX, CSV, XLSX ou PDF estruturado.')
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

  const handleCreateAccount = async () => {
    if (!company || !newAccountName.trim()) return
    setBusy(true)
    try {
      const created = await createBankAccount({
        companyId: company.id,
        name: newAccountName,
      })
      setAccounts((currentAccounts) => [...currentAccounts, created])
      setAccountId(created.id)
      setNewAccountName('')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a conta.')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!company || !user || !file) return
    if (!accountId) {
      setError('Selecione ou crie a conta bancária deste extrato.')
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
      if (finished.status === 'failed') {
        setError(finished.error_message || 'Falha ao processar o extrato.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na importação.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ActualPageShell
      title="Importar extrato"
      description="O extrato vira realizado da empresa. Depois da leitura, os lançamentos entram em Realizados não apropriados para você classificar antes do Orçado × Realizado."
      actions={
        <Link to={ACTUAL_PATHS.unappropriated}>
          <Button variant="secondary">Não apropriados</Button>
        </Link>
      }
    >
      <form className="mt-8 grid gap-6" onSubmit={(event) => void handleSubmit(event)}>
        <section className="rounded-2xl border border-paper-muted bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Banco</h2>
          <p className="mt-1 text-sm text-mist">
            Selecione o banco do extrato. As contas padrão já vêm com os principais bancos do mercado.
          </p>
          {accounts.length > 0 ? (
            <div className="mt-4 max-w-md">
              <Select
                label="Banco / conta"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bank_code ? `${account.bank_code} · ` : ''}
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="mt-4 flex max-w-xl flex-wrap items-end gap-3">
            <Input
              label="Outro banco"
              value={newAccountName}
              onChange={(event) => setNewAccountName(event.target.value)}
              placeholder="Nome do banco"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !newAccountName.trim()}
              onClick={() => void handleCreateAccount()}
            >
              Adicionar banco
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-paper-muted bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Arquivo</h2>
          <p className="mt-1 text-sm text-mist">
            Formatos iniciais: OFX, CSV, XLSX e PDF estruturado. PDFs digitalizados ficarão prontos para OCR.
          </p>
          <label
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`mt-4 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center ${
              dragOver ? 'border-navy-bright bg-paper' : 'border-paper-muted bg-paper/60'
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

        {error ? (
          <p className="rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div>
          <Button type="submit" disabled={busy || !file}>
            {busy ? 'Processando...' : 'Enviar e processar'}
          </Button>
        </div>
      </form>

      {current ? (
        <section className="mt-8 rounded-2xl border border-paper-muted bg-white p-6">
          <h2 className="font-display text-lg font-semibold text-navy">Progresso</h2>
          <p className="mt-1 text-sm text-mist">
            {FILE_TYPE_LABEL[current.file_type]} · {IMPORT_STATUS_LABEL[current.status]}
            {current.detected_bank ? ` · ${current.detected_bank}` : ''}
          </p>
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
              <Link
                to={`${ACTUAL_PATHS.unappropriated}?importacao=${current.id}`}
                className="mt-6 inline-block"
              >
                <Button type="button">Ir para não apropriados</Button>
              </Link>
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
    </ActualPageShell>
  )
}
