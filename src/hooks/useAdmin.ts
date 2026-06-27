import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminDB } from '@/lib/database'
import { useAuthStore } from '@/store'
import { applyTenantTheme } from '@/lib/utils'
import type { Tenant, User, UserRole } from '@/types'

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

export function useAdmin() {
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const tenant = useAuthStore((s) => s.tenant)
  const setTenant = useAuthStore((s) => s.setTenant)
  const [demoState, setDemoState] = useState(demoUsers)
  const isDemo = currentUser?.id === 'demo-user'
  const hasSupabaseEnv = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  const realDbEnabled = hasSupabaseEnv && !isDemo && currentUser?.role === 'ADMIN'

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminDB.listUsers,
    enabled: realDbEnabled,
    staleTime: 30_000,
  })

  const users = usersQuery.data ?? (isDemo ? demoState : [])

  const summary = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.active).length,
    admins: users.filter((user) => user.role === 'ADMIN').length,
    viewers: users.filter((user) => user.role === 'VIEWER').length,
  }), [users])

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

  return {
    users,
    tenant,
    summary,
    isDemo,
    isLoading: realDbEnabled ? usersQuery.isLoading : false,
    error: usersQuery.error,
    updateRole,
    updateActive,
    updateProfile,
    updateTenant,
  }
}
