import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminDB } from '@/lib/database'
import { useAuthStore } from '@/store'
import { applyTenantTheme } from '@/lib/utils'
import type { CreateTenantInput, Tenant, TenantContact, TenantContactInput, UpdateTenantInput, User, UserRole } from '@/types'

const demoUsers: User[] = [
  {
    id: 'demo-user',
    tenant_id: 'demo-tenant',
    full_name: 'Usuário Demo',
    email: 'demo@sap.local',
    role: 'ADMIN',
    active: true,
    created_at: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'demo-pmo',
    tenant_id: 'demo-tenant',
    full_name: 'PMO Kynovia',
    email: 'pmo@sap.local',
    role: 'USER',
    active: true,
    created_at: '2026-06-05T00:00:00.000Z',
  },
  {
    id: 'demo-viewer',
    tenant_id: 'demo-tenant',
    full_name: 'Sponsor Executivo',
    email: 'sponsor@sap.local',
    role: 'VIEWER',
    active: false,
    created_at: '2026-06-10T00:00:00.000Z',
  },
]

const demoTenants: Tenant[] = [
  {
    id: 'demo-tenant',
    tenant_id: 'demo-tenant',
    slug: 'kynovia-demo',
    name: 'Kynovia Demo',
    legal_name: 'Kynovia Tecnologia Ltda',
    trade_name: 'Kynovia',
    cnpj: '12.ABC.345/0001-90',
    company_email: 'contato@kynovia.com.br',
    company_whatsapp: '+55 11 99999-0000',
    city: 'Sao Paulo',
    state: 'SP',
    country: 'Brasil',
    primary_color: '#3B4FE8',
    secondary_color: '#1E2A78',
    accent_color: '#F59E0B',
    plan: 'professional',
    billing_model: 'per_project',
    billing_status: 'active',
    project_unit_price: 0,
    billing_currency: 'BRL',
    max_projects: 10,
    max_users: 50,
    ai_provider: 'openai',
    ai_model: 'gpt-4-turbo',
    active: true,
    created_at: '2026-06-01T00:00:00.000Z',
  },
]

const demoContacts: TenantContact[] = [
  {
    id: 'demo-contact-admin',
    tenant_id: 'demo-tenant',
    contact_type: 'admin',
    full_name: 'Administrador Cliente',
    job_title: 'Diretor de Tecnologia',
    email: 'admin@cliente.com.br',
    whatsapp: '+55 11 98888-0000',
    sort_order: 0,
    active: true,
    created_at: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'demo-contact-billing',
    tenant_id: 'demo-tenant',
    contact_type: 'billing',
    full_name: 'Responsavel Financeiro',
    job_title: 'Faturamento',
    email: 'financeiro@cliente.com.br',
    whatsapp: '+55 11 97777-0000',
    sort_order: 1,
    active: true,
    created_at: '2026-06-01T00:00:00.000Z',
  },
]

