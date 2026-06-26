// src/components/layout/AppShell.tsx
import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useProjectStore, useUIStore } from '../../store'
import Header   from './Header'
import PhaseNav from './PhaseNav'
import Footer   from './Footer'

export default function AppShell() {
  const { activeProject } = useProjectStore()
  const { setRealtime, setSyncTime } = useUIStore()

  // ── Realtime subscription ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeProject) return

    setRealtime(true, 1)
    setSyncTime()

    const interval = setInterval(setSyncTime, 30_000)

    return () => {
      clearInterval(interval)
      setRealtime(false, 0)
    }
  }, [activeProject?.id])

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#0f1229', color: '#e2e8f0' }}
    >
      {/* Sticky header */}
      <Header />

      {/* Phase nav breadcrumb */}
      <PhaseNav />

      {/* Main content area */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
