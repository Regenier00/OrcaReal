export const DEFAULT_DEPARTMENTS: Array<{ name: string; description: string }> = [
  { name: 'Administração Geral', description: 'Administrativo' },
  { name: 'Gestão Financeira', description: 'Financeiro' },
  { name: 'Contabilidade', description: 'Contabilidade' },
  { name: 'Recursos Humanos', description: 'Recursos Humanos' },
  { name: 'Vendas e Comercial', description: 'Comercial / Vendas' },
  { name: 'Marketing', description: 'Marketing' },
  { name: 'Compras', description: 'Compras' },
  { name: 'Estoque e Almoxarifado', description: 'Estoque / Almoxarifado' },
  { name: 'Operações e Produção', description: 'Operacional / Produção' },
  { name: 'Logística e Distribuição', description: 'Logística' },
]

export const DEFAULT_DEPARTMENT_NAMES = DEFAULT_DEPARTMENTS.map(
  (item) => item.name
)

export function sortDepartmentsByDefault<T extends { name: string }>(
  departments: T[]
): T[] {
  const order = new Map(
    DEFAULT_DEPARTMENT_NAMES.map((name, index) => [name.toLowerCase(), index])
  )

  return [...departments].sort((a, b) => {
    const aIndex = order.get(a.name.toLowerCase())
    const bIndex = order.get(b.name.toLowerCase())
    if (aIndex != null && bIndex != null) return aIndex - bIndex
    if (aIndex != null) return -1
    if (bIndex != null) return 1
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}
