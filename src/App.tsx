import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { supabase, getCurrentUser } from '@/lib/supabase'

// Pages
import LoginPage      from '@/pages/auth/LoginPage'
import HomePage       from '@/pages/home/HomePage'
import DashboardPage  from '@/pages/dashboard/DashboardPage'
import IssuesPage from '@/pages/issues/IssuesPage'
import RisksPage from '@/pages/risks/RisksPage'
import PhasePage from '@/pages/phase/PhasePage'
import ConfigurePage from '@/pages/configure/ConfigurePage'
import QualityGatePage from '@/pages/quality-gate/QualityGatePage'
import AIAssistantPage from '@/pages/ai/AIAssistantPage'
import BPDPage from '@/pages/bpd/BPDPage'
import KickoffPage from '@/pages/kickoff/KickoffPage'
import TeamPage from '@/pages/team/TeamPage'
import CostsPage from '@/pages/costs/CostsPage'
import ChangeRequestsPage from '@/pages/change-requests/ChangeRequestsPage'
import BillingPage from '@/pages/billing/BillingPage'
import TravelsPage from '@/pages/travels/TravelsPage'
import MacroSchedulePage from '@/pages/macro-schedule/MacroSchedulePage'
import ScopeDefinitionPage from '@/pages/scope/ScopeDefinitionPage'
import OrganizationCommunicationPage from '@/pages/organization/OrganizationCommunicationPage'
import TemplateWorkspacePage from '@/pages/templates/TemplateWorkspacePage'
import AdminPage from '@/pages/admin/AdminPage'

// Layout
import AppLayout from '@/components/layout/AppLayout'

const ScheduleReportsPage = lazy(() => import('@/pages/reports/ScheduleReportsPage'))

// ── Guards ────────────────────────────────────────────────────
function RequireAuth() {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireAdmin() {
  const { user } = useAuthStore()
  if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') return <Navigate to="/home" replace />
  return <Outlet />
}

export default function App() {
  const { setUser, setTenant } = useAuthStore()

  useEffect(() => {
    // Bootstrap session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const data = await getCurrentUser()
        if (data) {
          setUser(data)
          if (data.tenant) setTenant(data.tenant)
        }
      }
    })

    // Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const data = await getCurrentUser()
          if (data) { setUser(data); if (data.tenant) setTenant(data.tenant) }
        }
        if (event === 'SIGNED_OUT') { setUser(null); setTenant(null) }
      }
    )
    return () => subscription.unsubscribe()
  }, [setUser, setTenant])

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/home" replace />} />

      {/* Protected */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/projects/:projectId/dashboard" element={<DashboardPage />} />
          <Route path="/projects/:projectId/issues" element={<IssuesPage />} />
          <Route path="/projects/:projectId/risks" element={<RisksPage />} />
          <Route path="/projects/:projectId/phase/:phase" element={<PhasePage />} />
          <Route path="/projects/:projectId/configure" element={<ConfigurePage />} />
          <Route path="/projects/:projectId/quality-gate/:phase" element={<QualityGatePage />} />
          <Route path="/projects/:projectId/assistant" element={<AIAssistantPage />} />
          <Route path="/projects/:projectId/bpd" element={<BPDPage />} />
          <Route path="/projects/:projectId/kickoff" element={<KickoffPage />} />
          <Route path="/projects/:projectId/team" element={<TeamPage />} />
          <Route path="/projects/:projectId/costs" element={<CostsPage />} />
          <Route path="/projects/:projectId/change-requests" element={<ChangeRequestsPage />} />
          <Route path="/projects/:projectId/billing" element={<BillingPage />} />
          <Route path="/projects/:projectId/travels" element={<TravelsPage />} />
          <Route path="/projects/:projectId/macro-schedule" element={<MacroSchedulePage />} />
          <Route path="/projects/:projectId/schedule-reports" element={<Suspense fallback={<div className="p-8 text-text-secondary">Carregando relatórios...</div>}><ScheduleReportsPage /></Suspense>} />
          <Route path="/projects/:projectId/scope" element={<ScopeDefinitionPage />} />
          <Route path="/projects/:projectId/organization" element={<OrganizationCommunicationPage />} />
          <Route path="/projects/:projectId/templates/:templateKey" element={<TemplateWorkspacePage />} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}
