import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  Download,
  Gauge,
  HelpCircle,
  Milestone,
  RefreshCw,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useProject } from '@/hooks/useProjects'
import { useMacroSchedule } from '@/hooks/useMacroSchedule'
import { useScheduleGovernance } from '@/hooks/useScheduleGovernance'
import { MACRO_PHASE_COLORS } from '@/lib/macroSchedule'
import { buildScheduleAnalytics, criticalReason, type CheckpointSummary } from '@/lib/scheduleAnalytics'
import { buildAuditScheduleCurve, snapshotToCurvePoint } from '@/lib/scheduleGovernance'
import { formatDate } from '@/lib/utils'

type KpiTone = 'blue' | 'green' | 'amber' | 'red'
type DetailPanel = 'delayed' | 'next7' | null

export default function ScheduleReportsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const projectQuery = useProject(projectId)
  const { tasks, holidayDates, isLoading, forceSync, lastSyncedAt } = useMacroSchedule(projectId)
  const { activeBaseline, baselineTasks, snapshots, isLoading: governanceLoading } = useScheduleGovernance(projectId)
  const [detailPanel, setDetailPanel] = useState<DetailPanel>(null)

  const report = useMemo(() => buildScheduleAnalytics(tasks, holidayDates), [holidayDates, tasks])
  const auditCurve = useMemo(() => buildAuditScheduleCurve(baselineTasks, snapshots, holidayDates), [baselineTasks, holidayDates, snapshots])
  const auditSpiCurve = useMemo(() => snapshots.map(snapshotToCurvePoint), [snapshots])
  const hasAuditSnapshots = snapshots.length > 0
  const latestSnapshot = snapshots[snapshots.length - 1]
  const curveData = hasAuditSnapshots ? auditCurve : report.curve
  const spiData = hasAuditSnapshots ? auditSpiCurve : report.spiCurve
  const display = {
    asOfIso: latestSnapshot?.status_date ?? report.asOfIso,
    pv: latestSnapshot?.pv ?? report.pv,
    ev: latestSnapshot?.ev ?? report.ev,
    sv: latestSnapshot ? latestSnapshot.ev - latestSnapshot.pv : report.sv,
    plannedPct: latestSnapshot?.planned_pct ?? report.plannedPct,
    realPct: latestSnapshot?.real_pct ?? report.realPct,
    spi: latestSnapshot?.spi ?? report.spi,
    spiText: latestSnapshot ? latestSnapshot.spi?.toFixed(2) ?? '-' : report.spiText,
    spiStatus: latestSnapshot ? (latestSnapshot.spi === null || latestSnapshot.spi === undefined ? 'Sem planejado' : latestSnapshot.spi >= 1 ? 'No prazo' : latestSnapshot.spi >= 0.85 ? 'Atenção' : 'Crítico') : report.spiStatus,
    spiTone: latestSnapshot ? (latestSnapshot.spi === null || latestSnapshot.spi === undefined ? 'blue' as const : latestSnapshot.spi >= 1 ? 'green' as const : latestSnapshot.spi >= 0.85 ? 'amber' as const : 'red' as const) : report.spiTone,
    delayedCount: latestSnapshot?.delayed_count ?? report.delayedTasks.length,
    forecastLabel: report.forecastLabel,
    forecastDetail: hasAuditSnapshots ? 'Usa último corte salvo' : report.forecastDetail,
    forecastTone: report.forecastTone,
  }
  const delayedTasks = report.delayedTasks
  const nextSevenTasks = useMemo(() => {
    const start = display.asOfIso
    const end = addDaysIso(start, 7)
    return report.tasks
      .filter((task) => task.real_pct < 100 && ((task.start_date && task.start_date >= start && task.start_date <= end) || (task.end_date && task.end_date >= start && task.end_date <= end)))
      .sort((a, b) => String(a.start_date ?? a.end_date ?? '').localeCompare(String(b.start_date ?? b.end_date ?? '')))
      .slice(0, 30)
  }, [display.asOfIso, report.tasks])
  const project = projectQuery.data

  function exportCsv() {
    const header = ['Data', 'Planejado %', 'Realizado %', 'SPI']
    const rows = curveData.map((point) => [
      point.date,
      point.planned,
      point.realized,
      point.spi ?? '',
    ])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `relatorio-cronograma-${projectId ?? 'projeto'}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Relatórios operacionais</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Cronograma e SPI</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {project?.name ?? 'Projeto'} - análise gerada a partir do Cronograma Macro em {formatDate(display.asOfIso)}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeBaseline ? <span className="badge badge-red">Baseline V{activeBaseline.version}</span> : <span className="badge badge-amber">Sem baseline</span>}
            {hasAuditSnapshots ? (
              <span className="badge badge-green">{snapshots.length} medição(ões) auditáveis</span>
            ) : (
              <span className="badge badge-amber">Sem snapshots: visão operacional atual</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={() => navigate(`/projects/${projectId}/macro-schedule`)}>
            <CalendarClock className="h-4 w-4" />
            Cronograma
          </button>
          <button className="btn-secondary" type="button" onClick={forceSync}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button className="btn-secondary" type="button" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button className="btn-primary" type="button" onClick={() => window.print()}>
            <Download className="h-4 w-4" />
            PDF
          </button>
        </div>
      </header>

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Kpi title="SPI" value={display.spiText} detail={display.spiStatus} icon={<Gauge className="h-5 w-5" />} tone={display.spiTone} info="Schedule Performance Index. Em modo auditável, compara o realizado ponderado com o planejado ponderado da última medição de corte contra a baseline congelada. Abaixo de 1 indica atraso; acima de 1 indica avanço sobre o planejado." />
        <Kpi title="Planejado" value={`${display.plannedPct.toFixed(1)}%`} detail={`corte ${formatDate(display.asOfIso)}`} icon={<CalendarClock className="h-5 w-5" />} info="Percentual planejado acumulado na data de corte. Nesta fase, mostramos percentual, não PV monetário ou em horas." />
        <Kpi title="Realizado" value={`${display.realPct.toFixed(1)}%`} detail={hasAuditSnapshots ? 'medição salva' : 'visão atual'} icon={<Gauge className="h-5 w-5" />} tone={display.realPct >= display.plannedPct ? 'green' : 'amber'} info="Percentual realizado acumulado na data de corte. Deve vir de medição oficial, não de projeção futura." />
        <Kpi title="Atrasos" value={String(display.delayedCount)} detail={hasAuditSnapshots ? 'no último corte' : `${report.overdueTasks.length} vencida(s)`} icon={<AlertTriangle className="h-5 w-5" />} tone={display.delayedCount ? 'red' : 'green'} info="Com medições salvas, conta tarefas cujo % Real ficou abaixo do planejado no snapshot de corte. Sem snapshot, usa a visão operacional atual." actionLabel="Listar" onAction={() => setDetailPanel(detailPanel === 'delayed' ? null : 'delayed')} />
        <Kpi title="Próximos 7 dias" value={String(nextSevenTasks.length)} detail="tarefas/marcos" icon={<CalendarClock className="h-5 w-5" />} tone={nextSevenTasks.length ? 'blue' : 'green'} info="Lista tarefas não concluídas com início ou fim nos próximos sete dias a partir da data de corte." actionLabel="Listar" onAction={() => setDetailPanel(detailPanel === 'next7' ? null : 'next7')} />
        <Kpi title="Forecast" value={display.forecastLabel} detail={display.forecastDetail} icon={<CalendarClock className="h-5 w-5" />} tone={display.forecastTone} info="Projeção simples da data final baseada no SPI atual. Para auditoria, use como tendência gerencial, não como dado histórico." />
      </section>

      {detailPanel ? (
        <TaskListPanel
          title={detailPanel === 'delayed' ? 'Tarefas em atraso' : 'Tarefas dos próximos 7 dias'}
          subtitle={detailPanel === 'delayed' ? 'Itens com execução abaixo do planejado ou vencidos.' : `Janela de ${formatDate(display.asOfIso)} a ${formatDate(addDaysIso(display.asOfIso, 7))}.`}
          tasks={detailPanel === 'delayed' ? delayedTasks : nextSevenTasks}
          asOfIso={display.asOfIso}
          emptyText={detailPanel === 'delayed' ? 'Nenhuma tarefa em atraso encontrada.' : 'Nenhuma tarefa prevista para os próximos sete dias.'}
          onClose={() => setDetailPanel(null)}
        />
      ) : null}

      <ScheduleCurveCard
        data={curveData}
        cutoffDate={latestSnapshot?.status_date ?? report.asOfIso}
        cutoffLabel={latestSnapshot ? formatShortDate(latestSnapshot.status_date) : formatShortDate(report.asOfIso)}
        scopeLabel={hasAuditSnapshots ? 'baseline + cortes salvos' : 'visão operacional atual'}
      />

      <section className="mt-5">
        <ChartCard title={hasAuditSnapshots ? 'SPI por corte salvo' : 'SPI operacional'} badge={display.spiText}>
          <ResponsiveContainer width="100%" height={330}>
            <AreaChart data={spiData} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#2e3460" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[0, 1.4]} />
              <Tooltip contentStyle={{ background: '#1a1f3a', border: '1px solid #2e3460', borderRadius: 8 }} />
              <Area type="monotone" dataKey="spi" name="SPI" fill="#F59E0B" fillOpacity={0.16} stroke="#F59E0B" strokeWidth={3} />
              <Line type="monotone" dataKey="baseline" name="Referência" stroke="#ef4444" strokeDasharray="4 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Heatmap por fase</h2>
              <p className="mt-1 text-xs text-text-muted">Concentração de atraso e execução por fase.</p>
            </div>
            <span className="badge badge-blue">{report.tasks.length} tarefas</span>
          </div>
          <div className="space-y-3">
            {report.phaseSummaries.map((phase) => (
              <div key={phase.phase} className="rounded-[8px] border border-surface-border bg-[#0f1229] p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-text-primary">{phase.phase}</span>
                  <span className={phase.delayed ? 'text-danger' : 'text-success'}>{phase.delayed} em atraso</span>
                </div>
                <div className="grid grid-cols-[1fr_120px] items-center gap-3">
                  <div className="progress-bar h-2">
                    <div className="progress-fill" style={{ width: `${phase.realPct}%`, background: MACRO_PHASE_COLORS[phase.phase] }} />
                  </div>
                  <span className="text-right text-xs text-text-secondary">{phase.realPct}%</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className={phase.overdue ? 'badge badge-red' : 'badge badge-gray'}>{phase.overdue} vencida(s)</span>
                  <span className={phase.missingSchedule ? 'badge badge-amber' : 'badge badge-gray'}>{phase.missingSchedule} sem data</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="card mt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Pontos de checagem do cronograma</h2>
            <p className="mt-1 text-xs text-text-muted">Marcos, cutovers, go-lives e gates com indicação de vencimento ou desvio de progresso.</p>
          </div>
          <span className="badge badge-blue">{report.checkpoints.length} checkpoint(s)</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {report.checkpoints.slice(0, 8).map(({ task, status }) => (
            <div key={task.id} className="rounded-[8px] border border-surface-border bg-[#0f1229] p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <span className="wbs-badge shrink-0">{task.wbs}</span>
                <span className={`badge ${checkpointClass(status)}`}>{checkpointLabel(status)}</span>
              </div>
              <h3 className="line-clamp-2 text-sm font-semibold text-text-primary">{task.title}</h3>
              <p className="mt-2 text-xs text-text-secondary">{task.phase} - {formatDate(task.end_date)} - {task.real_pct}% real</p>
            </div>
          ))}
        </div>
        {!report.checkpoints.length ? <p className="text-sm text-text-secondary">Nenhum ponto de checagem identificado no cronograma.</p> : null}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="card overflow-hidden p-0">
          <div className="border-b border-surface-border p-5">
            <h2 className="text-lg font-bold text-text-primary">Tarefas críticas</h2>
            <p className="mt-1 text-xs text-text-muted">Itens vencidos, sem data, sem responsável ou com execução abaixo do planejado.</p>
          </div>
          <div className="overflow-auto">
            <table className="data-table min-w-[920px]">
              <thead>
                <tr>
                  <th>WBS</th>
                  <th>Tarefa</th>
                  <th>Fase</th>
                  <th>Responsável</th>
                  <th>Fim</th>
                  <th>% Plan.</th>
                  <th>% Real</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {report.criticalTasks.map((task) => (
                  <tr key={task.id}>
                    <td><span className="wbs-badge">{task.wbs}</span></td>
                    <td className="text-text-primary">{task.title}</td>
                    <td>{task.phase}</td>
                    <td>{task.responsible || task.squad || '-'}</td>
                    <td>{formatDate(task.end_date)}</td>
                    <td>{task.planned_pct}%</td>
                    <td>{task.real_pct}%</td>
                    <td><span className="badge badge-red">{criticalReason(task, report.asOfIso)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!report.criticalTasks.length ? <div className="p-6 text-sm text-text-secondary">Nenhuma tarefa crítica no momento.</div> : null}
          </div>
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Marcos e squads</h2>
              <p className="mt-1 text-xs text-text-muted">Próximos go-lives e desempenho operacional.</p>
            </div>
            <Milestone className="h-5 w-5 text-warn" />
          </div>
          <div className="space-y-3">
            {report.milestones.slice(0, 5).map((task) => (
              <div key={task.id} className="rounded-[8px] border border-surface-border bg-[#0f1229] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-text-primary">{task.title}</p>
                  <span className={task.end_date && task.end_date < report.asOfIso && task.real_pct < 100 ? 'badge badge-red' : 'badge badge-amber'}>{formatDate(task.end_date)}</span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">{task.phase} - {task.real_pct}% realizado</p>
              </div>
            ))}
            {!report.milestones.length ? <p className="text-sm text-text-secondary">Nenhum marco cadastrado.</p> : null}
          </div>
          <div className="mt-5 space-y-3">
            {report.squadSummaries.slice(0, 6).map((squad) => (
              <div key={squad.squad} className="grid grid-cols-[1fr_58px_58px] items-center gap-3 text-xs">
                <span className="truncate text-text-secondary">{squad.squad}</span>
                <span className={squad.spi !== null && squad.spi < 1 ? 'text-warn' : 'text-success'}>{squad.spi === null ? '-' : squad.spi.toFixed(2)}</span>
                <span className={squad.delayed ? 'text-right text-danger' : 'text-right text-text-muted'}>{squad.delayed}/{squad.tasks}</span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <footer className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span>Última sincronização: {lastSyncedAt ? lastSyncedAt.toLocaleString('pt-BR') : 'local'}</span>
        <span>Fase 1 do relatório: foco em SPI, Curva-S, atrasos e próximas tarefas. Indicadores EVM completos ficam para uma próxima etapa.</span>
        {isLoading || projectQuery.isLoading || governanceLoading ? <span>Carregando indicadores...</span> : null}
      </footer>
    </div>
  )
}

function checkpointClass(status: CheckpointSummary['status']) {
  if (status === 'Concluido') return 'badge-green'
  if (status === 'Vencido') return 'badge-red'
  if (status === 'Atencao') return 'badge-amber'
  return 'badge-blue'
}

function checkpointLabel(status: CheckpointSummary['status']) {
  if (status === 'Concluido') return 'Concluído'
  if (status === 'Vencido') return 'Vencido'
  if (status === 'Atencao') return 'Atenção'
  return 'Futuro'
}

function TaskListPanel({
  title,
  subtitle,
  tasks,
  asOfIso,
  emptyText,
  onClose,
}: {
  title: string
  subtitle: string
  tasks: ReturnType<typeof buildScheduleAnalytics>['tasks']
  asOfIso: string
  emptyText: string
  onClose: () => void
}) {
  return (
    <section className="card mb-5 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border p-5">
        <div>
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          <p className="mt-1 text-xs text-text-muted">{subtitle}</p>
        </div>
        <button className="btn-secondary btn-sm" type="button" onClick={onClose}>Fechar</button>
      </div>
      <div className="overflow-auto">
        <table className="data-table min-w-[980px]">
          <thead>
            <tr>
              <th>WBS</th>
              <th>Tarefa</th>
              <th>Fase</th>
              <th>Squad</th>
              <th>Responsável</th>
              <th>Início</th>
              <th>Fim</th>
              <th>% Plan.</th>
              <th>% Real</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td><span className="wbs-badge">{task.wbs}</span></td>
                <td className="text-text-primary">{task.title}</td>
                <td>{task.phase}</td>
                <td>{task.squad || '-'}</td>
                <td>{task.responsible || '-'}</td>
                <td>{formatDate(task.start_date)}</td>
                <td>{formatDate(task.end_date)}</td>
                <td>{task.planned_pct}%</td>
                <td>{task.real_pct}%</td>
                <td><span className={task.end_date && task.end_date < asOfIso && task.real_pct < 100 ? 'badge badge-red' : 'badge badge-blue'}>{criticalReason(task, asOfIso)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!tasks.length ? <div className="p-6 text-sm text-text-secondary">{emptyText}</div> : null}
      </div>
    </section>
  )
}

function ScheduleCurveCard({
  data,
  cutoffDate,
  cutoffLabel,
  scopeLabel,
}: {
  data: Array<{ date: string; planned: number; realized: number | null; pv: number; ev: number | null; spi: number | null }>
  cutoffDate: string
  cutoffLabel: string
  scopeLabel: string
}) {
  return (
    <section className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Curva-S - Cronograma</h2>
          <p className="mt-1 text-xs text-text-muted">Cumulativa planejado x realizado. O realizado futuro fica congelado no último corte salvo.</p>
        </div>
        <span className="text-xs font-bold text-text-muted">{scopeLabel}</span>
      </div>
      <div className="px-5 pt-4">
        <div className="mb-2 flex flex-wrap items-center gap-6 text-sm font-semibold text-text-secondary">
          <span className="inline-flex items-center gap-2"><i className="h-[3px] w-8 rounded-full bg-[#2563eb]" />Planejado</span>
          <span className="inline-flex items-center gap-2"><i className="h-[3px] w-8 rounded-full bg-[#22c55e]" />Realizado</span>
          <span className="inline-flex items-center gap-2"><i className="h-6 border-l-2 border-dashed border-danger" />{cutoffLabel}</span>
        </div>
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={data} margin={{ top: 14, right: 20, bottom: 10, left: 4 }}>
            <CartesianGrid stroke="#252b4d" strokeDasharray="4 5" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              tick={{ fontSize: 12, fontWeight: 700 }}
              tickFormatter={formatAxisDate}
              minTickGap={56}
            />
            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 12, fontWeight: 700 }}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
            />
            <Tooltip
              labelFormatter={(value) => formatDate(String(value))}
              formatter={(value, name) => {
                const label = name === 'planned' ? 'Planejado' : name === 'realized' ? 'Realizado' : String(name)
                return [value === null ? '-' : `${Number(value).toFixed(1)}%`, label]
              }}
              contentStyle={{ background: '#1a1f3a', border: '1px solid #2e3460', borderRadius: 8 }}
            />
            <Area
              type="monotone"
              dataKey="planned"
              name="Planejado"
              fill="#2563eb"
              fillOpacity={0.16}
              stroke="#2563eb"
              strokeWidth={3}
              strokeDasharray="8 6"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="realized"
              name="Realizado"
              connectNulls
              fill="#22c55e"
              fillOpacity={0.14}
              stroke="#22c55e"
              strokeWidth={3}
              dot={false}
            />
            <ReferenceLine
              x={cutoffDate}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{ value: cutoffLabel, position: 'top', fill: '#d1d5db', fontSize: 12, fontWeight: 700 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function Kpi({
  title,
  value,
  detail,
  icon,
  info,
  actionLabel,
  onAction,
  tone = 'blue',
}: {
  title: string
  value: string
  detail: string
  icon: ReactNode
  info: string
  actionLabel?: string
  onAction?: () => void
  tone?: KpiTone
}) {
  const [open, setOpen] = useState(false)
  const toneClass = tone === 'green' ? 'text-success' : tone === 'amber' ? 'text-warn' : tone === 'red' ? 'text-danger' : 'text-brand-600'
  return (
    <article className="card2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-text-secondary">{title}</p>
            <button
              className={`inline-flex h-6 w-6 items-center justify-center rounded-[8px] border border-surface-border bg-[#0f1229] transition hover:border-brand-600 hover:text-text-primary ${open ? 'text-brand-600' : 'text-text-muted'}`}
              type="button"
              aria-expanded={open}
              aria-label={`Explicar ${title}`}
              title={`Explicar ${title}`}
              onClick={() => setOpen((current) => !current)}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
          <strong className="mt-2 block text-2xl text-text-primary">{value}</strong>
        </div>
        <span className={`rounded-[8px] bg-[#0f1229] p-2 ${toneClass}`}>{icon}</span>
      </div>
      <span className="mt-4 block text-xs text-text-muted">{detail}</span>
      {open ? (
        <div className="mt-3 rounded-[8px] border border-brand-600/40 bg-[#0f1229] p-3 text-xs leading-relaxed text-text-secondary">
          {info}
        </div>
      ) : null}
      {onAction ? (
        <button className="btn-secondary btn-sm mt-3 w-full justify-center" type="button" onClick={onAction}>
          {actionLabel ?? 'Abrir'}
        </button>
      ) : null}
    </article>
  )
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatAxisDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

function ChartCard({ title, badge, children }: { title: string; badge: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        <span className="badge badge-blue">{badge}</span>
      </div>
      {children}
    </section>
  )
}
