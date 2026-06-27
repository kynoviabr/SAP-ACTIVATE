// ── Enums ─────────────────────────────────────────────────────
export type UserRole      = 'SUPER_ADMIN' | 'ADMIN' | 'USER' | 'VIEWER'
export type ProjectStatus = 'verde' | 'amarelo' | 'vermelho' | 'encerrado'
export type PhaseNumber   = '1' | '2' | '3' | '4' | '5'
export type TaskStatus    = 'pendente' | 'em_andamento' | 'concluido' | 'atrasado' | 'cancelado'
export type TaskType      = 'phase' | 'task' | 'milestone'
export type MacroSchedulePhase = 'Prepare' | 'Explore' | 'Realize' | 'Deploy' | 'Run'
export type MacroScheduleZoom  = 'day' | 'week' | 'month' | 'quarter'
export type MacroScheduleBaselineStatus = 'locked' | 'superseded'
export type IssueStatus   = 'aberta' | 'em_andamento' | 'resolvida' | 'atrasada' | 'cancelada'
export type IssuePriority = 'baixa' | 'media' | 'alta' | 'critica'
export type IssueType     = 'tecnica' | 'processo' | 'gestao' | 'cliente' | 'escopo'
export type RiskStatus    = 'identificado' | 'em_mitigacao' | 'mitigado' | 'ocorrido'
export type RiskCategory  = 'tecnico' | 'prazo' | 'recursos' | 'escopo' | 'externo' | 'qualidade'
export type RiskSeverity  = 'baixo' | 'medio' | 'alto' | 'critico'
export type QGAnswerType  = 'sim' | 'nao' | 'na'
export type BPDStatus     = 'pendente' | 'em_andamento' | 'concluido'
export type AIProvider    = 'openai' | 'anthropic' | 'gemini'

export interface ProjectFilters {
  search?: string
  client?: string
  project_manager?: string
  current_phase?: PhaseNumber | ''
  status?: ProjectStatus | ''
}

// ── Base ──────────────────────────────────────────────────────
export interface BaseEntity {
  id: string
  tenant_id: string
  created_at: string
  updated_at?: string
}

// ── Tenant ────────────────────────────────────────────────────
export interface Tenant extends BaseEntity {
  slug: string
  name: string
  legal_name?: string
  trade_name?: string
  cnpj?: string
  state_registration?: string
  municipal_registration?: string
  tax_regime?: string
  company_email?: string
  company_phone?: string
  company_whatsapp?: string
  website?: string
  zip_code?: string
  address_line?: string
  address_number?: string
  address_complement?: string
  district?: string
  city?: string
  state?: string
  country?: string
  logo_url?: string
  primary_color: string
  secondary_color: string
  accent_color: string
  domain?: string
  plan: 'free' | 'professional' | 'enterprise'
  billing_model?: 'per_project'
  billing_status?: 'trial' | 'active' | 'paused' | 'cancelled'
  project_unit_price?: number
  billing_currency?: 'BRL'
  billing_notes?: string
  max_projects: number
  max_users: number
  ai_provider: AIProvider
  ai_model: string
  active: boolean
}

// ── User ──────────────────────────────────────────────────────
export interface User extends BaseEntity {
  full_name: string
  email: string
  role: UserRole
  avatar_url?: string
  active: boolean
  last_login?: string
}

export type TenantContactType = 'admin' | 'billing' | 'additional'

export interface TenantContact extends BaseEntity {
  contact_type: TenantContactType
  full_name: string
  job_title?: string
  email: string
  whatsapp?: string
  notes?: string
  sort_order: number
  active: boolean
}

export type CreateTenantInput = Pick<Tenant, 'slug' | 'name'> & Partial<Omit<Tenant, keyof BaseEntity | 'slug' | 'name'>>
export type UpdateTenantInput = Partial<CreateTenantInput>
export type TenantContactInput = Omit<TenantContact, 'id' | 'created_at' | 'updated_at'>
export interface CreateTenantUserInput {
  tenant_id: string
  full_name: string
  email: string
  password: string
  role: UserRole
}

