import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Download,
  Gauge,
  HelpCircle,
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
import { MACRO_PHASE_COLORS } from '@/lib/macroSchedule'
import { buildScheduleAnalytics, criticalReason, type CheckpointSummary } from '@/lib/scheduleAnalytics'
import { formatDate } from '@/lib/utils'

type KpiTone = 'blue' | 'green' | 'amber' | 'red'

export default function ScheduleReportsPage() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const projectQuery = useProject(projectId)
  const { tasks, holidayDates, isLoading, forceSync, lastSyncedAt } = useMacroSchedule(projectId)

  const report = useMemo(() => buildScheduleAnalytics(tasks, holidayDates), [holidayDates, tasks])
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
            {project?.name ?? 'Projeto'} - análise gerada a partir do Cronograma Macro em {formatDate(report.asOfIso)}.
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

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Kpi title="SPI" value={report.spiText} detail={report.spiStatus} icon={<Gauge className="h-5 w-5" />} tone={report.spiTone} info="Schedule Performance Index. Mede eficiência do cronograma: EV dividido por PV. Abaixo de 1 indica atraso; acima de 1 indica avanço sobre o planejado." />
        <Kpi title="PV" value={`${report.pv.toFixed(0)}h`} detail={`${report.plannedPct}% planejado`} icon={<TrendingUp className="h-5 w-5" />} info="Planned Value em horas ponderadas. Usa o peso da tarefa informado em Peso (h)/Horas; se vazio, usa dias úteis x 8. Fórmula: peso x % planejado efetivo." />
        <Kpi title="EV" value={`${report.ev.toFixed(0)}h`} detail={`${report.realPct}% realizado`} icon={<CheckCircle2 className="h-5 w-5" />} info="Earned Value em horas ponderadas. Usa o mesmo peso da tarefa de PV e multiplica pelo % Real aceito. Fórmula: peso x % Real." />
        <Kpi title="SV" value={`${report.sv >= 0 ? '+' : ''}${report.sv.toFixed(0)}h`} detail={report.sv >= 0 ? 'Adiantado' : 'Atrasado'} icon={<AlertTriangle className="h-5 w-5" />} tone={report.sv >= 0 ? 'green' : 'red'} info="Schedule Variance. Diferença entre EV e PV. Valor negativo mostra déficit de execução em horas; valor positivo mostra avanço sobre o plano." />
        <Kpi title="Atrasos" value={String(report.delayedTasks.length)} detail={`${report.overdueTasks.length} vencida(s)`} icon={<AlertTriangle className="h-5 w-5" />} tone={report.delayedTasks.length ? 'red' : 'green'} info="Conta tarefas com % Real abaixo do % Plan. por mais de 5 pontos ou tarefas vencidas pela data final e ainda não concluídas." />
        <Kpi title="Forecast" value={report.forecastLabel} detail={report.forecastDetail} icon={<CalendarClock className="h-5 w-5" />} tone={report.forecastTone} info="Projeção simples da data final baseada no SPI atual. Quanto menor o SPI, maior a tendência de extensão do prazo planejado." />
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
            <AreaChart data={report.spiCurve} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
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
        <ChartCard title="EVM em horas ponderadas" badge="PV / EV">
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
        <span>PV/EV usam Peso (h)/Horas por tarefa; se vazio, fallback = dias úteis x 8. Para EVM monetário completo, preencher BAC/AC no template PMI/EVM.</span>
        {isLoading || projectQuery.isLoading ? <span>Carregando indicadores...</span> : null}
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

function Kpi({
  title,
  value,
  detail,
  icon,
  info,
  tone = 'blue',
}: {
  title: string
  value: string
  detail: string
  icon: ReactNode
  info: string
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
