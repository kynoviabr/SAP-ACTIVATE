// src/components/layout/PhaseNav.tsx
import { useNavigate, useParams } from 'react-router-dom'
import { AppIcon, PhaseIcon, StatusIcon } from '@/components/ui/AppIcons'
import { useProjectStore } from '@/store'
import { PHASE_INFO } from '@/types'
import type { PhaseNumber } from '@/types'

export default function PhaseNav() {
  const { activeProject, setActivePhase } = useProjectStore()
  const navigate = useNavigate()
  const { projectId, phase: currentPhase } = useParams()

  const id = projectId ?? activeProject?.id
  const spi    = activeProject?.spi    ?? 1
  const status = activeProject?.status ?? 'verde'
  const golive = activeProject?.golive_date
  const daysLeft = golive
    ? Math.ceil((new Date(golive).getTime() - Date.now()) / 86_400_000)
    : null

  const ragClass = status === 'verde' ? 'badge-green' : status === 'amarelo' ? 'badge-amber' : 'badge-red'

  function go(phase: PhaseNumber) {
    setActivePhase(phase)
    if (id) navigate(`/projects/${id}/phase/${phase}`)
  }

  return (
    <nav className="flex items-center gap-1 px-6 py-2 shrink-0"
      style={{ background: '#12173a', borderBottom: '1px solid #2e3460' }}>
      <button className="phase-link flex items-center gap-1.5 text-sm" onClick={() => navigate('/home')}>
        <AppIcon.home className="h-3.5 w-3.5" />
        Início
      </button>
      {(['1','2','3','4','5'] as PhaseNumber[]).map(n => {
        const info = PHASE_INFO[n]
        const active = currentPhase === n
        return (
          <span key={n} className="flex items-center">
            <span className="mx-1" style={{ color: '#2e3460' }}>›</span>
            <button
              onClick={() => go(n)}
              className={`phase-link flex flex-col items-center gap-0 py-1 px-3 text-[11px] ${active ? 'active' : ''}`}
            >
              <span style={{ fontSize: 9, color: '#6b7280' }}>Fase {n}</span>
              <PhaseIcon phase={n} className="h-3.5 w-3.5" style={{ color: info.color }} />
              <span>{info.short}</span>
            </button>
          </span>
        )
      })}
      {activeProject && (
        <div className="ml-auto flex items-center gap-2">
          <span className={`badge ${ragClass}`}>
            <StatusIcon status={status} />
            {status}
          </span>
          <span className="text-xs" style={{ color: '#6b7280' }}>
            SPI {spi.toFixed(2)}{daysLeft !== null ? ` | ${daysLeft}d Go-Live` : ''}
          </span>
        </div>
      )}
    </nav>
  )
}
