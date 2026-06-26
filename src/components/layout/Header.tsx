// src/components/layout/Header.tsx
import { useNavigate } from 'react-router-dom'
import { AppIcon } from '@/components/ui/AppIcons'
import { useAuthStore, useProjectStore, useUIStore } from '@/store'
import { signOut } from '@/lib/supabase'

export default function Header() {
  const { user, tenant }        = useAuthStore()
  const { activeProject }       = useProjectStore()
  const { openModal, unreadCount } = useUIStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const initials = user?.full_name
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? 'U'

  const appName = import.meta.env.VITE_APP_NAME ?? 'KYNOVIA PROJECT MANAGEMENT'
  const subtitle = 'SAP Activate Methodology'

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-3"
      style={{
        background: '#232847',
        borderBottom: '1px solid #2e3460',
      }}
    >
      {/* ── Left: Logo + name ── */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => navigate('/home')}
      >
        {tenant?.logo_url ? (
          <img
            src={tenant.logo_url}
            alt={appName}
            className="h-9 w-9 rounded-lg object-contain"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm text-white"
            style={{ background: '#3B4FE8' }}
          >
            SP
          </div>
        )}
        <div>
          <div className="font-bold text-sm text-white leading-tight">{appName}</div>
          <div className="text-xs truncate max-w-[320px]" style={{ color: '#6b7280' }}>
            {subtitle}
          </div>
        </div>
      </div>

      {/* ── Right: action buttons ── */}
      <div className="flex items-center gap-2">

        {/* Issues */}
        <button
          className="btn-secondary btn-sm flex items-center gap-1.5"
          onClick={() => activeProject ? navigate(`/projects/${activeProject.id}/issues`) : openModal('issues')}
        >
          <AppIcon.issues className="h-3.5 w-3.5" />
          Issues
          {unreadCount > 0 && (
            <span className="badge badge-amber" style={{ fontSize: 10 }}>
              {unreadCount}
            </span>
          )}
        </button>

        {/* Risks */}
        <button
          className="btn-secondary btn-sm flex items-center gap-1.5"
          onClick={() => activeProject ? navigate(`/projects/${activeProject.id}/risks`) : openModal('risks')}
        >
          <AppIcon.risks className="h-3.5 w-3.5" />
          Riscos
        </button>

        {/* AI Assistant */}
        {activeProject && (
          <button
            className="btn-secondary btn-sm flex items-center gap-1.5"
            onClick={() => navigate(`/projects/${activeProject.id}/assistant`)}
          >
            <AppIcon.ai className="h-3.5 w-3.5" />
            IA
          </button>
        )}

        {/* Language */}
        <button className="btn-secondary btn-sm flex items-center gap-1.5">
          <AppIcon.language className="h-3.5 w-3.5" />
          PT-BR
        </button>

        {/* Avatar + role */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-[8px] border cursor-pointer"
          style={{ background: '#232847', borderColor: '#2e3460' }}
          onClick={() => navigate('/admin')}
          title={user?.full_name}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: '#3B4FE8' }}
          >
            {initials}
          </div>
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ background: '#374151', color: '#9ca3af' }}
          >
            {user?.role ?? 'USER'}
          </span>
        </div>

        {/* Logout */}
        <button className="btn-secondary btn-sm flex items-center gap-1.5" onClick={handleLogout}>
          <AppIcon.logout className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </header>
  )
}
