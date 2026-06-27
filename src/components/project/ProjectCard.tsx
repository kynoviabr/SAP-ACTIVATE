import { useMemo } from 'react'
import { Archive, CalendarClock, ExternalLink, Trash2 } from 'lucide-react'
import { StatusIcon } from '@/components/ui/AppIcons'
import { useMacroSchedule } from '@/hooks/useMacroSchedule'
import { useScheduleGovernance } from '@/hooks/useScheduleGovernance'
import { buildScheduleAnalytics, scheduleStatusFromSpi } from '@/lib/scheduleAnalytics'
import { calcDaysToGoLive, PHASE_LABELS, STATUS_COLORS } from '@/lib/utils'
import type { Project } from '@/types'

type ProjectCardProps = {
  project: Project
  active?: boolean
  onOpen?: (project: Project) => void
  onArchive?: (project: Project) => void
  onTrash?: (project: Project) => void
}

export default function ProjectCard({ project, active, onOpen, onArchive, onTrash }: ProjectCardProps) {
  const { tasks: macroTasks, holidayDates } = useMacroSchedule(project.id)
  const { snapshots } = useScheduleGovernance(project.id)
  const scheduleReport = useMemo(() => buildScheduleAnalytics(macroTasks, holidayDates), [holidayDates, macroTasks])
  const latestSnapshot = snapshots[snapshots.length - 1]
  const hasMacroSchedule = scheduleReport.tasks.length > 0
  const displaySpi = latestSnapshot?.spi ?? (hasMacroSchedule ? scheduleReport.spi ?? project.spi : project.spi)
  const displayProgress = latestSnapshot?.real_pct ?? (hasMacroSchedule ? scheduleReport.realPct : project.progress_pct)
  const displayStatus = hasMacroSchedule ? scheduleStatusFromSpi(displaySpi) : project.status
  const status = STATUS_COLORS[displayStatus]
  const days = calcDaysToGoLive(project.golive_date)

  return (
    <article
      className={`card cursor-pointer transition hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-card-hover ${active ? 'border-brand-600 bg-surface-hover' : ''}`}
      onClick={() => onOpen?.(project)}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="badge badge-blue">Fase {project.current_phase} {PHASE_LABELS[project.current_phase].short}</span>
        <span className="badge" style={{ background: status.bg, color: status.text }}>
          <StatusIcon status={displayStatus} />
          {displayStatus}
        </span>
      </div>

      <div className="mt-4">
        <h3 className="truncate text-lg font-bold text-text-primary">{project.name}</h3>
        <p className="mt-1 truncate text-sm text-text-secondary">{project.client}</p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-text-muted">GP</dt>
          <dd className="mt-1 truncate font-semibold text-text-secondary">{project.project_manager}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Go-Live</dt>
          <dd className="mt-1 flex items-center gap-1 font-semibold text-text-secondary">
            <CalendarClock className="h-3.5 w-3.5" />
            {days}d
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold text-text-secondary">Progresso</span>
          <span className="text-text-muted">SPI {displaySpi.toFixed(2)}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill bg-brand-600" style={{ width: `${displayProgress}%` }} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-surface-border pt-4">
        <button className="btn-primary btn-sm" type="button" onClick={(event) => { event.stopPropagation(); onOpen?.(project) }}>
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir
        </button>
        <button className="btn-secondary btn-sm" type="button" onClick={(event) => { event.stopPropagation(); onArchive?.(project) }}>
          <Archive className="h-3.5 w-3.5" />
          Encerrar
        </button>
        <button className="btn-danger btn-sm ml-auto" type="button" onClick={(event) => { event.stopPropagation(); onTrash?.(project) }}>
          <Trash2 className="h-3.5 w-3.5" />
          Lixeira
        </button>
      </div>
    </article>
  )
}