// ── Project ───────────────────────────────────────────────────
export interface Project extends BaseEntity {
  name: string
  client: string
  project_manager: string
  pm_user_id?: string
  sponsor?: string
  sponsor_email?: string
  objective?: string
  methodology: string
  current_phase: PhaseNumber
  status: ProjectStatus
  start_date: string
  golive_date: string
  spi: number
  cpi: number
  progress_pct: number
  planned_value: number
  earned_value: number
  actual_cost: number
  modules: string[]
  tags: string[]
  active: boolean
  archived: boolean
  created_by?: string
}

export type CreateProjectInput = Omit<Project, 'id'|'tenant_id'|'created_at'|'updated_at'|'spi'|'cpi'|'status'>
export type UpdateProjectInput = Partial<CreateProjectInput>

// ── Project Member ────────────────────────────────────────────
export interface ProjectMember extends BaseEntity {
  project_id: string
  user_id?: string
  full_name: string
  email: string
  role: UserRole
  module?: string
  function?: string
  is_leader: boolean
  company?: string
  active: boolean
}

export type ProjectMemberInput = Omit<ProjectMember, 'id'|'created_at'|'updated_at'>

// ── Task ──────────────────────────────────────────────────────
export interface Task extends BaseEntity {
  project_id: string
  parent_id?: string
  wbs: string
  title: string
  phase?: PhaseNumber
  type: TaskType
  start_date?: string
  end_date?: string
  duration_days?: number
  assignee?: string
  status: TaskStatus
  progress_pct: number
  planned_hours: number
  actual_hours: number
  dependencies: string[]
  notes?: string
  sort_order: number
}

export type CreateTaskInput = Omit<Task, 'id'|'tenant_id'|'created_at'|'updated_at'>
export type UpdateTaskInput = Partial<CreateTaskInput>

// ── Macro Schedule ────────────────────────────────────────────
export interface MacroScheduleTask extends BaseEntity {
  project_id: string
  wbs: string
  parent_id?: string
  title: string
  phase: MacroSchedulePhase
  squad?: string
  responsible?: string
  allocation_pct: number
  start_date?: string
  end_date?: string
  is_milestone: boolean
  planned_pct: number
  real_pct: number
  predecessors: number[]
  hours: number
  level: number
  sort_order: number
  notes?: string
  source_uid?: number
  source_id?: number
  source_outline_number?: string
  source_outline_level?: number
  source_calendar_uid?: number
  source_constraint_type?: number
  source_constraint_date?: string
  source_is_summary?: boolean
  source_is_critical?: boolean
  source_is_active?: boolean
  source_is_manual?: boolean
  source_raw?: Record<string, unknown>
}

export interface MacroScheduleHoliday extends BaseEntity {
  project_id: string
  holiday_date: string
  name: string
  source: 'manual' | 'br-national' | 'detected'
}

export interface MacroScheduleBaseline extends BaseEntity {
  project_id: string
  version: number
  name: string
  baseline_date: string
  status: MacroScheduleBaselineStatus
  locked_at: string
  locked_by?: string
  notes?: string
  task_count: number
  total_weight: number
}

export interface MacroScheduleBaselineTask {
  id: string
  tenant_id: string
  baseline_id: string
  project_id: string
  original_task_id?: string
  wbs: string
  title: string
  phase: MacroSchedulePhase
  squad?: string
  responsible?: string
  allocation_pct: number
  start_date?: string
  end_date?: string
  is_milestone: boolean
  planned_pct: number
  real_pct: number
  predecessors: number[]
  hours: number
  level: number
  sort_order: number
  notes?: string
  created_at: string
}

export interface MacroScheduleSnapshot extends BaseEntity {
  project_id: string
  baseline_id?: string
  status_date: string
  measured_at: string
  measured_by?: string
  notes?: string
  task_count: number
  total_weight: number
  planned_pct: number
  real_pct: number
  pv: number
  ev: number
  spi?: number | null
  delayed_count: number
}

export interface MacroScheduleSnapshotTask {
  id: string
  tenant_id: string
  snapshot_id: string
  baseline_task_id?: string
  project_id: string
  wbs: string
  title: string
  planned_pct: number
  real_pct: number
  weight: number
  pv: number
  ev: number
  spi?: number | null
  is_delayed: boolean
  notes?: string
  created_at: string
}

