import type { CreateMacroScheduleTaskInput, MacroScheduleHolidayInput, MacroSchedulePhase, MacroScheduleTask, MacroScheduleZoom } from '@/types'

export const MACRO_PHASES: MacroSchedulePhase[] = ['Prepare', 'Explore', 'Realize', 'Deploy', 'Run']
export const MACRO_ZOOMS: MacroScheduleZoom[] = ['day', 'week', 'month', 'quarter']

export const MACRO_PHASE_COLORS: Record<MacroSchedulePhase, string> = {
  Prepare: '#10b981',
  Explore: '#3B4FE8',
  Realize: '#8b5cf6',
  Deploy: '#F59E0B',
  Run: '#06b6d4',
}

export const MACRO_ZOOM_LABELS: Record<MacroScheduleZoom, string> = {
  day: 'Dia',
  week: 'Semana',
  month: 'Mês',
  quarter: 'Trimestre',
}

type EditableMacroTask = MacroScheduleTask | CreateMacroScheduleTaskInput

export function calcLineSPI(realPct: number, plannedPct: number) {
  if (!plannedPct) return null
  return Math.round((realPct / plannedPct) * 100) / 100
}

export function formatSPI(realPct: number, plannedPct: number) {
  const spi = calcLineSPI(realPct, plannedPct)
  return spi === null ? '—' : spi.toFixed(2)
}

export function isMilestoneLike(task: Pick<EditableMacroTask, 'is_milestone' | 'start_date' | 'end_date'>) {
  return task.is_milestone || Boolean(task.start_date && task.end_date && task.start_date === task.end_date)
}

export function countBusinessDays(start?: string, end?: string, holidays: string[] = [], milestone = false) {
  if (!start || !end) return 0
  if (milestone || start === end) return 0
  const holidaySet = new Set(holidays)
  const current = new Date(`${start}T12:00:00`)
  const finish = new Date(`${end}T12:00:00`)
  if (Number.isNaN(current.getTime()) || Number.isNaN(finish.getTime()) || current > finish) return 0

  let days = 0
  while (current <= finish) {
    const iso = current.toISOString().slice(0, 10)
    const weekDay = current.getDay()
    if (weekDay !== 0 && weekDay !== 6 && !holidaySet.has(iso)) days += 1
    current.setDate(current.getDate() + 1)
  }
  return days
}

export function sortMacroTasks<T extends Pick<EditableMacroTask, 'sort_order' | 'wbs'>>(tasks: T[]) {
  return tasks.slice().sort((a, b) => a.sort_order - b.sort_order || a.wbs.localeCompare(b.wbs, 'pt-BR', { numeric: true }))
}

export function renumberWbs<T extends EditableMacroTask>(tasks: T[]): T[] {
  const counters: number[] = []
  return sortMacroTasks(tasks).map((task, index) => {
    const level = Math.max(1, Math.min(8, task.level || 2))
    counters[level - 1] = (counters[level - 1] ?? 0) + 1
    counters.length = level
    if (level > 1 && counters[0] == null) counters[0] = 1
    const wbs = counters.slice(0, level).join('.')
    return { ...task, wbs, sort_order: index + 1 }
  })
}

export function recalcParentAggregates<T extends EditableMacroTask>(tasks: T[]): T[] {
  const ordered = sortMacroTasks(tasks)
  return ordered.map((task, index) => {
    const children = getLeafDescendants(ordered, index)
    if (!children.length) return task
    const totalWeight = children.reduce((sum, child) => sum + getWeight(child), 0) || children.length
    const planned_pct = Math.round(children.reduce((sum, child) => sum + child.planned_pct * getWeight(child), 0) / totalWeight)
    const real_pct = Math.round(children.reduce((sum, child) => sum + child.real_pct * getWeight(child), 0) / totalWeight)
    return { ...task, planned_pct, real_pct }
  })
}

function getLeafDescendants<T extends EditableMacroTask>(tasks: T[], parentIndex: number) {
  const parent = tasks[parentIndex]
  const descendants: T[] = []
  for (let i = parentIndex + 1; i < tasks.length; i += 1) {
    const item = tasks[i]
    if (item.level <= parent.level) break
    const next = tasks[i + 1]
    if (!next || next.level <= item.level) descendants.push(item)
  }
  return descendants
}

function getWeight(task: Pick<EditableMacroTask, 'hours' | 'start_date' | 'end_date' | 'is_milestone'>) {
  return Math.max(1, Number(task.hours || 0) || countBusinessDays(task.start_date, task.end_date, [], task.is_milestone) || 1)
}

