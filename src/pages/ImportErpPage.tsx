import { useEffect, useState, type DragEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { mapSupabaseError, MISSING_API_KEY_REQUEST_MESSAGE } from '@/features/auth/authErrors'
import { useAuth } from '@/features/auth/useAuth'
import { useCompany } from '@/features/company/useCompany'
import { canDeleteImportedStatements, canImportErp } from '@/features/actual/permissions'
import {
  companyHasChartAccounts,
} from '@/features/erp/chartAccountGate'
import {
  deleteErpImport,
  uploadAndProcessErpImport,
} from '@/features/erp/erpService'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  ACCEPTED_ERP_ACCEPT,
  completedErpMessage,
  ERP_FILE_TYPE_LABEL,
  ERP_IMPORT_STATUS_LABEL,
  ERP_PATHS,
  isAcceptedErpFile,
  MAX_ERP_FILE_BYTES,
} from '@/features/erp/model'
import type { ErpImport } from '@/types/database'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { ActualPageShell } from '@/components/actual/ActualPageShell'
import {
  ChartAccountsRequired,
  COMPANY_CHART_ACCOUNTS_PATH,
} from '@/components/company/ChartAccountsRequired'
import { ErpImportProgress } from '@/components/erp/ErpImportProgress'
import { ErpImportSummary } from '@/components/erp/ErpImportSummary'

