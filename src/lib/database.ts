import { supabase } from './supabase'
import type {
  Project, CreateProjectInput, UpdateProjectInput,
  Issue, CreateIssueInput, UpdateIssueInput,
  Risk, CreateRiskInput, UpdateRiskInput,
  BPDItem, CreateBPDInput, UpdateBPDInput,
  Task, CreateTaskInput, UpdateTaskInput,
  ProjectMember, Kickoff, ActivityLog,
  PhaseNumber, QGAnswerType,
  ProjectMemberInput,
  CostItem, CreateCostInput, UpdateCostInput,
  ChangeRequest, CreateChangeRequestInput, UpdateChangeRequestInput,
  BillingItem, CreateBillingInput, UpdateBillingInput,
  TravelItem, CreateTravelInput, UpdateTravelInput,
  User, Tenant, UserRole, TenantContact, CreateTenantInput, UpdateTenantInput, TenantContactInput,
} from '@/types'

async function q<T>(fn: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await fn()
  if (error) throw error
  return data as T
}

// ── Projects ──────────────────────────────────────────────────
export const projectsDB = {
  list: () => q<Project[]>(() =>
    supabase.from('projects').select('*').eq('active', true).order('updated_at', { ascending: false })
  ),
  get: (id: string) => q<Project>(() =>
    supabase.from('projects').select('*').eq('id', id).single()
  ),
  getSummaries: () => q<Project[]>(() =>
    supabase.from('projects')
      .select('*')
      .eq('active', true).eq('archived', false)
      .order('updated_at', { ascending: false })
  ),
  create: (input: CreateProjectInput) => q<Project>(() =>
    supabase.from('projects').insert(input).select().single()
  ),
  update: (id: string, input: UpdateProjectInput) => q<Project>(() =>
    supabase.from('projects').update(input).eq('id', id).select().single()
  ),
  archive: (id: string) => q<Project>(() =>
    supabase.from('projects').update({ archived: true, active: false }).eq('id', id).select().single()
  ),
}

// ── Issues ────────────────────────────────────────────────────
export const issuesDB = {
  list: (projectId: string) => q<Issue[]>(() =>
    supabase.from('issues').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
  ),
  create: (input: CreateIssueInput) => q<Issue>(() =>
    supabase.from('issues').insert(input).select().single()
  ),
  update: (id: string, input: UpdateIssueInput) => q<Issue>(() =>
    supabase.from('issues').update(input).eq('id', id).select().single()
  ),
  delete: (id: string) => q<null>(() =>
    supabase.from('issues').delete().eq('id', id)
  ),
}

// ── Risks ─────────────────────────────────────────────────────
export const risksDB = {
  list: (projectId: string) => q<Risk[]>(() =>
    supabase.from('risks').select('*').eq('project_id', projectId).order('exposure', { ascending: false })
  ),
  create: (input: CreateRiskInput) => q<Risk>(() =>
    supabase.from('risks').insert(input).select().single()
  ),
  update: (id: string, input: UpdateRiskInput) => q<Risk>(() =>
    supabase.from('risks').update(input).eq('id', id).select().single()
  ),
  delete: (id: string) => q<null>(() =>
    supabase.from('risks').delete().eq('id', id)
  ),
  getCritical: (projectId: string) => q<Risk[]>(() =>
    supabase.from('risks').select('*')
      .eq('project_id', projectId).gte('exposure', 8).neq('status', 'mitigado')
      .order('exposure', { ascending: false })
  ),
}

// ── BPD ───────────────────────────────────────────────────────
export const bpdDB = {
  list: (projectId: string) => q<BPDItem[]>(() =>
    supabase.from('bpd_items').select('*').eq('project_id', projectId).order('sort_order')
  ),
  create: (input: CreateBPDInput) => q<BPDItem>(() =>
    supabase.from('bpd_items').insert(input).select().single()
  ),
  update: (id: string, input: UpdateBPDInput) => q<BPDItem>(() =>
    supabase.from('bpd_items').update(input).eq('id', id).select().single()
  ),
  delete: (id: string) => q<null>(() =>
    supabase.from('bpd_items').delete().eq('id', id)
  ),
}