export function normalizeMacroTasksForSave(projectId: string, tasks: EditableMacroTask[], options: { preserveWbs?: boolean } = {}): CreateMacroScheduleTaskInput[] {
  const normalized = options.preserveWbs
    ? recalcParentAggregates(sortMacroTasks(tasks))
    : recalcParentAggregates(renumberWbs(tasks))

  return normalized.map((task, index) => ({
    project_id: projectId,
    wbs: task.wbs,
    parent_id: task.parent_id,
    title: task.title,
    phase: task.phase,
    squad: task.squad || undefined,
    responsible: task.responsible || undefined,
    allocation_pct: clampNumber(task.allocation_pct, 0, 100),
    start_date: task.start_date || undefined,
    end_date: task.is_milestone ? task.start_date || task.end_date : task.end_date || undefined,
    is_milestone: task.is_milestone,
    planned_pct: clampNumber(task.planned_pct, 0, 100),
    real_pct: clampNumber(task.real_pct, 0, 100),
    predecessors: task.predecessors ?? [],
    hours: Math.max(0, Number(task.hours || 0)),
    level: Math.max(1, Math.min(8, task.level || 2)),
    sort_order: index + 1,
    notes: task.notes || undefined,
    source_uid: task.source_uid,
    source_id: task.source_id,
    source_outline_number: task.source_outline_number,
    source_outline_level: task.source_outline_level,
    source_calendar_uid: task.source_calendar_uid,
    source_constraint_type: task.source_constraint_type,
    source_constraint_date: task.source_constraint_date,
    source_is_summary: task.source_is_summary,
    source_is_critical: task.source_is_critical,
    source_is_active: task.source_is_active,
    source_is_manual: task.source_is_manual,
    source_raw: task.source_raw,
  }))
}

export function clampNumber(value: unknown, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return min
  return Math.max(min, Math.min(max, parsed))
}

export function parsePredecessors(value: string) {
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0)
}

export function createEmptyMacroTask(projectId: string, sortOrder: number, phase: MacroSchedulePhase = 'Prepare'): CreateMacroScheduleTaskInput {
  return {
    project_id: projectId,
    wbs: `1.${sortOrder}`,
    title: '',
    phase,
    squad: '',
    responsible: '',
    allocation_pct: 100,
    start_date: undefined,
    end_date: undefined,
    is_milestone: false,
    planned_pct: 0,
    real_pct: 0,
    predecessors: [],
    hours: 0,
    level: 2,
    sort_order: sortOrder,
    notes: '',
  }
}

export function seedMacroScheduleTasks(projectId: string): CreateMacroScheduleTaskInput[] {
  return [
    row('1.1', 'Planejamento do Projeto', 'Prepare', 'PMO', 'PMO', 100, '2026-06-01', '2026-06-12', 10, 100, '', 80),
    row('1.2', 'Execução do Tax Readiness for Cast', 'Explore', 'ABAP', 'Time ABAP', 100, '2026-06-15', '2026-06-25', 9, 100, '', 72),
    row('1.3', 'Instalação de produtos', 'Realize', 'ABAP', 'Time ABAP', 100, '2026-06-15', '2026-07-07', 17, 59, '', 136),
    row('1.4', 'Aplicação de Notas SAP', 'Realize', 'BASIS', 'Time BASIS', 100, '2026-06-15', '2026-06-22', 6, 100, '', 48),
    row('1.5', 'SOFICOM Monitor de Eventos', 'Realize', 'SOFICOM', 'SOFICOM', 100, '2026-06-29', '2026-07-09', 9, 0, '', 72),
    row('1.6', 'CNPJ Alfanumérico', 'Realize', 'CNPJ', 'Time CNPJ', 100, '2026-06-08', '2026-07-09', 24, 63, '', 192),
    row('1.7', 'SAP Nota de débito e crédito', 'Realize', 'Tax/FI', 'Time Tax', 100, '2026-07-06', '2026-07-23', 14, 0, '', 112),
    row('1.8', 'SOFICOM Nota de débito e crédito', 'Realize', 'SOFICOM', 'SOFICOM', 100, '2026-07-06', '2026-07-23', 14, 0, '', 112),
    row('1.9', 'SOFICOM Apuração CBS', 'Realize', 'SOFICOM', 'SOFICOM', 100, '2026-07-20', '2026-08-20', 24, 0, '', 192),
    row('1.10', 'NT 2026.001 - Vinculo de Pagamentos (Aguard.)', 'Realize', 'ABAP', 'Time ABAP', 100, undefined, undefined, 1, 0, '', 0),
    row('1.11', 'Execução do Cutover - Monitor de Eventos e CNPJ', 'Deploy', 'PMO', 'PMO', 100, '2026-07-10', '2026-07-10', 1, 0, '', 8),
    row('1.12', 'Execução do Cutover - Notas de Débito e Crédito', 'Deploy', 'PMO', 'PMO', 100, '2026-07-24', '2026-07-31', 6, 0, '', 48),
    row('1.13', 'Execução do Cutover - Apuração CBS', 'Deploy', 'PMO', 'PMO', 100, '2026-08-21', '2026-08-28', 6, 0, '', 48),
    row('1.14', 'Go-Live 1 - Monitor de Eventos e CNPJ Alfan.', 'Deploy', 'PMO', '(GP)', 0, '2026-07-13', '2026-07-13', 1, 0, '', 0, true),
    row('1.15', 'Go-Live 2 - Notas de Débito e Crédito', 'Deploy', 'PMO', '(GP)', 0, '2026-08-03', '2026-08-03', 0, 0, '', 0, true),
    row('1.16', 'Go-Live 3 - Apuração CBS', 'Deploy', 'PMO', '(GP)', 0, '2026-08-31', '2026-08-31', 0, 0, '', 0, true),
    row('1.17', 'Suporte Pós Go-live', 'Deploy', 'PMO', 'PMO', 100, '2026-07-14', '2026-10-01', 0, 0, '', 440),
  ].map((item, index) => ({ ...item, project_id: projectId, sort_order: index + 1 }))
}

