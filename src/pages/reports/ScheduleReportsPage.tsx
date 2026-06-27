import { useMemo, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  Gauge,
  Milestone,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useProject } from '@/hooks/useProjects'
import { useMacroSchedule } from '@/hooks/useMacroSchedule'
import {
  MACRO_PHASE_COLORS,
  MACRO_PHASES,
  calcLineSPI,
  countBusinessDays,
  sortMacroTasks,
} from '@/lib/macroSchedule'
import { formatDate } from '@/lib/utils'
import type { MacroSchedulePhase, MacroScheduleTask } from '@/types'

type CurvePoint = {
  date: string
  label: string
  planned: number
  realized: number
  pv: number
  ev: number
  spi: number | null
  baseline: number
}

type SquadSummary = {
  squad: string
  tasks: number
  plannedHours: number
  ev: number
  pv: number
  spi: number | null
  overdue: number
}

type KpiTone = 'blue' | 'green' | 'amber' | 'red'

const asOf = new Date()
const asOfIso = asOf.toISOString().slice(0, 10)

export default function ScheduleReportsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const projectQuery = useProject(projectId)
  const { tasks, holidayDates, isLoading, forceSync, lastSyncedAt } = useMacroSchedule(projectId)

  const report = useMemo(() => buildScheduleReport(tasks, holidayDates), [holidayDates, tasks])
  const project = projectQuery.data

  function exportCsv() {
    const header = ['Data', 'Planejado %', 'Realizado %', 'PV horas', 'EV horas', 'SPI']
    const rows = report.curve.map((point) => [
      point.date,
      point.planned,
      point.realized,
      point.pv,
      point.ev,
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
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Cronograma, SPI e EVM</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {project?.name ?? 'Projeto'} - análise gerada a partir do Cronograma Macro em {formatDate(asOfIso)}.
          </p>
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

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Kpi title="SPI" value={report.spiText} detail={report.spiStatus} icon={<Gauge className="h-5 w-5" />} tone={report.spiTone} />
        <Kpi title="PV" value={`${report.pv.toFixed(0)}h`} detail={`${report.plannedPct}% planejado`} icon={<TrendingUp className="h-5 w-5" />} />
        <Kpi title="EV" value={`${report.ev.toFixed(0)}h`} detail={`${report.realPct}% realizado`} icon={<CheckCircle2 className="h-5 w-5" />} />
        <Kpi title="SV" value={`${report.sv >= 0 ? '+' : ''}${report.sv.toFixed(0)}h`} detail={report.sv >= 0 ? 'Adiantado' : 'Atrasado'} icon={<AlertTriangle className="h-5 w-5" />} tone={report.sv >= 0 ? 'green' : 'red'} />
        <Kpi title="Forecast" value={report.forecastLabel} detail={report.forecastDetail} icon={<CalendarClock className="h-5 w-5" />} tone={report.forecastTone} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <ChartCard title="Planejado x realizado" badge="Linha do tempo">
          <ResponsiveContainer width="100%" height={330}>
            <ComposedChart data={report.curve} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#2e3460" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#1a1f3a', border: '1px solid #2e3460', borderRadius: 8 }} />
              <Area type="monotone" dataKey="planned" name="Planejado %" fill="#3B4FE8" fillOpacity={0.16} stroke="#3B4FE8" strokeWidth={2} />
              <Line type="monotone" dataKey="realized" name="Realizado %" stroke="#10b981" strokeWidth={3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="SPI operacional" badge={report.spiText}>
          <ResponsiveContainer width="100%" height={330}>
            <AreaChart data={report.curve} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
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
        <ChartCard title="EVM em horas" badge="PV / EV">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={report.evmBars} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#2e3460" strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1a1f3a', border: '1px solid #2e3460', borderRadius: 8 }} />
              <Bar dataKey="hours" name="Horas" fill="#3B4FE8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

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
                  <span className={phase.overdue ? 'text-danger' : 'text-success'}>{phase.overdue} atrasada(s)</span>
                </div>
                <div className="grid grid-cols-[1fr_80px] items-center gap-3">
                  <div className="progress-bar h-2">
                    <div className="progress-fill" style={{ width: `${phase.realPct}%`, background: MACRO_PHASE_COLORS[phase.phase] }} />
                  </div>
                  <span className="text-right text-xs text-text-secondary">{phase.realPct}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
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
                    <td><span className="badge badge-red">{criticalReason(task)}</span></td>
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
                  <span className={task.end_date && task.end_date < asOfIso && task.real_pct < 100 ? 'badge badge-red' : 'badge badge-amber'}>{formatDate(task.end_date)}</span>
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
                <span className="text-right text-text-muted">{squad.tasks} itens</span>
              </div>
            ))}
          </div>
        </section>
      </section>

      <footer className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span>Última sincronização: {lastSyncedAt ? lastSyncedAt.toLocaleString('pt-BR') : 'local'}</span>
        <span>Modelo EVM operacional por horas planejadas; histórico real será refinado quando houver snapshots diários.</span>
        {isLoading || projectQuery.isLoading ? <span>Carregando indicadores...</span> : null}
      </footer>
    </div>
  )
}

