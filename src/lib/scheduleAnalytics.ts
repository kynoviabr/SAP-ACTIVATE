import {
  MACRO_PHASES,
  calcLineSPI,
  countBusinessDays,
  derivePlannedPctByDate,
  effectivePlannedPct,
  sortMacroTasks,
} from '@/lib/macroSchedule'
import type { MacroSchedulePhase, MacroScheduleTask, PhaseNumber, ProjectStatus, Task } from '@/types'

export type ScheduleCurvePoint = {
  date: string
  label: string
  planned: number
  realized: number
  pv: number
  ev: number
  spi: number | null
  baseline: number
}

export type PhaseScheduleSummary = {
  phase: MacroSchedulePhase
  phaseNumber: PhaseNumber
  realPct: number
  delayed: number
  overdue: number
  missingSchedule: number
  completed: number
  total: number
}

export type CheckpointSummary = {
  task: MacroScheduleTask
  status: 'Concluido' | 'Vencido' | 'Atencao' | 'Futuro'
}

export type SquadScheduleSummary = {
  squad: string
  tasks: number
  plannedHours: number
  ev: number
  pv: number
  spi: number | null
  delayed: number
  overdue: number
}

export type ScheduleAnalytics = {
  asOfIso: string
  tasks: MacroScheduleTask[]
  curve: ScheduleCurvePoint[]
  spiCurve: ScheduleCurvePoint[]
  pv: number
  ev: number
  sv: number
  totalHours: number
  plannedPct: number
  realPct: number
  spi: number | null
  spiText: string
  spiStatus: string
  spiTone: 'blue' | 'green' | 'amber' | 'red'
  delayedTasks: MacroScheduleTask[]
  overdueTasks: MacroScheduleTask[]
  forecastLabel: string
  forecastDetail: string
  forecastTone: 'blue' | 'green' | 'red'
  evmBars: Array<{ name: string; hours: number }>
  criticalTasks: MacroScheduleTask[]
  milestones: MacroScheduleTask[]
  checkpoints: CheckpointSummary[]
  phaseSummaries: PhaseScheduleSummary[]
  squadSummaries: SquadScheduleSummary[]
}

export function buildScheduleAnalytics(sourceTasks: MacroScheduleTask[], holidays: string[] = [], asOf = new Date()): ScheduleAnalytics {
  const asOfIso = toLocalIsoDate(asOf)
  const tasks = sortMacroTasks(sourceTasks).filter((task) => task.title)
  const totalHours = tasks.reduce((sum, task) => sum + taskWeight(task, holidays), 0) || 1
  const curve = buildCurve(tasks, holidays, totalHours, asOf)
  const current = buildCurvePoint(tasks, holidays, totalHours, asOfIso, asOf)
  const spiCurve = clampCurveToCurrentDate(curve, current, asOfIso)
  const pv = current.pv
  const ev = current.ev
  const sv = ev - pv
  const spi = pv > 0 ? ev / pv : null
  const plannedPct = Math.round((pv / totalHours) * 100)
  const realPct = Math.round((ev / totalHours) * 100)
  const forecast = buildForecast(tasks, spi, asOfIso)
  const delayedTasks = tasks.filter((task) => isDelayedTask(task, asOfIso, holidays))
  const overdueTasks = tasks.filter((task) => isOverdueTask(task, asOfIso))

  return {
    asOfIso,
    tasks,
    curve,
    spiCurve,
    pv,
    ev,
    sv,
    totalHours,
    plannedPct,
    realPct,
    spi,
    spiText: spi === null ? '-' : spi.toFixed(2),
    spiStatus: spi === null ? 'Sem PV' : spi >= 1 ? 'No prazo' : spi >= 0.85 ? 'Atenção' : 'Crítico',
    spiTone: spi === null ? 'blue' : spi >= 1 ? 'green' : spi >= 0.85 ? 'amber' : 'red',
    delayedTasks,
    overdueTasks,
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
      .filter((task) => isCriticalTask(task, asOfIso, holidays))
      .sort((a, b) => criticalScore(b, asOfIso, holidays) - criticalScore(a, asOfIso, holidays))
      .slice(0, 12),
    milestones: tasks
      .filter((task) => task.is_milestone || task.start_date === task.end_date)
      .sort((a, b) => String(a.end_date ?? '').localeCompare(String(b.end_date ?? ''))),
    checkpoints: buildCheckpoints(tasks, asOfIso, holidays),
    phaseSummaries: MACRO_PHASES.map((phase) => summarizePhase(phase, tasks, holidays, asOfIso)),
    squadSummaries: summarizeSquads(tasks, holidays, asOfIso),
  }
}

