import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import LoadingScreen from '../ui/LoadingScreen'
import { useAuthStore } from '../../store'

interface RequireAuthProps {
  children: ReactNode
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation()
  const user = useAuthStore((state: any) => state.user)
  const isLoading = useAuthStore((state: any) => state.isLoading ?? state.loading ?? false)
  const initialized = useAuthStore((state: any) => state.initialized ?? true)

  if (isLoading || !initialized) {
    return <LoadingScreen message="Validando sessão..." />
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />
  }

  return <>{children}</>
}
