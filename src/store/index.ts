// src/store/index.ts
// ── Auth Store ────────────────────────────────────────────────────────────
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Tenant, Project, ProjectFilters, PhaseNumber } from '../types'
import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────
// AUTH STORE
// ─────────────────────────────────────────────────────────────────────────
interface AuthStore {
  user:    User | null
  tenant:  Tenant | null
  loading: boolean
  error:   string | null

  login:        (email: string, password: string) => Promise<void>
  logout:       () => Promise<void>
  loadSession:  () => Promise<void>
  setUser:      (user: User | null) => void
  setTenant:    (tenant: Tenant | null) => void
  clearError:   () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user:    null,
      tenant:  null,
      loading: false,
      error:   null,

      login: async (email, password) => {
        set({ loading: true, error: null })
        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
          if (authError || !authData.user) throw authError ?? new Error('Login failed')
          useProjectStore.getState().resetProjectState()

          // Load user profile
          const { data: userProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single()

          if (!userProfile) throw new Error('Perfil não encontrado')

          // Load tenant
          const { data: tenant } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', userProfile.tenant_id)
            .single()

          // Apply tenant theme
          if (tenant) applyTenantTheme(tenant)

          set({ user: userProfile, tenant, loading: false })
        } catch (err: unknown) {
          set({ error: (err as Error).message, loading: false })
        }
      },

      logout: async () => {
        await supabase.auth.signOut()
        useProjectStore.getState().resetProjectState()
        set({ user: null, tenant: null })
      },

      loadSession: async () => {
        set({ loading: true })
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) { set({ loading: false }); return }

        const { data: userProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (!userProfile) { set({ loading: false }); return }

        const { data: tenant } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', userProfile.tenant_id)
          .single()

        if (tenant) applyTenantTheme(tenant)

        const projectState = useProjectStore.getState()
        if (
          projectState.activeProject?.id === 'demo-project' ||
          (projectState.activeProject && projectState.activeProject.tenant_id !== userProfile.tenant_id)
        ) {
          projectState.resetProjectState()
        }
        set({ user: userProfile, tenant, loading: false })
      },

      setUser:    (user) => set({ user }),
      setTenant:  (tenant) => set({ tenant }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'sap-auth',
      partialize: (s) => ({ user: s.user, tenant: s.tenant }),
    }
  )
)

// Apply tenant theme (white label)
function applyTenantTheme(tenant: Tenant) {
  const root = document.documentElement
  root.style.setProperty('--color-primary',   tenant.primary_color   ?? '#3B4FE8')
  root.style.setProperty('--color-secondary', tenant.secondary_color ?? '#1E2A78')
  root.style.setProperty('--color-accent',    tenant.accent_color    ?? '#F59E0B')
  document.title = `${tenant.name} — SAP Activate Methodology`

  const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (favicon && tenant.logo_url) favicon.href = tenant.logo_url
}

// ─────────────────────────────────────────────────────────────────────────
// PROJECT STORE
// ─────────────────────────────────────────────────────────────────────────
interface ProjectStore {
  projects:       Project[]
  activeProject:  Project | null
  activePhase:    PhaseNumber
  filters:        ProjectFilters
  loading:        boolean

  setProjects:      (projects: Project[]) => void
  setActiveProject: (project: Project | null) => void
  setActivePhase:   (phase: PhaseNumber) => void
  resetProjectState: () => void
  setFilters:       (filters: Partial<ProjectFilters>) => void
  clearFilters:     () => void
  updateProject:    (id: string, updates: Partial<Project>) => void
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      projects:      [],
      activeProject: null,
      activePhase:   '1',
      filters:       {},
      loading:       false,

      setProjects:      (projects) => set({ projects }),
      setActiveProject: (project)  => set({ activeProject: project }),
      setActivePhase:   (phase)    => set({ activePhase: phase }),
      resetProjectState: () => set({ projects: [], activeProject: null, activePhase: '1', filters: {} }),

      setFilters: (filters) => set((s) => ({
        filters: { ...s.filters, ...filters }
      })),

      clearFilters: () => set({ filters: {} }),

      updateProject: (id, updates) => set((s) => ({
        projects: s.projects.map((p) => p.id === id ? { ...p, ...updates } : p),
        activeProject: s.activeProject?.id === id
          ? { ...s.activeProject, ...updates }
          : s.activeProject,
      })),
    }),
    {
      name: 'sap-project',
      partialize: (s) => ({ activeProject: s.activeProject, activePhase: s.activePhase }),
    }
  )
)

// ─────────────────────────────────────────────────────────────────────────
// UI STORE
// ─────────────────────────────────────────────────────────────────────────
interface UIStore {
  // Modals
  issuesModalOpen:  boolean
  risksModalOpen:   boolean
  teamModalOpen:    boolean
  costsModalOpen:   boolean
  crModalOpen:      boolean
  billingModalOpen: boolean
  travelsModalOpen: boolean

  // Sidebar / filters
  filtersVisible: boolean
  sidebarOpen:    boolean

  // Realtime
  realtimeConnected: boolean
  realtimeCount:     number
  lastSyncAt:        string | null

  // Notifications
  unreadCount: number

  openModal:  (modal: ModalName) => void
  closeModal: (modal: ModalName) => void
  toggleFilters: () => void
  setRealtime:   (connected: boolean, count?: number) => void
  setSyncTime:   () => void
  setUnread:     (count: number) => void
}

type ModalName = 'issues' | 'risks' | 'team' | 'costs' | 'cr' | 'billing' | 'travels'

export const useUIStore = create<UIStore>()((set) => ({
  issuesModalOpen:  false,
  risksModalOpen:   false,
  teamModalOpen:    false,
  costsModalOpen:   false,
  crModalOpen:      false,
  billingModalOpen: false,
  travelsModalOpen: false,
  filtersVisible:   false,
  sidebarOpen:      true,
  realtimeConnected:false,
  realtimeCount:    0,
  lastSyncAt:       null,
  unreadCount:      0,

  openModal:  (modal) => set({ [`${modal}ModalOpen`]: true }),
  closeModal: (modal) => set({ [`${modal}ModalOpen`]: false }),
  toggleFilters: () => set((s) => ({ filtersVisible: !s.filtersVisible })),

  setRealtime: (connected, count = 0) =>
    set({ realtimeConnected: connected, realtimeCount: count }),

  setSyncTime: () =>
    set({ lastSyncAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }),

  setUnread: (count) => set({ unreadCount: count }),
}))