function buildScheduleReport(sourceTasks: MacroScheduleTask[], holidays: string[]) {
  const tasks = sortMacroTasks(sourceTasks).filter((task) => task.title)
  const totalHours = tasks.reduce((sum, task) => sum + taskWeight(task, holidays), 0) || 1
  const curve = buildCurve(tasks, holidays, totalHours)
  const current = pointAtDate(curve, asOfIso) ?? curve[curve.length - 1] ?? emptyPoint()
  const pv = current.pv
  const ev = current.ev
  const sv = ev - pv
  const spi = pv > 0 ? ev / pv : null
  const plannedPct = Math.round((pv / totalHours) * 100)
  const realPct = Math.round((ev / totalHours) * 100)
  const forecast = buildForecast(tasks, spi)

  return {
    tasks,
    curve,
    pv,
    ev,
    sv,
    plannedPct,
    realPct,
    spi,
    spiText: spi === null ? '-' : spi.toFixed(2),
    spiStatus: spi === null ? 'Sem PV' : spi >= 1 ? 'No prazo' : spi >= 0.85 ? 'Atenção' : 'Crítico',
    spiTone: (spi === null ? 'blue' : spi >= 1 ? 'green' : spi >= 0.85 ? 'amber' : 'red') as KpiTone,
    forecastLabel: forecast.label,
    forecastDetail: forecast.detail,
    forecastTone: forecast.tone,
    evmBars: [
      { name: 'BAC', hours: Math.round(totalHours) },
      { name: 'PV', hours: Math.round(pv) },
      { name: 'EV', hours: Math.round(ev) },
      { name: 'SV', hours: Math.round(sv) },
    ],
    criticalTasks: tasks
      .filter((task) => isCriticalTask(task))
      .sort((a, b) => criticalScore(b) - criticalScore(a))
      .slice(0, 12),
    milestones: tasks
      .filter((task) => task.is_milestone || task.start_date === task.end_date)
      .sort((a, b) => String(a.end_date ?? '').localeCompare(String(b.end_date ?? ''))),
    phaseSummaries: MACRO_PHASES.map((phase) => summarizePhase(phase, tasks, holidays)),
    squadSummaries: summarizeSquads(tasks, holidays),
  }
}

function buildCurve(tasks: MacroScheduleTask[], holidays: string[], totalHours: number): CurvePoint[] {
  const { start, end } = scheduleRange(tasks)
  const points: CurvePoint[] = []
  const cursor = new Date(`${start}T12:00:00`)
  const finish = new Date(`${end}T12:00:00`)

  while (cursor <= finish) {
    const date = cursor.toISOString().slice(0, 10)
    const pv = tasks.reduce((sum, task) => sum + taskWeight(task, holidays) * plannedFraction(task, date), 0)
    const ev = tasks.reduce((sum, task) => sum + taskWeight(task, holidays) * actualFraction(task, date), 0)
    points.push({
      date,
      label: cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      planned: Math.round((pv / totalHours) * 100),
      realized: Math.round((ev / totalHours) * 100),
      pv: Math.round(pv * 10) / 10,
      ev: Math.round(ev * 10) / 10,
      spi: pv > 0 ? Math.round((ev / pv) * 100) / 100 : null,
      baseline: 1,
    })
    cursor.setDate(cursor.getDate() + Math.max(1, Math.ceil((finish.getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000 / 32)))
  }
  return points
}

function scheduleRange(tasks: MacroScheduleTask[]) {
  const dates = tasks.flatMap((task) => [task.start_date, task.end_date]).filter(Boolean) as string[]
  const sorted = dates.sort()
  return {
    start: sorted[0] ?? asOfIso,
    end: sorted[sorted.length - 1] ?? asOfIso,
  }
}

function taskWeight(task: MacroScheduleTask, holidays: string[]) {
  if (task.is_milestone) return Math.max(1, Number(task.hours || 0) || 1)
  return Math.max(1, Number(task.hours || 0) || countBusinessDays(task.start_date, task.end_date, holidays) * 8 || 1)
}

function plannedFraction(task: MacroScheduleTask, date: string) {
  if (!task.start_date || !task.end_date) return task.planned_pct / 100
  if (date < task.start_date) return 0
  if (date >= task.end_date) return 1
  const start = new Date(`${task.start_date}T12:00:00`).getTime()
  const end = new Date(`${task.end_date}T12:00:00`).getTime()
  const current = new Date(`${date}T12:00:00`).getTime()
  return Math.max(0, Math.min(1, (current - start) / Math.max(1, end - start)))
}

function actualFraction(task: MacroScheduleTask, date: string) {
  const real = task.real_pct / 100
  if (!task.start_date || date < task.start_date) return 0
  if (date >= asOfIso) return real
  if (task.end_date && date >= task.end_date) return real
  const start = new Date(`${task.start_date}T12:00:00`).getTime()
  const current = new Date(`${date}T12:00:00`).getTime()
  const today = asOf.getTime()
  return Math.max(0, Math.min(real, real * ((current - start) / Math.max(1, today - start))))
}

function pointAtDate(points: CurvePoint[], date: string) {
  return points.find((point) => point.date >= date) ?? points[points.length - 1]
}

function buildForecast(tasks: MacroScheduleTask[], spi: number | null) {
  const range = scheduleRange(tasks)
  if (!spi) return { label: '-', detail: 'Sem base', tone: 'blue' as const }
  const start = new Date(`${range.start}T12:00:00`)
  const end = new Date(`${range.end}T12:00:00`)
  const plannedDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000))
  const projectedDays = Math.round(plannedDays / Math.max(0.1, spi))
  const projected = new Date(start)
  projected.setDate(projected.getDate() + projectedDays)
  const delta = Math.round((projected.getTime() - end.getTime()) / 86_400_000)
  return {
    label: projected.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    detail: delta > 0 ? `+${delta} dias` : delta < 0 ? `${delta} dias` : 'Sem desvio',
    tone: delta > 0 ? 'red' as const : 'green' as const,
  }
}

