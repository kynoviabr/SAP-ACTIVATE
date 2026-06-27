import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import EmptyState from '../ui/EmptyState'
import LoadingScreen from '../ui/LoadingScreen'
import { useAuthStore } from '../../store'

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'USER' | 'VIEWER'

interface RequireRoleProps {
  children: ReactNode
  roles: Role[]
}

export default function RequireRole({ children, roles }: RequireRoleProps) {
  const user = useAuthStore((state: any) => state.user)
  const role = useAuthStore((state: any) => state.role ?? state.profile?.role ?? null)
  const isLoading = useAuthStore((state: any) => state.isLoading ?? state.loading ?? false)
  const initialized = useAuthStore((state: any) => state.initialized ?? true)

  if (isLoading || !initialized) {
    return <LoadingScreen message="Verificando permissões..." />
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (!role || !roles.includes(role)) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <EmptyState
            title="Acesso restrito"
            description="Seu perfil não tem permissão para acessar esta área do portal."
          />
        </div>
      </main>
    )
  }

  return <>{children}</>
}
