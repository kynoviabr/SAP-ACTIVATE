import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CheckCircle2, Download, RefreshCw, Target } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import SPIGauge from '@/components/charts/SPIGauge'
import PhaseProgress from '@/components/charts/PhaseProgress'
import GanttChart from '@/components/gantt/GanttChart'
import { activityDB, risksDB } from '@/lib/database'
import { calcDaysToGoLive, formatDate, PHASE_LABELS } from '@/lib/utils'
import { useProject } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import type { PhaseNumber } from '@/types'

export default function DashboardPage() {
  const { projectId } = useParams()
  const projectQuery = useProject(projectId)
  const { tasks, spiData, isLoading: tasksLoading, refetch: refetchTasks } = useTasks(projectId)

  const risksQuery = useQuery({
    queryKey: ['critical-risks', projectId],
    queryFn: () => risksDB.getCritical(projectId!),
    enabled: Boolean(projectId),
  })

  const activityQuery = useQuery({
    queryKey: ['activity', projectId],
    queryFn: async () => {
      const { data, error } = await activityDB.list(projectId!, 12)
      if (error) throw error
      return data ?? []
    },
    enabled: Boolean(projectId),
  })

  const project = projectQuery.data
  const phaseItems = useMemo(() => {
    return (['1', '2', '3', '4', '5'] as PhaseNumber[]).map((phase) => {
      const phaseTasks = tasks.filter((task) => task.phase === phase)
      const progress = phaseTasks.length
        ? phaseTasks.reduce((sum, task) => sum + task.progress_pct, 0) / phaseTasks.length
        : project?.current_phase === phase ? project.progress_pct : Number(phase) < Number(project?.current_phase ?? 1) ? 100 : 0
      return {
        phase,
        progress,
        completed: phaseTasks.filter((task) => task.status === 'concluido').length,
        total: phaseTasks.length,
      }
    })
  }, [project?.current_phase, project?.progress_pct, tasks])

  const completedTemplates = phaseItems.reduce((sum, item) => sum + (item.completed ?? 0), 0)
  const totalTemplates = phaseItems.reduce((sum, item) => sum + (item.total ?? 0), 0)
  const daysToGoLive = calcDaysToGoLive(project?.golive_date)
  const spi = spiData.spi || project?.spi || 1

  function refreshAll() {
    projectQuery.refetch()
    refetchTasks()
    risksQuery.refetch()
    activityQuery.refetch()
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Dashboard automático</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">{project?.name ?? 'Dashboard do Projeto'}</h1>
          <p className="mt-1 text-sm text-text-secondary">{project?.client ?? 'Selecione um projeto para ver indicadores automáticos.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={refreshAll}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button className="btn-primary" type="button" onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            Exportar relatório
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Templates concluídos" value={`${completedTemplates}/${totalTemplates || 24}`} detail="AUTO" icon={<CheckCircle2 className="h-5 w-5" />} />
        <Kpi title="Fase atual" value={project ? PHASE_LABELS[project.current_phase].short : '-'} detail="AUTO" icon={<Target className="h-5 w-5" />} />
        <Kpi title="Dias Go-Live" value={daysToGoLive || '-'} detail={formatDate(project?.golive_date)} icon={<CalendarDays className="h-5 w-5" />} />
        <Kpi title="Status RAG" value={project?.status ?? '-'} detail="AUTO" icon={<AlertTriangle className="h-5 w-5" />} />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[320px_1fr]">
        <SPIGauge value={spi} />
        <PhaseProgress items={phaseItems} />
      </section>

      <section className="mt-5">
        <GanttChart tasks={tasks} title="Mini Gantt das fases e entregas" />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">Riscos críticos e altos</h2>
            <span className="badge badge-red">{risksQuery.data?.length ?? 0}</span>
          </div>
          <div className="space-y-3">
            {(risksQuery.data ?? []).slice(0, 6).map((risk) => (
              <div key={risk.id} className="rounded-[8px] border border-surface-border bg-[#0f1229] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-text-primary">{risk.description}</p>
                  <span className="badge badge-critical">{risk.exposure}</span>
                </div>
                <p className="mt-2 text-xs text-text-secondary">{risk.mitigation ?? 'Sem mitigação registrada.'}</p>
              </div>
            ))}
            {!risksQuery.data?.length ? <p className="text-sm text-text-secondary">Nenhum risco alto/crítico ativo.</p> : null}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">Log de atividades</h2>
            <span className="badge badge-blue">Realtime</span>
          </div>
          <div className="space-y-3">
            {(activityQuery.data ?? []).map((activity) => (
              <div key={activity.id} className="border-b border-surface-border pb-3 last:border-0">
                <p className="text-sm text-text-primary">{activity.action}</p>
                <p className="mt-1 text-xs text-text-muted">{activity.user_name ?? 'Sistema'} - {formatDate(activity.created_at)}</p>
              </div>
            ))}
            {!activityQuery.data?.length ? <p className="text-sm text-text-secondary">Nenhuma atividade recente.</p> : null}
          </div>
        </div>
      </section>

      {projectQuery.isLoading || tasksLoading ? <p className="mt-4 text-sm text-text-muted">Carregando indicadores...</p> : null}
    </div>
  )
}

function Kpi({ title, value, detail, icon }: { title: string; value: string | number; detail: string; icon: ReactNode }) {
  return (
    <article className="card2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">{title}</p>
          <strong className="mt-2 block text-2xl text-text-primary">{value}</strong>
        </div>
        <span className="rounded-[8px] bg-[#0f1229] p-2 text-brand-600">{icon}</span>
      </div>
      <span className="badge badge-blue mt-4">{detail}</span>
    </article>
  )
}