export function macroPhaseToPhaseNumber(phase: MacroSchedulePhase): PhaseNumber {
  if (phase === 'Prepare') return '1'
  if (phase === 'Explore') return '2'
  if (phase === 'Realize') return '3'
  if (phase === 'Deploy') return '4'
  return '5'
}

export function scheduleStatusFromSpi(spi: number): ProjectStatus {
  if (spi >= 0.95) return 'verde'
  if (spi >= 0.8) return 'amarelo'
  return 'vermelho'
}

export function criticalReason(task: MacroScheduleTask, asOfIso = toLocalIsoDate(new Date())) {
  if (!task.start_date || !task.end_date) return 'Sem data'
  if (isOverdueTask(task, asOfIso)) return 'Vencida'
  if (!task.responsible) return 'Sem resp.'
  if (isProgressBehind(task, asOfIso)) return 'Baixa execução'
  return 'Atenção'
}

export function macroTasksToDashboardTasks(tasks: MacroScheduleTask[]): Task[] {
  return sortMacroTasks(tasks).map((task, index) => ({
    id: task.id,
    tenant_id: task.tenant_id,
    created_at: task.created_at,
    updated_at: task.updated_at,
    project_id: task.project_id,
    parent_id: task.parent_id,
    wbs: task.wbs,
    title: task.title,
    phase: macroPhaseToPhaseNumber(task.phase),
    type: task.is_milestone || task.start_date === task.end_date ? 'milestone' : 'task',
    status: task.real_pct >= 100 ? 'concluido' : task.real_pct > 0 ? 'em_andamento' : 'pendente',
    start_date: task.start_date,
    end_date: task.end_date,
    duration_days: task.start_date && task.end_date
      ? Math.max(1, Math.round((new Date(`${task.end_date}T12:00:00`).getTime() - new Date(`${task.start_date}T12:00:00`).getTime()) / 86_400_000) + 1)
      : undefined,
    assignee: task.responsible || task.squad,
    progress_pct: task.real_pct,
    planned_hours: task.hours,
    actual_hours: Math.round(task.hours * task.real_pct) / 100,
    dependencies: task.predecessors.map(String),
    notes: task.notes,
    sort_order: task.sort_order || index + 1,
  }))
}

function toLocalIsoDate(date: Date) {
  const local = new Date(date)
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
  return local.toISOString().slice(0, 10)
}