export type CreateMacroScheduleTaskInput = Omit<MacroScheduleTask, 'id'|'tenant_id'|'created_at'|'updated_at'>
export type UpdateMacroScheduleTaskInput = Partial<CreateMacroScheduleTaskInput>
export type MacroScheduleHolidayInput = Omit<MacroScheduleHoliday, 'id'|'tenant_id'|'created_at'|'updated_at'>
export type CreateMacroScheduleBaselineInput = Omit<MacroScheduleBaseline, 'id'|'tenant_id'|'created_at'|'updated_at'>
export type UpdateMacroScheduleBaselineInput = Partial<CreateMacroScheduleBaselineInput>
export type CreateMacroScheduleBaselineTaskInput = Omit<MacroScheduleBaselineTask, 'id'|'tenant_id'|'created_at'>
export type CreateMacroScheduleSnapshotInput = Omit<MacroScheduleSnapshot, 'id'|'tenant_id'|'created_at'|'updated_at'>
export type UpdateMacroScheduleSnapshotInput = Partial<CreateMacroScheduleSnapshotInput>
export type CreateMacroScheduleSnapshotTaskInput = Omit<MacroScheduleSnapshotTask, 'id'|'tenant_id'|'created_at'>

// ── Issue ─────────────────────────────────────────────────────
export interface Issue extends BaseEntity {
  project_id: string
  issue_number: number
  code: string
  description: string
  issue_type: IssueType
  priority: IssuePriority
  phase?: PhaseNumber
  status: IssueStatus
  assignee?: string
  opened_by?: string
  due_date?: string
  resolved_at?: string
  action_plan?: string
  resolution?: string
}

export type CreateIssueInput = Omit<Issue, 'id'|'tenant_id'|'created_at'|'updated_at'|'issue_number'|'code'>
export type UpdateIssueInput = Partial<CreateIssueInput>

// ── Risk ──────────────────────────────────────────────────────
export interface Risk extends BaseEntity {
  project_id: string
  risk_number: number
  code: string
  description: string
  category: RiskCategory
  phase?: PhaseNumber
  impact: number
  probability: number
  exposure: number
  severity: RiskSeverity
  status: RiskStatus
  assignee?: string
  mitigation?: string
  contingency?: string
  occurred_at?: string
}

export type CreateRiskInput = Omit<Risk, 'id'|'tenant_id'|'created_at'|'updated_at'|'risk_number'|'code'|'exposure'|'severity'>
export type UpdateRiskInput = Partial<CreateRiskInput>

// ── BPD ───────────────────────────────────────────────────────
export interface BPDItem extends BaseEntity {
  project_id: string
  bpd_id: string
  module: string
  process_name: string
  version: string
  priority: 'alta' | 'media' | 'baixa'
  item_type: 'obrigatorio' | 'desejavel' | 'futuro'
  status: BPDStatus
  legal_refs?: string
  consultant?: string
  key_user?: string
  reviewer?: string
  approver?: string
  as_is?: string
  to_be?: string
  triggers?: string
  solution?: string
  gap_type: 'standard' | 'config' | 'development'
  complexity: 'baixa' | 'media' | 'alta' | 'critica'
  effort_hours: number
  acceptance?: string
  exclusions?: string
  client_signed: boolean
  sort_order: number
}

export type CreateBPDInput = Omit<BPDItem, 'id'|'tenant_id'|'created_at'|'updated_at'>
export type UpdateBPDInput = Partial<CreateBPDInput>

// ── Quality Gate ──────────────────────────────────────────────
export interface QGTemplate {
  id: string
  tenant_id?: string
  phase: PhaseNumber
  description: string
  required: boolean
  sort_order: number
  active: boolean
}

export interface QGAnswerRecord extends BaseEntity {
  project_id: string
  template_id: string
  phase: PhaseNumber
  answer?: QGAnswerType
  notes?: string
  answered_by?: string
  answered_at?: string
}

export interface QGDecision extends BaseEntity {
  project_id: string
  phase: PhaseNumber
  decision: 'aprovado' | 'rejeitado'
  comments?: string
  decided_by?: string
  decided_at: string
}

