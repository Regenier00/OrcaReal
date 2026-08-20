import { readFirstXlsxSheetRows } from '../erp/xlsx.ts'
import {
  MAX_COST_CENTER_CODE,
  MAX_COST_CENTER_DESCRIPTION,
  MAX_COST_CENTER_NAME,
  MAX_COST_CENTER_ROWS,
} from './limits.ts'

export type CostCenterColumnRole = 'name' | 'code' | 'description' | 'ignore'

export interface CostCenterImportRow {
  name: string
  code: string | null
  description: string | null
  row: number
}

export interface CostCenterParseResult {
  rows: CostCenterImportRow[]
  warnings: Array<{ message: string; row?: number }>
  layout: {
    format: 'xlsx'
    sheetName: string
    headerRow: number
    columns: Record<string, number>
  }
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function roleFromHeader(header: string): CostCenterColumnRole | null {
  const key = normalizeHeader(header)
  if (!key) return null

  if (
    [
      'nome',
      'name',
      'centrocusto',
      'costcenter',
      'costcentername',
      'cc',
      'centrocustonome',
    ].includes(key) ||
    (key.includes('centro') && key.includes('custo') && !key.includes('codigo'))
  ) {
    return 'name'
  }

  if (
    [
      'codigo',
      'code',
      'cod',
      'codigocentrocusto',
      'costcentercode',
      'ccodigo',
    ].includes(key) ||
    (key.includes('codigo') && key.includes('centro'))
  ) {
    return 'code'
  }

  if (['descricao', 'description', 'obs', 'observacao', 'detalhe'].includes(key)) {
    return 'description'
  }

  return null
}

function trimCell(value: unknown, max: number) {
  const text = String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/^[=+\-@]+/, '')
    .trim()
  if (!text) return ''
  return text.slice(0, max)
}

function detectHeader(rows: string[][]) {
  const scan = Math.min(rows.length, 30)
  let best: {
    rowIndex: number
    map: Partial<Record<CostCenterColumnRole, number>>
    score: number
  } | null = null

  for (let i = 0; i < scan; i += 1) {
    const row = rows[i] ?? []
    const map: Partial<Record<CostCenterColumnRole, number>> = {}
    let score = 0
    for (let col = 0; col < row.length; col += 1) {
      const role = roleFromHeader(String(row[col] ?? ''))
      if (!role || role === 'ignore') continue
      if (map[role] != null) continue
      map[role] = col
      score += role === 'name' ? 100 : role === 'code' ? 40 : 20
    }
    if (map.name == null) continue
    if (!best || score > best.score) {
      best = { rowIndex: i, map, score }
    }
  }

  return best
}

export async function parseCostCenterXlsx(
  bytes: Uint8Array,
): Promise<CostCenterParseResult> {
  const { sheetName, rows: matrix } = await readFirstXlsxSheetRows(bytes)
  const warnings: CostCenterParseResult['warnings'] = []
  const detected = detectHeader(matrix)

  const headerRow = detected?.rowIndex ?? -1
  const nameCol = detected?.map.name ?? 0
  const codeCol = detected?.map.code
  const descriptionCol = detected?.map.description
  const startRow = headerRow >= 0 ? headerRow + 1 : 0

  if (headerRow < 0) {
    warnings.push({
      message:
        'Cabeçalho não identificado; usando a primeira coluna como nome do centro de custo.',
    })
  }

  const rows: CostCenterImportRow[] = []

  for (let i = startRow; i < matrix.length; i += 1) {
    if (rows.length >= MAX_COST_CENTER_ROWS) {
      warnings.push({
        message: `Limite de ${MAX_COST_CENTER_ROWS} linhas atingido; demais linhas foram ignoradas.`,
      })
      break
    }

    const line = matrix[i] ?? []
    const name = trimCell(line[nameCol], MAX_COST_CENTER_NAME)
    if (!name) continue

    const code =
      codeCol != null
        ? trimCell(line[codeCol], MAX_COST_CENTER_CODE) || null
        : null
    const description =
      descriptionCol != null
        ? trimCell(line[descriptionCol], MAX_COST_CENTER_DESCRIPTION) || null
        : null

    // Não aplica regra de negócio aqui: duplicatas/upsert ficam na RPC.
    rows.push({
      name,
      code,
      description,
      row: i + 1,
    })
  }

  if (rows.length === 0) {
    throw new Error(
      'Nenhum centro de custo encontrado. Inclua uma coluna Nome (ou Centro de custo).',
    )
  }

  return {
    rows,
    warnings,
    layout: {
      format: 'xlsx',
      sheetName,
      headerRow: headerRow + 1,
      columns: {
        name: nameCol,
        ...(codeCol != null ? { code: codeCol } : {}),
        ...(descriptionCol != null ? { description: descriptionCol } : {}),
      },
    },
  }
}