function buildCurve(tasks: MacroScheduleTask[], holidays: string[], totalHours: number, asOf: Date): ScheduleCurvePoint[] {
  const asOfIso = toLocalIsoDate(asOf)
  const { start, end } = scheduleRange(tasks, asOfIso)
  const points: ScheduleCurvePoint[] = []
  const cursor = new Date(`${start}T12:00:00`)
  const finish = new Date(`${end}T12:00:00`)

  while (cursor <= finish) {
    const date = toLocalIsoDate(cursor)
    points.push(buildCurvePoint(tasks, holidays, totalHours, date, asOf))
    cursor.setDate(cursor.getDate() + Math.max(1, Math.ceil((finish.getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000 / 32)))
  }
  return points
}

function buildCurvePoint(tasks: MacroScheduleTask[], holidays: string[], totalHours: number, date: string, asOf: Date): ScheduleCurvePoint {
  const pv = tasks.reduce((sum, task) => sum + taskWeight(task, holidays) * plannedFraction(task, date, asOf, holidays), 0)
  const ev = tasks.reduce((sum, task) => sum + taskWeight(task, holidays) * actualFraction(task, date, asOf), 0)
  return {
    date,
    label: new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    planned: Math.round((pv / totalHours) * 100),
    realized: Math.round((ev / totalHours) * 100),
    pv: Math.round(pv * 10) / 10,
    ev: Math.round(ev * 10) / 10,
    spi: pv > 0 ? Math.round((ev / pv) * 100) / 100 : null,
    baseline: 1,
  }
}

function clampCurveToCurrentDate(curve: ScheduleCurvePoint[], current: ScheduleCurvePoint, asOfIso: string) {
  const past = curve.filter((point) => point.date < asOfIso)
  const hasCurrent = curve.some((point) => point.date === asOfIso)
  return hasCurrent ? curve.filter((point) => point.date <= asOfIso) : [...past, current]
}

function scheduleRange(tasks: MacroScheduleTask[], asOfIso: string) {
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

function plannedFraction(task: MacroScheduleTask, date: string, asOf: Date, holidays: string[]) {
  const asOfIso = toLocalIsoDate(asOf)
  const plannedNow = Math.max(0, Math.min(1, effectivePlannedPct(task, asOfIso, holidays) / 100))
  const plannedAtDate = Math.max(0, Math.min(1, derivePlannedPctByDate(task, date, holidays) / 100))
  if (!task.start_date || !task.end_date) return plannedNow
  if (date < task.start_date) return 0
  if (date >= task.end_date) return 1
  if (date === asOfIso) return plannedNow
  if (!task.planned_pct) return plannedAtDate

  const start = new Date(`${task.start_date}T12:00:00`).getTime()
  const end = new Date(`${task.end_date}T12:00:00`).getTime()
  const current = new Date(`${date}T12:00:00`).getTime()
  const today = asOf.getTime()

  if (date < asOfIso) {
    return Math.max(0, Math.min(plannedNow, plannedNow * ((current - start) / Math.max(1, today - start))))
  }

  return Math.max(plannedNow, Math.min(1, plannedNow + (1 - plannedNow) * ((current - today) / Math.max(1, end - today))))
}

function actualFraction(task: MacroScheduleTask, date: string, asOf: Date) {
  const asOfIso = toLocalIsoDate(asOf)
  const real = task.real_pct / 100
  if (!task.start_date || date < task.start_date) return 0
  if (date >= asOfIso) return real
  if (task.end_date && date >= task.end_date) return real
  const start = new Date(`${task.start_date}T12:00:00`).getTime()
  const current = new Date(`${date}T12:00:00`).getTime()
  const today = asOf.getTime()
  return Math.max(0, Math.min(real, real * ((current - start) / Math.max(1, today - start))))
}

function buildForecast(tasks: MacroScheduleTask[], spi: number | null, asOfIso: string) {
  const range = scheduleRange(tasks, asOfIso)
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

function isCriticalTask(task: MacroScheduleTask, asOfIso: string, holidays: string[]) {
  return !task.start_date || !task.end_date || !task.responsible || isDelayedTask(task, asOfIso, holidays)
}

function criticalScore(task: MacroScheduleTask, asOfIso: string, holidays: string[]) {
  let score = 0
  if (isOverdueTask(task, asOfIso)) score += 4
  if (isProgressBehind(task, asOfIso, holidays)) score += 3
  if (!task.responsible) score += 2
  if (!task.start_date || !task.end_date) score += 1
  return score
}

function isOverdueTask(task: MacroScheduleTask, asOfIso: string) {
  return Boolean(task.end_date && task.end_date < asOfIso && task.real_pct < 100)
}

function isProgressBehind(task: MacroScheduleTask, asOfIso = toLocalIsoDate(new Date()), holidays: string[] = []) {
  const planned = effectivePlannedPct(task, asOfIso, holidays)
  return planned > 0 && task.real_pct + 5 < planned
}

function isDelayedTask(task: MacroScheduleTask, asOfIso: string, holidays: string[] = []) {
  return isOverdueTask(task, asOfIso) || isProgressBehind(task, asOfIso, holidays)
}

function isCheckpoint(task: MacroScheduleTask) {
  return task.is_milestone || task.start_date === task.end_date || /go[- ]?live|cutover|quality gate|gate|marco/i.test(task.title)
}

function checkpointStatus(task: MacroScheduleTask, asOfIso: string, holidays: string[]): CheckpointSummary['status'] {
  if (task.real_pct >= 100) return 'Concluido'
  if (isOverdueTask(task, asOfIso)) return 'Vencido'
  if (isProgressBehind(task, asOfIso, holidays)) return 'Atencao'
  return 'Futuro'
}

function buildCheckpoints(tasks: MacroScheduleTask[], asOfIso: string, holidays: string[]): CheckpointSummary[] {
  const statusWeight: Record<CheckpointSummary['status'], number> = {
    Vencido: 0,
    Atencao: 1,
    Futuro: 2,
    Concluido: 3,
  }

  return tasks
    .filter(isCheckpoint)
    .map((task) => ({ task, status: checkpointStatus(task, asOfIso, holidays) }))
    .sort((a, b) => statusWeight[a.status] - statusWeight[b.status] || String(a.task.end_date ?? '').localeCompare(String(b.task.end_date ?? '')))
}

function summarizePhase(phase: MacroSchedulePhase, tasks: MacroScheduleTask[], holidays: string[], asOfIso: string): PhaseScheduleSummary {
  const phaseTasks = tasks.filter((task) => task.phase === phase)
  const weight = phaseTasks.reduce((sum, task) => sum + taskWeight(task, holidays), 0) || 1
  const ev = phaseTasks.reduce((sum, task) => sum + taskWeight(task, holidays) * task.real_pct / 100, 0)
  return {
    phase,
    phaseNumber: macroPhaseToPhaseNumber(phase),
    realPct: Math.round((ev / weight) * 100),
    delayed: phaseTasks.filter((task) => isDelayedTask(task, asOfIso, holidays)).length,
    overdue: phaseTasks.filter((task) => isOverdueTask(task, asOfIso)).length,
    missingSchedule: phaseTasks.filter((task) => !task.start_date || !task.end_date).length,
    completed: phaseTasks.filter((task) => task.real_pct >= 100).length,
    total: phaseTasks.length,
  }
}

function summarizeSquads(tasks: MacroScheduleTask[], holidays: string[], asOfIso: string): SquadScheduleSummary[] {
  const groups = new Map<string, MacroScheduleTask[]>()
  tasks.forEach((task) => {
    const key = task.squad || task.responsible || 'Sem squad'
    groups.set(key, [...(groups.get(key) ?? []), task])
  })
  return Array.from(groups.entries()).map(([squad, items]) => {
    const plannedHours = items.reduce((sum, task) => sum + taskWeight(task, holidays), 0)
    const pv = items.reduce((sum, task) => sum + taskWeight(task, holidays) * plannedFraction(task, asOfIso, new Date(`${asOfIso}T12:00:00`), holidays), 0)
    const ev = items.reduce((sum, task) => sum + taskWeight(task, holidays) * task.real_pct / 100, 0)
    return {
      squad,
      tasks: items.length,
      plannedHours,
      pv,
      ev,
      spi: calcLineSPI(ev, pv),
      delayed: items.filter((task) => isDelayedTask(task, asOfIso, holidays)).length,
      overdue: items.filter((task) => isOverdueTask(task, asOfIso)).length,
    }
  }).sort((a, b) => b.delayed - a.delayed || (a.spi ?? 99) - (b.spi ?? 99))
}