// ── Tasks ─────────────────────────────────────────────────────
export const tasksDB = {
  list: (projectId: string) => q<Task[]>(() =>
    supabase.from('tasks').select('*').eq('project_id', projectId).order('sort_order')
  ),
  listByPhase: (projectId: string, phase: string) => q<Task[]>(() =>
    supabase.from('tasks').select('*').eq('project_id', projectId).eq('phase', phase).order('sort_order')
  ),
  create: (input: CreateTaskInput) => q<Task>(() =>
    supabase.from('tasks').insert(input).select().single()
  ),
  update: (id: string, input: UpdateTaskInput) => q<Task>(() =>
    supabase.from('tasks').update(input).eq('id', id).select().single()
  ),
  delete: (id: string) => q<null>(() =>
    supabase.from('tasks').delete().eq('id', id)
  ),
  bulkInsert: (tasks: CreateTaskInput[]) => q<Task[]>(() =>
    supabase.from('tasks').insert(tasks).select()
  ),
}

// ── Quality Gate ──────────────────────────────────────────────
export const qualityGateDB = {
  getTemplates: (phase: string) =>
    supabase.from('quality_gate_templates').select('*').eq('phase', phase).eq('active', true).order('sort_order'),
  getAnswers: (projectId: string, phase: string) =>
    supabase.from('quality_gate_answers').select('*').eq('project_id', projectId).eq('phase', phase),
  upsertAnswer: (data: {
    project_id: string; tenant_id: string; template_id: string
    phase: string; answer: QGAnswerType; notes?: string
  }) =>
    supabase.from('quality_gate_answers').upsert(data, { onConflict: 'project_id,template_id' }).select().single(),
  getDecision: (projectId: string, phase: string) =>
    supabase.from('quality_gate_decisions').select('*').eq('project_id', projectId).eq('phase', phase).maybeSingle(),
  saveDecision: (data: {
    project_id: string; tenant_id: string; phase: string
    decision: 'aprovado' | 'rejeitado'; comments?: string
  }) =>
    supabase.from('quality_gate_decisions').upsert(data, { onConflict: 'project_id,phase' }).select().single(),
}

// ── Members ───────────────────────────────────────────────────
export const membersDB = {
  list: (projectId: string) => q<ProjectMember[]>(() =>
    supabase.from('project_members').select('*').eq('project_id', projectId).eq('active', true).order('module')
  ),
  create: (input: ProjectMemberInput) => q<ProjectMember>(() =>
    supabase.from('project_members').insert(input).select().single()
  ),
  update: (id: string, input: Partial<ProjectMemberInput>) => q<ProjectMember>(() =>
    supabase.from('project_members').update(input).eq('id', id).select().single()
  ),
  delete: (id: string) => q<ProjectMember>(() =>
    supabase.from('project_members').update({ active: false }).eq('id', id).select().single()
  ),
  bulkInsert: (members: ProjectMemberInput[]) => q<ProjectMember[]>(() =>
    supabase.from('project_members').insert(members).select()
  ),
}

// ── Kickoff ───────────────────────────────────────────────────
export const kickoffDB = {
  get: (projectId: string) =>
    supabase.from('kickoffs').select('*').eq('project_id', projectId).maybeSingle(),
  upsert: (data: Partial<Kickoff> & { project_id: string; tenant_id: string }) =>
    supabase.from('kickoffs').upsert(data, { onConflict: 'project_id' }).select().single(),
}

// ── Phases ────────────────────────────────────────────────────
export const phasesDB = {
  list: (projectId: string) =>
    supabase.from('project_phases').select('*').eq('project_id', projectId).order('phase'),
  upsert: (data: { project_id: string; tenant_id: string; phase: PhaseNumber; label: string; start_date?: string; end_date?: string; planned_days?: number }) =>
    supabase.from('project_phases').upsert(data, { onConflict: 'project_id,phase' }).select().single(),
}

// ── Activity ──────────────────────────────────────────────────
export const activityDB = {
  list: (projectId: string, limit = 20) =>
    supabase.from('activity_log').select('*').eq('project_id', projectId)
      .order('created_at', { ascending: false }).limit(limit),
  log: (data: Omit<ActivityLog, 'id'|'created_at'>) =>
    supabase.from('activity_log').insert(data),
}

// ── Costs ─────────────────────────────────────────────────────
export const costsDB = {
  list: (projectId: string) => q<CostItem[]>(() =>
    supabase.from('costs').select('*').eq('project_id', projectId).order('date', { ascending: false })
  ),
  create: (input: CreateCostInput) => q<CostItem>(() =>
    supabase.from('costs').insert(input).select().single()
  ),
  update: (id: string, input: UpdateCostInput) => q<CostItem>(() =>
    supabase.from('costs').update(input).eq('id', id).select().single()
  ),
  delete: (id: string) => q<null>(() =>
    supabase.from('costs').delete().eq('id', id)
  ),
}