function isCriticalTask(task: MacroScheduleTask) {
  return !task.start_date || !task.end_date || !task.responsible || (task.end_date < asOfIso && task.real_pct < 100) || task.real_pct + 5 < task.planned_pct
}

function criticalScore(task: MacroScheduleTask) {
  let score = 0
  if (task.end_date && task.end_date < asOfIso && task.real_pct < 100) score += 4
  if (task.real_pct + 5 < task.planned_pct) score += 3
  if (!task.responsible) score += 2
  if (!task.start_date || !task.end_date) score += 1
  return score
}

function criticalReason(task: MacroScheduleTask) {
  if (!task.start_date || !task.end_date) return 'Sem data'
  if (task.end_date < asOfIso && task.real_pct < 100) return 'Vencida'
  if (!task.responsible) return 'Sem resp.'
  if (task.real_pct + 5 < task.planned_pct) return 'Baixa execução'
  return 'Atenção'
}

function summarizePhase(phase: MacroSchedulePhase, tasks: MacroScheduleTask[], holidays: string[]) {
  const phaseTasks = tasks.filter((task) => task.phase === phase)
  const weight = phaseTasks.reduce((sum, task) => sum + taskWeight(task, holidays), 0) || 1
  const ev = phaseTasks.reduce((sum, task) => sum + taskWeight(task, holidays) * task.real_pct / 100, 0)
  const overdue = phaseTasks.filter((task) => task.end_date && task.end_date < asOfIso && task.real_pct < 100).length
  return {
    phase,
    realPct: Math.round((ev / weight) * 100),
    overdue,
  }
}

function summarizeSquads(tasks: MacroScheduleTask[], holidays: string[]): SquadSummary[] {
  const groups = new Map<string, MacroScheduleTask[]>()
  tasks.forEach((task) => {
    const key = task.squad || task.responsible || 'Sem squad'
    groups.set(key, [...(groups.get(key) ?? []), task])
  })
  return Array.from(groups.entries()).map(([squad, items]) => {
    const plannedHours = items.reduce((sum, task) => sum + taskWeight(task, holidays), 0)
    const pv = items.reduce((sum, task) => sum + taskWeight(task, holidays) * plannedFraction(task, asOfIso), 0)
    const ev = items.reduce((sum, task) => sum + taskWeight(task, holidays) * task.real_pct / 100, 0)
    return {
      squad,
      tasks: items.length,
      plannedHours,
      pv,
      ev,
      spi: calcLineSPI(ev, pv),
      overdue: items.filter((task) => task.end_date && task.end_date < asOfIso && task.real_pct < 100).length,
    }
  }).sort((a, b) => b.overdue - a.overdue || (a.spi ?? 99) - (b.spi ?? 99))
}

function emptyPoint(): CurvePoint {
  return { date: asOfIso, label: 'Hoje', planned: 0, realized: 0, pv: 0, ev: 0, spi: null, baseline: 1 }
}

function Kpi({ title, value, detail, icon, tone = 'blue' }: { title: string; value: string; detail: string; icon: ReactNode; tone?: KpiTone }) {
  const toneClass = tone === 'green' ? 'text-success' : tone === 'amber' ? 'text-warn' : tone === 'red' ? 'text-danger' : 'text-brand-600'
  return (
    <article className="card2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">{title}</p>
          <strong className="mt-2 block text-2xl text-text-primary">{value}</strong>
        </div>
        <span className={`rounded-[8px] bg-[#0f1229] p-2 ${toneClass}`}>{icon}</span>
      </div>
      <span className="mt-4 block text-xs text-text-muted">{detail}</span>
    </article>
  )
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
