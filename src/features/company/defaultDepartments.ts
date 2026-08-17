export const DEFAULT_DEPARTMENTS: Array<{ name: string; costCenter: string }> = [
  { name: 'Administrativo', costCenter: 'Administração Geral' },
  { name: 'Financeiro', costCenter: 'Gestão Financeira' },
  { name: 'Contabilidade', costCenter: 'Contabilidade' },
  { name: 'Recursos Humanos', costCenter: 'Recursos Humanos' },
  { name: 'Comercial / Vendas', costCenter: 'Vendas e Comercial' },
  { name: 'Marketing', costCenter: 'Marketing' },
  { name: 'Compras', costCenter: 'Compras' },
  { name: 'Estoque / Almoxarifado', costCenter: 'Estoque e Almoxarifado' },
  { name: 'Operacional / Produção', costCenter: 'Operações e Produção' },
  { name: 'Logística', costCenter: 'Logística e Distribuição' },
]

export const DEFAULT_DEPARTMENT_NAMES = DEFAULT_DEPARTMENTS.map(
  (item) => item.name
)

export const DEFAULT_COST_CENTER_NAMES = DEFAULT_DEPARTMENTS.map(
  (item) => item.costCenter
)

function sortByNameOrder<T extends { name: string }>(
  items: T[],
  orderedNames: string[]
): T[] {
  const order = new Map(
    orderedNames.map((name, index) => [name.toLowerCase(), index])
  )

  return [...items].sort((a, b) => {
    const aIndex = order.get(a.name.toLowerCase())
    const bIndex = order.get(b.name.toLowerCase())
    if (aIndex != null && bIndex != null) return aIndex - bIndex
    if (aIndex != null) return -1
    if (bIndex != null) return 1
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

export function sortDepartmentsByDefault<T extends { name: string }>(
  departments: T[]
): T[] {
  return sortByNameOrder(departments, DEFAULT_DEPARTMENT_NAMES)
}

export function sortCostCentersByDefault<T extends { name: string }>(
  costCenters: T[]
): T[] {
  return sortByNameOrder(costCenters, DEFAULT_COST_CENTER_NAMES)
}

export function defaultCostCenterNameForDepartment(
  departmentName: string
): string | undefined {
  return DEFAULT_DEPARTMENTS.find(
    (item) => item.name.toLowerCase() === departmentName.toLowerCase()
  )?.costCenter
}