// ── Change Requests ───────────────────────────────────────────
export const changeRequestsDB = {
  list: (projectId: string) => q<ChangeRequest[]>(() =>
    supabase.from('change_requests').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
  ),
  create: (input: CreateChangeRequestInput) => q<ChangeRequest>(() =>
    supabase.from('change_requests').insert(input).select().single()
  ),
  update: (id: string, input: UpdateChangeRequestInput) => q<ChangeRequest>(() =>
    supabase.from('change_requests').update(input).eq('id', id).select().single()
  ),
  delete: (id: string) => q<null>(() =>
    supabase.from('change_requests').delete().eq('id', id)
  ),
}

// ── Billing ───────────────────────────────────────────────────
export const billingDB = {
  list: (projectId: string) => q<BillingItem[]>(() =>
    supabase.from('billing').select('*').eq('project_id', projectId).order('due_date', { ascending: true })
  ),
  create: (input: CreateBillingInput) => q<BillingItem>(() =>
    supabase.from('billing').insert(input).select().single()
  ),
  update: (id: string, input: UpdateBillingInput) => q<BillingItem>(() =>
    supabase.from('billing').update(input).eq('id', id).select().single()
  ),
  delete: (id: string) => q<null>(() =>
    supabase.from('billing').delete().eq('id', id)
  ),
}

// ── Travels ───────────────────────────────────────────────────
export const travelsDB = {
  list: (projectId: string) => q<TravelItem[]>(() =>
    supabase.from('travels').select('*').eq('project_id', projectId).order('departure_date', { ascending: false })
  ),
  create: (input: CreateTravelInput) => q<TravelItem>(() =>
    supabase.from('travels').insert(input).select().single()
  ),
  update: (id: string, input: UpdateTravelInput) => q<TravelItem>(() =>
    supabase.from('travels').update(input).eq('id', id).select().single()
  ),
  delete: (id: string) => q<null>(() =>
    supabase.from('travels').delete().eq('id', id)
  ),
}

// ── Admin ─────────────────────────────────────────────────────
export const adminDB = {
  listUsers: () => q<User[]>(() =>
    supabase.from('users').select('*').order('created_at', { ascending: false })
  ),
  listTenants: () => q<Tenant[]>(() =>
    supabase.from('tenants').select('*').order('created_at', { ascending: false })
  ),
  createTenant: (input: CreateTenantInput) =>
    q<Tenant>(() => supabase.from('tenants').insert(input).select().single()),
  updateTenantById: (id: string, input: UpdateTenantInput) =>
    q<Tenant>(() => supabase.from('tenants').update(input).eq('id', id).select().single()),
  listTenantContacts: (tenantId?: string) => q<TenantContact[]>(() => {
    let query = supabase.from('tenant_contacts').select('*').eq('active', true).order('tenant_id').order('sort_order')
    if (tenantId) query = query.eq('tenant_id', tenantId)
    return query
  }),
  createTenantContact: (input: TenantContactInput) =>
    q<TenantContact>(() => supabase.from('tenant_contacts').insert(input).select().single()),
  updateTenantContact: (id: string, input: Partial<TenantContactInput>) =>
    q<TenantContact>(() => supabase.from('tenant_contacts').update(input).eq('id', id).select().single()),
  deleteTenantContact: (id: string) =>
    q<TenantContact>(() => supabase.from('tenant_contacts').update({ active: false }).eq('id', id).select().single()),
  updateUser: (id: string, input: Partial<Pick<User, 'full_name' | 'role' | 'active' | 'avatar_url'>>) =>
    q<User>(() => supabase.from('users').update(input).eq('id', id).select().single()),
  updateUserRole: (id: string, role: UserRole) =>
    q<User>(() => supabase.from('users').update({ role }).eq('id', id).select().single()),
  updateUserActive: (id: string, active: boolean) =>
    q<User>(() => supabase.from('users').update({ active }).eq('id', id).select().single()),
  updateTenant: (id: string, input: Partial<Pick<Tenant, 'name' | 'primary_color' | 'secondary_color' | 'accent_color' | 'logo_url' | 'ai_provider' | 'ai_model'>>) =>
    q<Tenant>(() => supabase.from('tenants').update(input).eq('id', id).select().single()),
}