function row(
  wbs: string,
  title: string,
  phase: MacroSchedulePhase,
  squad: string,
  responsible: string,
  allocation_pct: number,
  start_date: string | undefined,
  end_date: string | undefined,
  planned_pct: number,
  real_pct: number,
  predecessorsText: string,
  hours: number,
  is_milestone = false,
): CreateMacroScheduleTaskInput {
  return {
    project_id: '',
    wbs,
    title,
    phase,
    squad,
    responsible,
    allocation_pct,
    start_date,
    end_date,
    is_milestone,
    planned_pct,
    real_pct,
    predecessors: parsePredecessors(predecessorsText),
    hours,
    level: wbs.split('.').length,
    sort_order: 0,
    notes: '',
  }
}

export function getBrazilNationalHolidays(year: number, projectId: string): MacroScheduleHolidayInput[] {
  const easter = calcEaster(year)
  const movable = [
    { offset: -48, name: 'Carnaval' },
    { offset: -47, name: 'Carnaval' },
    { offset: -2, name: 'Sexta-feira Santa' },
    { offset: 60, name: 'Corpus Christi' },
  ].map(({ offset, name }) => ({
    project_id: projectId,
    holiday_date: addDays(easter, offset),
    name,
    source: 'br-national' as const,
  }))

  return [
    fixed(year, 1, 1, 'Confraternização Universal', projectId),
    fixed(year, 4, 21, 'Tiradentes', projectId),
    fixed(year, 5, 1, 'Dia do Trabalho', projectId),
    fixed(year, 9, 7, 'Independência do Brasil', projectId),
    fixed(year, 10, 12, 'Nossa Senhora Aparecida', projectId),
    fixed(year, 11, 2, 'Finados', projectId),
    fixed(year, 11, 15, 'Proclamação da República', projectId),
    fixed(year, 11, 20, 'Consciência Negra', projectId),
    fixed(year, 12, 25, 'Natal', projectId),
    ...movable,
  ]
}

export function getHolidaysForTaskRange(projectId: string, tasks: Pick<EditableMacroTask, 'start_date' | 'end_date'>[]) {
  const years = new Set<number>()
  tasks.forEach((task) => {
    if (task.start_date) years.add(new Date(`${task.start_date}T12:00:00`).getFullYear())
    if (task.end_date) years.add(new Date(`${task.end_date}T12:00:00`).getFullYear())
  })
  return Array.from(years).flatMap((year) => getBrazilNationalHolidays(year, projectId))
}

function fixed(year: number, month: number, day: number, name: string, projectId: string): MacroScheduleHolidayInput {
  return {
    project_id: projectId,
    holiday_date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    name,
    source: 'br-national',
  }
}

function calcEaster(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}