export function useAdmin() {
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const tenant = useAuthStore((s) => s.tenant)
  const setTenant = useAuthStore((s) => s.setTenant)
  const [demoState, setDemoState] = useState(demoUsers)
  const [demoTenantState, setDemoTenantState] = useState(demoTenants)
  const [demoContactState, setDemoContactState] = useState(demoContacts)
  const isDemo = currentUser?.id === 'demo-user'
  const isPlatformAdmin = currentUser?.role === 'SUPER_ADMIN'
  const hasSupabaseEnv = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  const realDbEnabled = hasSupabaseEnv && !isDemo && (currentUser?.role === 'ADMIN' || isPlatformAdmin)

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminDB.listUsers,
    enabled: realDbEnabled,
    staleTime: 30_000,
  })

  const activeProjectsQuery = useQuery({
    queryKey: ['admin', 'active-projects-count'],
    queryFn: adminDB.countActiveProjects,
    enabled: realDbEnabled,
    staleTime: 30_000,
  })

  const users = usersQuery.data ?? (isDemo ? demoState : [])

  const tenantsQuery = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: adminDB.listTenants,
    enabled: realDbEnabled && isPlatformAdmin,
    staleTime: 30_000,
  })

  const contactsQuery = useQuery({
    queryKey: ['admin', 'tenant-contacts', isPlatformAdmin ? 'all' : tenant?.id],
    queryFn: () => adminDB.listTenantContacts(isPlatformAdmin ? undefined : tenant?.id),
    enabled: realDbEnabled && Boolean(isPlatformAdmin || tenant?.id),
    staleTime: 30_000,
  })

  const tenants = tenantsQuery.data ?? (isDemo ? demoTenantState : tenant ? [tenant] : [])
  const tenantContacts = contactsQuery.data ?? (isDemo ? demoContactState : [])
  const activeProjects = activeProjectsQuery.data ?? (isDemo ? 1 : 0)

  const summary = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.active).length,
    admins: users.filter((user) => user.role === 'ADMIN' || user.role === 'SUPER_ADMIN').length,
    viewers: users.filter((user) => user.role === 'VIEWER').length,
    clients: tenants.filter((item) => item.active).length,
    activeProjects,
  }), [activeProjects, tenants, users])

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      if (!isDemo) return adminDB.updateUserRole(userId, role)
      let updated = demoState.find((user) => user.id === userId) as User
      setDemoState((items) => items.map((user) => {
        if (user.id !== userId) return user
        updated = { ...user, role }
        return updated
      }))
      return updated
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const updateActive = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      if (!isDemo) return adminDB.updateUserActive(userId, active)
      let updated = demoState.find((user) => user.id === userId) as User
      setDemoState((items) => items.map((user) => {
        if (user.id !== userId) return user
        updated = { ...user, active }
        return updated
      }))
      return updated
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const updateProfile = useMutation({
    mutationFn: async ({ userId, input }: { userId: string; input: Partial<Pick<User, 'full_name' | 'role' | 'active' | 'avatar_url'>> }) => {
      if (!isDemo) return adminDB.updateUser(userId, input)
      let updated = demoState.find((user) => user.id === userId) as User
      setDemoState((items) => items.map((user) => {
        if (user.id !== userId) return user
        updated = { ...user, ...input }
        return updated
      }))
      return updated
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })

  const updateTenant = useMutation({
    mutationFn: (input: Partial<Pick<Tenant, 'name' | 'primary_color' | 'secondary_color' | 'accent_color' | 'logo_url' | 'ai_provider' | 'ai_model'>>) =>
      isDemo || !tenant?.id ? Promise.resolve({ ...tenant!, ...input }) : adminDB.updateTenant(tenant.id, input),
    onSuccess: (updatedTenant) => {
      setTenant(updatedTenant)
      applyTenantTheme(updatedTenant)
      qc.invalidateQueries({ queryKey: ['admin', 'tenant'] })
    },
  })

  const createTenant = useMutation({
    mutationFn: async ({ tenant: input, contacts }: { tenant: CreateTenantInput; contacts: TenantContactInput[] }) => {
      if (!isDemo) {
        const created = await adminDB.createTenant(input)
        const savedContacts = await Promise.all(
          contacts.map((contact) => adminDB.createTenantContact({ ...contact, tenant_id: created.id }))
        )
        return { tenant: created, contacts: savedContacts }
      }

      const created: Tenant = {
        tenant_id: `demo-tenant-${Date.now()}`,
        primary_color: '#3B4FE8',
        secondary_color: '#1E2A78',
        accent_color: '#F59E0B',
        plan: 'professional',
        billing_model: 'per_project',
        billing_status: 'active',
        billing_currency: 'BRL',
        max_projects: 10,
        max_users: 50,
        ai_provider: 'openai',
        ai_model: 'gpt-4-turbo',
        active: true,
        created_at: new Date().toISOString(),
        ...input,
        id: `demo-tenant-${Date.now()}`,
      }
      const savedContacts = contacts.map((contact, index): TenantContact => ({
        ...contact,
        id: `demo-contact-${Date.now()}-${index}`,
        tenant_id: created.id,
        created_at: new Date().toISOString(),
      }))
      setDemoTenantState((items) => [created, ...items])
      setDemoContactState((items) => [...savedContacts, ...items])
      return { tenant: created, contacts: savedContacts }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      qc.invalidateQueries({ queryKey: ['admin', 'tenant-contacts'] })
    },
  })

  const updateTenantById = useMutation({
    mutationFn: async ({ tenantId, input }: { tenantId: string; input: UpdateTenantInput }) => {
      if (!isDemo) return adminDB.updateTenantById(tenantId, input)
      let updated = demoTenantState.find((item) => item.id === tenantId) as Tenant
      setDemoTenantState((items) => items.map((item) => {
        if (item.id !== tenantId) return item
        updated = { ...item, ...input }
        return updated
      }))
      return updated
    },
    onSuccess: (updatedTenant) => {
      if (updatedTenant.id === tenant?.id) {
        setTenant(updatedTenant)
        applyTenantTheme(updatedTenant)
      }
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
    },
  })

  const updateTenantContact = useMutation({
    mutationFn: async ({ contactId, input }: { contactId: string; input: Partial<TenantContactInput> }) => {
      if (!isDemo) return adminDB.updateTenantContact(contactId, input)
      let updated = demoContactState.find((item) => item.id === contactId) as TenantContact
      setDemoContactState((items) => items.map((item) => {
        if (item.id !== contactId) return item
        updated = { ...item, ...input }
        return updated
      }))
      return updated
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenant-contacts'] }),
  })

  return {
    users,
    tenant,
    tenants,
    tenantContacts,
    summary,
    isDemo,
    isPlatformAdmin,
    isLoading: realDbEnabled ? usersQuery.isLoading : false,
    error: usersQuery.error,
    updateRole,
    updateActive,
    updateProfile,
    updateTenant,
    createTenant,
    updateTenantById,
    updateTenantContact,
  }
}
