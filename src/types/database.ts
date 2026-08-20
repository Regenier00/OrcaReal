export type CompanyRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface Profile {
  id: string
  name: string
  email: string | null
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  trade_name: string | null
  document: string | null
  description: string | null
  logo_url: string | null
  brand_color: string | null
  created_at: string
  updated_at: string
}

export interface CompanyUser {
  id: string
  company_id: string
  user_id: string
  role: CompanyRole
  created_at: string
}

export interface CompanyMembership extends CompanyUser {
  company: Company
}

export interface Segment {
  id: string
  code: string
  name: string
  description: string | null
}

export interface CompanyProfile {
  id: string
  company_id: string
  segment_id: string | null
  custom_segment: string | null
  company_size: string | null
  employee_count: number | null
  employee_count_range: string | null
  state: string | null
  city: string | null
  operation_model: string | null
  revenue_model: string | null
  primary_activity: string | null
  financial_control_method: string | null
  main_objective: string | null
  maturity_level: string | null
  profile_summary: string | null
  profile_facts: Record<string, unknown>
  onboarding_completed: boolean
  questionnaire_completed: boolean
  experience_ready: boolean
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  company_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CostCenter {
  id: string
  company_id: string
  name: string
  code: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CompanySettings {
  id: string
  company_id: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CompanyMember {
  id: string
  company_id: string
  user_id: string
  role: CompanyRole
  created_at: string
  profile: Profile | null
}

export type CategoryType = 'revenue' | 'expense' | 'cost'
export type MoneyGroup = 'revenue' | 'cost' | 'expense' | 'investment'
export type BudgetPeriodKind = 'calendar_year' | 'custom'
export type BudgetStatus = 'draft' | 'active' | 'archived'

export interface BudgetDestination {
  id: string
  company_id: string
  money_group: MoneyGroup
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DestinationMatchPatternRow {
  id: string
  company_id: string
  match_type: 'counterparty' | 'description_contains' | 'description_exact'
  match_value: string
  money_group: MoneyGroup
  destination_id: string | null
  destination_name: string
  usage_count: number
  last_classified_at: string
  created_at: string
  updated_at: string
}

export interface BudgetGroupTotal {
  id: string
  budget_id: string
  company_id: string
  money_group: MoneyGroup
  created_at: string
  updated_at: string
}

export interface BudgetGroupTotalValue {
  id: string
  budget_group_total_id: string
  company_id: string
  year: number
  month: number
  amount: number
}

export interface BusinessUnit {
  id: string
  company_id: string
  name: string
  code: string | null
  description: string | null
  is_active: boolean
}

export interface DepartmentCostCenter {
  id: string
  department_id: string
  cost_center_id: string
}

export interface Category {
  id: string
  company_id: string
  name: string
  category_type: CategoryType
  parent_id: string | null
  is_active: boolean
}

export interface Activity {
  id: string
  code: string
  name: string
  description: string | null
  segment_id: string | null
}

export interface Budget {
  id: string
  company_id: string
  name: string
  fiscal_year: number
  period_label: string
  period_kind: BudgetPeriodKind
  start_date: string
  end_date: string
  business_unit_id: string | null
  notes: string | null
  status: BudgetStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BudgetItem {
  id: string
  budget_id: string
  company_id: string
  business_unit_id: string | null
  department_id: string | null
  cost_center_id: string | null
  activity_id: string | null
  category_id: string | null
  money_group: MoneyGroup | null
  destination_id: string | null
  destination_name: string | null
  sort_order: number
}

export interface BudgetItemValue {
  id: string
  budget_item_id: string
  company_id: string
  year: number
  month: number
  amount: number
}

export interface Actual {
  id: string
  company_id: string
  budget_id: string
  name: string
  fiscal_year: number
  period_label: string
  period_kind: BudgetPeriodKind
  start_date: string
  end_date: string
  business_unit_id: string | null
  notes: string | null
  status: BudgetStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ActualItem {
  id: string
  actual_id: string
  company_id: string
  business_unit_id: string | null
  department_id: string | null
  cost_center_id: string | null
  activity_id: string | null
  category_id: string | null
  money_group: MoneyGroup | null
  destination_id: string | null
  destination_name: string | null
  sort_order: number
}

export interface ActualItemValue {
  id: string
  actual_item_id: string
  company_id: string
  year: number
  month: number
  amount: number
}

export interface SystemIndicator {
  id: string
  code: string
  name: string
  description: string | null
  formula_hint: string | null
  sort_order: number
  is_active: boolean
}

export interface CompanyCustomUnit {
  id: string
  company_id: string
  code: string
  name: string
  description: string | null
  quantity_noun: string
  quantity_noun_singular: string
  created_at: string
  updated_at: string
}

export interface CompanyCustomIndicator {
  id: string
  company_id: string
  name: string
  description: string | null
  unit_source: 'catalog' | 'custom'
  unit_code: string
  unit_name: string
  quantity_noun: string
  quantity_noun_singular: string
  custom_unit_id: string | null
  formula: unknown
  display_unit: string
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type BankAccountType = 'checking' | 'savings' | 'payment' | 'other'
export type StatementFileType = 'ofx' | 'csv' | 'xlsx' | 'pdf' | 'unknown'
export type StatementImportStatus =
  | 'uploaded'
  | 'identifying'
  | 'parsing'
  | 'normalizing'
  | 'completed'
  | 'failed'
  | 'ocr_required'
export type ActualTransactionType = 'income' | 'expense' | 'unknown'
export type ActualTransactionStatus = 'pending' | 'classified' | 'ignored'

export type ErpFileType = 'xlsx' | 'csv' | 'ofx' | 'pdf' | 'unknown'
export type ErpImportStatus =
  | 'uploaded'
  | 'validating'
  | 'identifying'
  | 'parsing'
  | 'normalizing'
  | 'classifying'
  | 'completed'
  | 'failed'
export type ErpEntrySide = 'debit' | 'credit' | 'unknown'
export type ErpEntryStatus = 'pending' | 'classified' | 'ignored'
export type ErpClassificationMatchType =
  | 'account_code'
  | 'account_name'
  | 'cost_center'
  | 'department'
  | 'description_exact'
  | 'description_contains'

export interface ErpImport {
  id: string
  company_id: string
  file_name: string
  file_path: string | null
  file_size: number | null
  file_type: ErpFileType
  mime_type: string | null
  file_hash: string | null
  detected_layout: Record<string, unknown>
  status: ErpImportStatus
  entry_count: number
  classified_count: number
  pending_count: number
  ignored_count: number
  error_count: number
  duplicate_count: number
  revenue_count: number
  cost_count: number
  expense_count: number
  investment_count: number
  period_start: string | null
  period_end: string | null
  error_message: string | null
  warnings: Array<{ message: string; row?: number }>
  created_by: string | null
  created_at: string
  updated_at: string
  processed_at: string | null
}

export interface ErpEntry {
  id: string
  company_id: string
  import_id: string | null
  posted_at: string
  description: string
  amount: number
  entry_side: ErpEntrySide
  type: ActualTransactionType
  account_code: string | null
  account_name: string | null
  cost_center_code: string | null
  cost_center_name: string | null
  department_name: string | null
  document_number: string | null
  external_id: string | null
  fingerprint: string
  department_id: string | null
  cost_center_id: string | null
  money_group: MoneyGroup | null
  destination_id: string | null
  destination_name: string | null
  status: ErpEntryStatus
  suggested_money_group: MoneyGroup | null
  suggested_destination_id: string | null
  suggested_destination_name: string | null
  suggested_department_id: string | null
  suggested_cost_center_id: string | null
  suggestion_source: 'rule' | 'heuristic' | 'history' | null
  classified_at: string | null
  classified_by: string | null
  created_at: string
  updated_at: string
}

export interface ErpClassificationRule {
  id: string
  company_id: string
  match_type: ErpClassificationMatchType
  match_value: string
  money_group: MoneyGroup
  destination_id: string | null
  destination_name: string
  department_id: string | null
  cost_center_id: string | null
  priority: number
  usage_count: number
  is_active: boolean
  created_by: string | null
  last_classified_at: string
  created_at: string
  updated_at: string
}

export interface BankAccount {
  id: string
  company_id: string
  name: string
  bank_code: string | null
  bank_name: string | null
  agency: string | null
  account_number: string | null
  account_digit: string | null
  account_type: BankAccountType
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StatementImport {
  id: string
  company_id: string
  bank_account_id: string
  file_name: string
  file_path: string | null
  file_size: number | null
  file_type: StatementFileType
  detected_bank: string | null
  status: StatementImportStatus
  transaction_count: number
  income_count: number
  expense_count: number
  transfer_count: number
  classified_count: number
  pending_count: number
  ignored_count: number
  error_count: number
  duplicate_count: number
  period_start: string | null
  period_end: string | null
  error_message: string | null
  warnings: Array<{ message: string; row?: number }>
  created_by: string | null
  created_at: string
  updated_at: string
  processed_at: string | null
}

export interface ActualTransaction {
  id: string
  company_id: string
  bank_account_id: string
  import_id: string | null
  posted_at: string
  description: string
  amount: number
  type: ActualTransactionType
  balance: number | null
  category_id: string | null
  department_id: string | null
  cost_center_id: string | null
  money_group: MoneyGroup | null
  destination_id: string | null
  destination_name: string | null
  status: ActualTransactionStatus
  external_id: string | null
  fingerprint: string
  document_number: string | null
  counterparty: string | null
  suggested_category_id: string | null
  suggested_department_id: string | null
  suggested_cost_center_id: string | null
  suggested_money_group: MoneyGroup | null
  suggested_destination_id: string | null
  suggested_destination_name: string | null
  suggestion_source: 'history' | 'rule' | null
  classified_at: string | null
  classified_by: string | null
  created_at: string
  updated_at: string
}
