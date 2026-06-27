import {
  countBusinessDays,
  derivePlannedPctByDate,
  effectivePlannedPct,
  sortMacroTasks,
  todayIso,
} from '@/lib/macroSchedule'
import type {
  CreateMacroScheduleBaselineInput,
  CreateMacroScheduleBaselineTaskInput,
  CreateMacroScheduleSnapshotInput,
  CreateMacroScheduleSnapshotTaskInput,
  MacroScheduleBaseline,
  MacroScheduleBaselineTask,
  MacroScheduleSnapshot,
  MacroScheduleTask,
} from '@/types'

type BaselineSourceTask = MacroScheduleTask | CreateMacroScheduleBaselineTaskInput

export function scheduleTaskWeight(
  task: Pick<BaselineSourceTask, 'hours' | 'start_date' | 'end_date' | 'is_milestone'>,
  holidays: string[] = []
) {
  if (task.is_milestone) return Math.max(1, Number(task.hours || 0) || 1)
  return Math.max(1, Number(task.hours || 0) || countBusinessDays(task.start_date, task.end_date, holidays) * 8 || 1)
}

export function nextBaselineVersion(baselines: MacroScheduleBaseline[]) {
  return (baselines.reduce((max, baseline) => Math.max(max, baseline.version), 0) || 0) + 1
}

export function buildBaselineInput(
  projectId: string,
  version: number,
  tasks: MacroScheduleTask[],
  holidays: string[],
  notes = ''
): CreateMacroScheduleBaselineInput {
  const ordered = sortMacroTasks(tasks)
  return {
    project_id: projectId,
    version,
    name: `Baseline V${version}`,
    baseline_date: todayIso(),
    status: 'locked',
    locked_at: new Date().toISOString(),
    notes,
    task_count: ordered.length,
    total_weight: round1(ordered.reduce((sum, task) => sum + scheduleTaskWeight(task, holidays), 0)),
  }
}

export function buildBaselineTaskInputs(
  projectId: string,
  baselineId: string,
  tasks: MacroScheduleTask[]
): CreateMacroScheduleBaselineTaskInput[] {
  return sortMacroTasks(tasks).map((task, index) => ({
    baseline_id: baselineId,
    project_id: projectId,
    original_task_id: isUuid(task.id) ? task.id : undefined,
    wbs: task.wbs,
    title: task.title,
    phase: task.phase,
    squad: task.squad,
    responsible: task.responsible,
    allocation_pct: task.allocation_pct,
    start_date: task.start_date,
    end_date: task.end_date,
    is_milestone: task.is_milestone,
    planned_pct: task.planned_pct,
    real_pct: task.real_pct,
    predecessors: task.predecessors ?? [],
    hours: task.hours,
    level: task.level,
    sort_order: index + 1,
    notes: task.notes,
  }))
}

export function buildSnapshotInputs({
  projectId,
  baseline,
  baselineTasks,
  currentTasks,
  statusDate,
  holidays,
  notes = '',
}: {
  projectId: string
  baseline: MacroScheduleBaseline
  baselineTasks: MacroScheduleBaselineTask[]
  currentTasks: MacroScheduleTask[]
  statusDate: string
  holidays: string[]
  notes?: string
}): { snapshot: CreateMacroScheduleSnapshotInput; tasks: CreateMacroScheduleSnapshotTaskInput[] } {
  const currentByWbs = new Map(currentTasks.map((task) => [task.wbs, task]))
  const snapshotTasks = sortMacroTasks(baselineTasks).map((baselineTask) => {
    const current = currentByWbs.get(baselineTask.wbs)
    const planned_pct = plannedPctAtCutoff(baselineTask, statusDate, holidays)
    const real_pct = current?.real_pct ?? baselineTask.real_pct
    const weight = scheduleTaskWeight(baselineTask, holidays)
    const pv = round1(weight * planned_pct / 100)
    const ev = round1(weight * real_pct / 100)
    const spi = pv > 0 ? round2(ev / pv) : null
    const is_delayed = planned_pct > 0 && real_pct + 5 < planned_pct
    return {
      snapshot_id: '',
      baseline_task_id: baselineTask.id,
      project_id: projectId,
      wbs: baselineTask.wbs,
      title: baselineTask.title,
      planned_pct,
      real_pct,
      weight,
      pv,
      ev,
      spi,
      is_delayed,
      notes: current?.notes ?? baselineTask.notes,
    }
  })

  const totalWeight = snapshotTasks.reduce((sum, task) => sum + task.weight, 0) || 1
  const pv = round1(snapshotTasks.reduce((sum, task) => sum + task.pv, 0))
  const ev = round1(snapshotTasks.reduce((sum, task) => sum + task.ev, 0))
  const snapshot: CreateMacroScheduleSnapshotInput = {
    project_id: projectId,
    baseline_id: baseline.id,
    status_date: statusDate,
    measured_at: new Date().toISOString(),
    notes,
    task_count: snapshotTasks.length,
    total_weight: round1(totalWeight),
    planned_pct: round1(pv / totalWeight * 100),
    real_pct: round1(ev / totalWeight * 100),
    pv,
    ev,
    spi: pv > 0 ? round2(ev / pv) : null,
    delayed_count: snapshotTasks.filter((task) => task.is_delayed).length,
  }

  return { snapshot, tasks: snapshotTasks }
}

export function snapshotToCurvePoint(snapshot: MacroScheduleSnapshot) {
  return {
    date: snapshot.status_date,
    label: new Date(`${snapshot.status_date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    planned: round1(snapshot.planned_pct),
    realized: round1(snapshot.real_pct),
    pv: round1(snapshot.pv),
    ev: round1(snapshot.ev),
    spi: snapshot.spi ?? null,
    baseline: 1,
  }
}

function plannedPctAtCutoff(task: MacroScheduleBaselineTask, statusDate: string, holidays: string[]) {
  const explicit = effectivePlannedPct(task, statusDate, holidays)
  if (task.planned_pct > 0) return explicit
  return derivePlannedPctByDate(task, statusDate, holidays)
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