export function ImportErpPage() {
  const { user } = useAuth()
  const { company, activeMembership } = useCompany()
  const canDelete = canDeleteImportedStatements(activeMembership?.role)
  const canImport = canImportErp(activeMembership?.role)
  const [file, setFile] = useState<File | null>(null)
  const [current, setCurrent] = useState<ErpImport | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ErpImport | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [hasChartAccounts, setHasChartAccounts] = useState<boolean | null>(null)
  const [loadedGateFor, setLoadedGateFor] = useState<string | null>(null)

  useEffect(() => {
    if (!company) return
    const companyId = company.id
    let mounted = true
    void companyHasChartAccounts(companyId)
      .then((hasAccounts) => {
        if (!mounted) return
        setHasChartAccounts(hasAccounts)
        setLoadedGateFor(companyId)
        setError('')
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setHasChartAccounts(null)
        setLoadedGateFor(companyId)
        setError(
          mapSupabaseError(
            err,
            'Não foi possível verificar a classificação.',
          ),
        )
      })
    return () => {
      mounted = false
    }
  }, [company])

  const loadingGate = Boolean(company) && loadedGateFor !== company?.id
  const canUpload = hasChartAccounts === true

  const handleFiles = (list: FileList | null) => {
    const next = list?.[0]
    if (!next) return
    if (!isAcceptedErpFile(next.name)) {
      setError('Envie um arquivo XLSX ou CSV.')
      return
    }
    if (next.size > MAX_ERP_FILE_BYTES) {
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
    if (!isSupabaseConfigured) {
      setError(MISSING_API_KEY_REQUEST_MESSAGE)
      return
    }
    if (!canUpload) {
      setError(
        'Defina a classificação das contas contábeis antes de importar.',
      )
      return
    }
    if (!canImport) {
      setError('Seu perfil só visualiza. Peça a um membro para importar.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const finished = await uploadAndProcessErpImport({
        companyId: company.id,
        file,
        userId: user.id,
      })
      setCurrent(finished)
      if (finished.status === 'failed') {
        setError(
          mapSupabaseError(
            finished.error_message,
            'Falha ao processar o arquivo.',
          ),
        )
      }
    } catch (err) {
      setError(mapSupabaseError(err, 'Falha na importação.'))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!company || !pendingDelete || !canDelete) return
    setDeleting(true)
    try {
      await deleteErpImport(company.id, pendingDelete.id)
      setCurrent((currentImport) =>
        currentImport?.id === pendingDelete.id ? null : currentImport,
      )
      setPendingDelete(null)
      setError('')
    } catch (err) {
      setError(
        mapSupabaseError(err, 'Não foi possível excluir a importação.'),
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ActualPageShell
      title="Importar ERP"
      description="Importe lançamentos de ERPs (XLSX/CSV). Contas cujo prefixo está cadastrado na empresa entram no grupo certo; o destino é o centro de custo do arquivo."
      actions={
        <div className="flex flex-wrap gap-2">
          {canUpload ? (
            <Link to={COMPANY_CHART_ACCOUNTS_PATH}>
              <Button variant="secondary">Prefixos por grupo</Button>
            </Link>
          ) : hasChartAccounts === false ? (
            <Link to={COMPANY_CHART_ACCOUNTS_PATH}>
              <Button>Definir classificação</Button>
            </Link>
          ) : null}
          <Link to={ERP_PATHS.review}>
            <Button variant="secondary">Revisar lançamentos</Button>
          </Link>
        </div>
      }
    >
      <div className="mt-8 grid gap-6">
        {error ? (
          <p className="rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {loadingGate ? (
          <p className="text-sm text-mist">Verificando classificação...</p>
        ) : hasChartAccounts === false ? (
          <ChartAccountsRequired message="Sem a classificação dos prefixos contábeis, o arquivo ERP não consegue ser agrupado em Receitas, Custos, Despesas e Investimentos. Cadastre os prefixos em Empresa → Classificação antes de importar." />
        ) : (
          <form className="grid gap-6" onSubmit={(event) => void handleSubmit(event)}>
            <section className="rounded-2xl border border-paper-muted bg-white p-6">
              <h2 className="font-display text-lg font-semibold text-navy">
                Arquivo do ERP
              </h2>
              <p className="mt-1 text-sm text-mist">
                Formato principal: XLSX (também CSV). Identificamos só as colunas
                essenciais — data, valor, descrição, centro de custo e conta
                contábil — e descartamos o resto. Validamos extensão, MIME, magic
                bytes e tamanho (máx. 20 MB).
              </p>
              <label
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`mt-4 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center ${
                  dragOver
                    ? 'border-brand bg-brand-soft/50'
                    : 'border-paper-muted bg-white'
                }`}
              >
                <input
                  type="file"
                  accept={ACCEPTED_ERP_ACCEPT}
                  className="sr-only"
                  onChange={(event) => handleFiles(event.target.files)}
                />
                <span className="font-medium text-ink">
                  {file ? file.name : 'Arraste a planilha ou clique para selecionar'}
                </span>
                <span className="mt-1 text-xs text-mist">
                  Até 20 MB · processamento em lotes · isolamento por empresa
                </span>
              </label>
            </section>

            <div>
              <Button type="submit" disabled={busy || !file || !canImport}>
                {busy ? 'Processando...' : 'Enviar e processar'}
              </Button>
              {!canImport ? (
                <p className="mt-2 text-xs text-mist">
                  Visualizadores não podem importar arquivos.
                </p>
              ) : null}
            </div>
          </form>
        )}
      </div>

      {current ? (
        <section className="mt-8 grid gap-4">
          <div className="rounded-2xl border border-paper-muted bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-navy">
              Progresso
            </h2>
            <p className="mt-1 text-sm text-mist">
              {ERP_FILE_TYPE_LABEL[current.file_type]} ·{' '}
              {ERP_IMPORT_STATUS_LABEL[current.status]}
            </p>
            {current.status === 'completed' ? (
              <p
                role="status"
                className="mt-4 rounded-xl border border-ok/20 bg-ok-soft px-4 py-3 text-sm font-medium text-ok"
              >
                {completedErpMessage({
                  inserted: current.entry_count,
                  duplicates: current.duplicate_count,
                  errors: current.error_count,
                  pending: current.pending_count,
                })}
              </p>
            ) : null}
            <div className="mt-4">
              <ErpImportProgress status={current.status} />
            </div>
          </div>
          <ErpImportSummary
            item={current}
            canDelete={canDelete}
            onDelete={() => setPendingDelete(current)}
          />
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir importação ERP"
        body={`Excluir “${pendingDelete?.file_name ?? ''}”? Todos os lançamentos desta importação serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir'}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!deleting) void handleDelete()
        }}
      />
    </ActualPageShell>
  )
}