// ── Kickoff ───────────────────────────────────────────────────
export interface Kickoff extends BaseEntity {
  project_id: string
  kickoff_date?: string
  location?: string
  platform: string
  duration_hours: number
  modality: 'remoto' | 'presencial' | 'hibrido'
  objective?: string
  agenda?: string
  results?: string
  decisions?: string
  next_steps?: string
  gp_signed_at?: string
  sponsor_signed_at?: string
  presentation_url?: string
  minutes_url?: string
  ai_generated: boolean
  ai_content: Record<string, unknown>
}

// ── AI ────────────────────────────────────────────────────────
export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ProjectContext {
  projectId: string
  projectName: string
  client: string
  currentPhase: PhaseNumber
  status: ProjectStatus
  spi: number
  progress: number
  goLiveDate: string
  openIssues: number
  criticalRisks: number
  modules: string[]
}

// ── Activity ──────────────────────────────────────────────────
export interface ActivityLog extends BaseEntity {
  project_id?: string
  user_id?: string
  user_name?: string
  action: string
  entity_type: string
  entity_id?: string
  entity_label?: string
}

// ── Notification ──────────────────────────────────────────────
export interface Notification extends BaseEntity {
  user_id: string
  project_id?: string
  type: string
  title: string
  body?: string
  read: boolean
  read_at?: string
}

// ── Transversal Modules ───────────────────────────────────────
export interface CostItem extends BaseEntity {
  project_id: string
  description: string
  category?: string
  amount: number
  currency: string
  date?: string
  notes?: string
}

export type CreateCostInput = Omit<CostItem, 'id'|'tenant_id'|'created_at'|'updated_at'>
export type UpdateCostInput = Partial<CreateCostInput>

export interface ChangeRequest extends BaseEntity {
  project_id: string
  cr_number: number
  title: string
  description?: string
  impact?: string
  requester?: string
  status: 'aberta' | 'aprovada' | 'rejeitada' | 'cancelada'
  decision_date?: string
  notes?: string
}

export type CreateChangeRequestInput = Omit<ChangeRequest, 'id'|'tenant_id'|'created_at'|'updated_at'|'cr_number'>
export type UpdateChangeRequestInput = Partial<CreateChangeRequestInput>

export interface BillingItem extends BaseEntity {
  project_id: string
  milestone: string
  amount: number
  currency: string
  due_date?: string
  invoice_date?: string
  payment_date?: string
  status: 'pendente' | 'faturado' | 'pago' | 'cancelado'
  notes?: string
}

export type CreateBillingInput = Omit<BillingItem, 'id'|'tenant_id'|'created_at'|'updated_at'>
export type UpdateBillingInput = Partial<CreateBillingInput>

export interface TravelItem extends BaseEntity {
  project_id: string
  traveler: string
  destination?: string
  departure_date?: string
  return_date?: string
  purpose?: string
  estimated_cost?: number
  actual_cost?: number
  status: 'solicitada' | 'aprovada' | 'realizada' | 'cancelada'
  notes?: string
}

export type CreateTravelInput = Omit<TravelItem, 'id'|'tenant_id'|'created_at'|'updated_at'>
export type UpdateTravelInput = Partial<CreateTravelInput>

// ── Constants ─────────────────────────────────────────────────
export const PHASE_INFO = {
  '1': { label: 'Fase 1 — Prepare', short: 'Prepare', icon: 'compass', color: '#10b981' },
  '2': { label: 'Fase 2 — Explore', short: 'Explore', icon: 'search', color: '#F59E0B' },
  '3': { label: 'Fase 3 — Realize', short: 'Realize', icon: 'settings', color: '#3B4FE8' },
  '4': { label: 'Fase 4 — Deploy',  short: 'Deploy',  icon: 'rocket', color: '#8b5cf6' },
  '5': { label: 'Fase 5 — Run',     short: 'Run',     icon: 'clipboard', color: '#ec4899' },
} as const

export const SAP_MODULES = ['FI','CO','MM','SD','PP','HR','BI/BW','BASIS','ABAP','WM','PM','QM','PS']
