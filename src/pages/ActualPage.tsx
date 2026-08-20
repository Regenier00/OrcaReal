import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/useCompany'
import {
  deleteStatementImport,
  getActualSummary,
  listStatementImports,
} from '@/features/actual/actualService'
import type { ActualSummary } from '@/features/actual/actualService'
import { ACTUAL_PATHS } from '@/features/actual/model'
import { canDeleteImportedStatements } from '@/features/actual/permissions'
import { deleteErpImport, listErpImports } from '@/features/erp/erpService'
import type { ErpImport, StatementImport } from '@/types/database'
import { formatMoney } from '@/features/budget/money'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { ActualPageShell } from '@/components/actual/ActualPageShell'
import { ImportedStatementsList } from '@/components/actual/ImportedStatementsList'
import { ImportSummary } from '@/components/actual/ImportSummary'
import { ImportedErpList } from '@/components/erp/ImportedErpList'

export function ActualPage() {
  const { company, activeMembership, loading: companyLoading } = useCompany()
  const canDelete = canDeleteImportedStatements(activeMembership?.role)
  const [summary, setSummary] = useState<ActualSummary | null>(null)
  const [imports, setImports] = useState<StatementImport[]>([])
  const [erpImports, setErpImports] = useState<ErpImport[]>([])
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<StatementImport | null>(null)
  const [pendingErpDelete, setPendingErpDelete] = useState<ErpImport | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!company) return
    const companyId = company.id
    let mounted = true
    void Promise.all([
      getActualSummary(companyId),
      listStatementImports(companyId),
      listErpImports(companyId).catch(() => [] as ErpImport[]),
    ])
      .then(([nextSummary, nextImports, nextErp]) => {
        if (!mounted) return
        setSummary(nextSummary)
        setImports(nextImports)
        setErpImports(nextErp)
        setError('')
        setFetchedFor(companyId)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar o realizado.')
        setFetchedFor(companyId)
      })
    return () => {
      mounted = false
    }
  }, [company])

  const loading = company ? fetchedFor !== company.id : false
  const cards = useMemo(
    () => [
      { label: 'Entradas', value: formatMoney(summary?.incomeTotal ?? 0) },
      { label: 'Saídas', value: formatMoney(summary?.expenseTotal ?? 0) },
      {
        label: 'Não apropriados',
        value: String(summary?.pendingCount ?? 0),
        hint: 'Aguardando classificação',
      },
      {
        label: 'Apropriados',
        value: String(summary?.classifiedCount ?? 0),
        hint: 'Prontos para o Orçado × Realizado',
      },
    ],
    [summary],
  )

  const handleDelete = async () => {
    if (!company || !pendingDelete || !canDelete) return
    setDeleting(true)
    try {
      await deleteStatementImport(company.id, pendingDelete.id)
      const [nextSummary, nextImports] = await Promise.all([
        getActualSummary(company.id),
        listStatementImports(company.id),
      ])
      setSummary(nextSummary)
      setImports(nextImports)
      setPendingDelete(null)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir o extrato.')
    } finally {
      setDeleting(false)
    }
  }

  const handleErpDelete = async () => {
    if (!company || !pendingErpDelete || !canDelete) return
    setDeleting(true)
    try {
      await deleteErpImport(company.id, pendingErpDelete.id)
      setErpImports(await listErpImports(company.id))
      setPendingErpDelete(null)
      setError('')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível excluir a importação ERP.',
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ActualPageShell
      title="Realizado"
      description={`O extrato bancário ou a planilha do ERP da ${company?.trade_name || company?.name || 'empresa'} vira realizado aqui. O que ainda não tiver classificação fica pendente até você revisar.`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to={ACTUAL_PATHS.import}>
            <Button>Importar extrato</Button>
          </Link>
          <Link to={ACTUAL_PATHS.importErp}>
            <Button variant="secondary">Importar ERP</Button>
          </Link>
          <Link to={ACTUAL_PATHS.unappropriated}>
            <Button variant="secondary">Não apropriados</Button>
          </Link>
          <Link to={ACTUAL_PATHS.byBudget}>
            <Button variant="secondary">Por orçamento</Button>
          </Link>
        </div>
      }
    >
      {error ? (
        <p className="mt-4 rounded-xl border border-danger/20 bg-white px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading || companyLoading ? (
        <p className="mt-8 text-sm text-mist">Carregando realizado...</p>
      ) : (
        <>
          <div className="mt-8">
            <ImportSummary items={cards} />
          </div>

          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-navy">
              Extratos importados
            </h2>
            {imports.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-paper-muted bg-white px-6 py-12 text-center">
                <p className="font-display text-xl font-semibold text-ink">
                  Nenhum extrato ainda
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-mist">
                  Importe o extrato (OFX, CSV, XLSX ou PDF) ou use Importar ERP
                  para planilhas contábeis.
                </p>
                <Link to={ACTUAL_PATHS.import} className="mt-6 inline-block">
                  <Button>Importar extrato</Button>
                </Link>
              </div>
            ) : (
              <ImportedStatementsList
                imports={imports}
                onDelete={canDelete ? setPendingDelete : undefined}
              />
            )}
          </section>

          <section className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold text-navy">
                Importações de ERP
              </h2>
              <Link to={ACTUAL_PATHS.importErp}>
                <Button variant="secondary">Importar ERP</Button>
              </Link>
            </div>
            <div className="mt-4">
              <ImportedErpList
                items={erpImports}
                canDelete={canDelete}
                onDelete={canDelete ? setPendingErpDelete : undefined}
              />
            </div>
          </section>
        </>
      )}

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

      <ConfirmDialog
        open={Boolean(pendingErpDelete)}
        title="Excluir importação ERP"
        body={`Excluir “${pendingErpDelete?.file_name ?? ''}”? Todos os lançamentos desta importação serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel={deleting ? 'Excluindo...' : 'Excluir'}
        danger
        onCancel={() => setPendingErpDelete(null)}
        onConfirm={() => {
          if (!deleting) void handleErpDelete()
        }}
      />
    </ActualPageShell>
  )
}
