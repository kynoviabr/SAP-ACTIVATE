import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarDays, Diamond, Download, FileInput, FileSpreadsheet, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import GanttChart from '@/components/gantt/GanttChart'
import { formatDate, PHASE_COLORS } from '@/lib/utils'
import { useTasks } from '@/hooks/useTasks'
import type { PhaseNumber, Task, TaskStatus, TaskType } from '@/types'

const statuses: TaskStatus[] = ['pendente', 'em_andamento', 'concluido', 'atrasado', 'cancelado']
const phases: PhaseNumber[] = ['1', '2', '3', '4', '5']

export default function MacroSchedulePage() {
  const { projectId } = useParams()
  const { tasks, isLoading } = useTasks(projectId)
  const excelInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<'table' | 'timeline'>('table')
  const [search, setSearch] = useState('')
  const [phase, setPhase] = useState<PhaseNumber | ''>('')
  const [status, setStatus] = useState<TaskStatus | ''>('')
  const [localTasks, setLocalTasks] = useState<Task[]>([])
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const storageKey = `sap-activate:macro-schedule:${projectId ?? 'local'}`
  const [draft, setDraft] = useState<Partial<Task>>({
    wbs: '1.6',
    title: '',
    phase: '1',
    type: 'task',
    start_date: '2026-06-22',
    end_date: '2026-06-26',
    assignee: '',
    status: 'pendente',
    progress_pct: 0,
    planned_hours: 8,
    actual_hours: 0,
  })

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Task[]
        if (Array.isArray(parsed) && parsed.length) {
          setLocalTasks(parsed)
          return
        }
      } catch {
        window.localStorage.removeItem(storageKey)
      }
    }
    if (tasks.length) setLocalTasks(tasks)
  }, [storageKey, tasks])

  useEffect(() => {
    if (localTasks.length) window.localStorage.setItem(storageKey, JSON.stringify(localTasks))
  }, [localTasks, storageKey])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return localTasks.filter((task) => {
      const text = `${task.wbs} ${task.title} ${task.assignee ?? ''}`.toLowerCase()
      return (!term || text.includes(term)) && (!phase || task.phase === phase) && (!status || task.status === status)
    }).sort((a, b) => a.sort_order - b.sort_order)
  }, [localTasks, phase, search, status])

  const summary = useMemo(() => ({
    total: filtered.length,
    milestones: filtered.filter((task) => task.type === 'milestone').length,
    completed: filtered.filter((task) => task.status === 'concluido').length,
    progress: filtered.length ? Math.round(filtered.reduce((sum, task) => sum + task.progress_pct, 0) / filtered.length) : 0,
  }), [filtered])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = `local-task-${Date.now()}`
    setLocalTasks((current) => [...current, {
      id,
      tenant_id: 'local',
      project_id: projectId ?? 'local',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      parent_id: undefined,
      wbs: draft.wbs ?? `${current.length + 1}.0`,
      title: draft.title ?? '',
      phase: draft.phase ?? '1',
      type: draft.type ?? 'task',
      start_date: draft.start_date,
      end_date: draft.end_date,
      duration_days: getDuration(draft.start_date, draft.end_date),
      assignee: draft.assignee,
      status: draft.status ?? 'pendente',
      progress_pct: Number(draft.progress_pct ?? 0),
      planned_hours: Number(draft.planned_hours ?? 0),
      actual_hours: Number(draft.actual_hours ?? 0),
      dependencies: [],
      notes: draft.notes,
      sort_order: current.length + 100,
    }])
    setDraft((current) => ({ ...current, title: '', assignee: '', progress_pct: 0 }))
  }

  function updateTask(taskId: string, input: Partial<Task>) {
    setLocalTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...input, updated_at: new Date().toISOString() } : task))
  }

  function removeTask(taskId: string) {
    setLocalTasks((current) => current.filter((task) => task.id !== taskId))
  }

  async function exportExcel() {
    const XLSX = await loadXlsx()
    const rows = localTasks
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(taskToExcelRow)
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!cols'] = [
      { wch: 10 }, { wch: 34 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 26 },
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cronograma Macro')
    XLSX.writeFile(workbook, `cronograma-macro-${projectId ?? 'projeto'}.xlsx`)
  }

  async function exportExcelTemplate() {
    const XLSX = await loadXlsx()
    const rows = [
      {
        WBS: '1.1',
        Tarefa: 'Nome da atividade',
        Fase: '1',
        Tipo: 'task',
        Início: '2026-06-01',
        Fim: '2026-06-05',
        Duração: 5,
        Responsável: 'Nome',
        Status: 'pendente',
        Progresso: 0,
        'Horas Planejadas': 40,
        'Horas Reais': 0,
        Dependências: '',
        Notas: 'Observações',
      },
    ]
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo')
    XLSX.writeFile(workbook, 'modelo-cronograma-macro.xlsx')
  }

  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const XLSX = await loadXlsx()
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const imported = rows.map((row, index) => excelRowToTask(row, index, projectId ?? 'local', XLSX))
      mergeImportedTasks(imported, `Importadas ${imported.length} tarefas do Excel.`)
    } catch (error) {
      setImportMessage(`Falha ao importar Excel: ${(error as Error).message}`)
    }
  }

  function resetSchedule() {
    window.localStorage.removeItem(storageKey)
    setLocalTasks(tasks)
    setImportMessage('Cronograma restaurado para os dados do projeto/demo.')
  }

  function exportProjectXml() {
    downloadText(`cronograma-ms-project-${projectId ?? 'projeto'}.xml`, buildProjectXml(localTasks), 'application/xml;charset=utf-8')
  }

  async function importProjectXml(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const imported = parseProjectXml(text, projectId ?? 'local')
      mergeImportedTasks(imported, `Importadas ${imported.length} tarefas do MS Project XML.`)
    } catch (error) {
      setImportMessage(`Falha ao importar MS Project XML: ${(error as Error).message}`)
    }
  }

  function mergeImportedTasks(imported: Task[], message: string) {
    if (!imported.length) {
      setImportMessage('Nenhuma tarefa encontrada no arquivo.')
      return
    }
    setLocalTasks((current) => {
      const existingKeys = new Set(current.map((task) => `${task.wbs}|${task.title}`.toLowerCase()))
      const next = imported.filter((task) => !existingKeys.has(`${task.wbs}|${task.title}`.toLowerCase()))
      return [...current, ...next.map((task, index) => ({ ...task, sort_order: current.length + index + 100 }))]
    })
    setImportMessage(message)
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="badge badge-blue">Fase 1 - Prepare</span>
          <h1 className="mt-3 text-2xl font-bold text-text-primary">Cronograma Macro</h1>
          <p className="mt-1 text-sm text-text-secondary">Tarefas, marcos executivos e visualização Gantt do roadmap Activate.</p>
        </div>
        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
          <button className="btn-secondary btn-sm" type="button" onClick={() => excelInputRef.current?.click()}><FileInput className="h-3.5 w-3.5" /> Importar Excel</button>
          <button className="btn-secondary btn-sm" type="button" onClick={exportExcelTemplate}><FileSpreadsheet className="h-3.5 w-3.5" /> Modelo</button>
          <button className="btn-secondary btn-sm" type="button" onClick={exportExcel}><Download className="h-3.5 w-3.5" /> Excel</button>
          <button className="btn-secondary btn-sm" type="button" onClick={() => projectInputRef.current?.click()}><FileInput className="h-3.5 w-3.5" /> Importar Project</button>
          <button className="btn-secondary btn-sm" type="button" onClick={exportProjectXml}><Download className="h-3.5 w-3.5" /> Project XML</button>
          <button className="btn-secondary btn-sm" type="button" onClick={resetSchedule}><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
          <button className={`section-tab ${view === 'table' ? 'active' : ''}`} type="button" onClick={() => setView('table')}>Cronograma</button>
          <button className={`section-tab ${view === 'timeline' ? 'active' : ''}`} type="button" onClick={() => setView('timeline')}>Timeline</button>
          <input ref={excelInputRef} className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={importExcel} />
          <input ref={projectInputRef} className="hidden" type="file" accept=".xml,.mpp" onChange={importProjectXml} />
        </div>
      </header>

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Kpi label="Tarefas" value={summary.total} />
        <Kpi label="Marcos" value={summary.milestones} />
        <Kpi label="Concluídas" value={summary.completed} />
        <Kpi label="Progresso" value={`${summary.progress}%`} />
      </section>

      <section className="card2 mb-5 grid gap-3 lg:grid-cols-[1fr_160px_180px_auto] lg:items-end">
        <label><span className="label">Busca</span><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <Select label="Fase" value={phase} options={['', ...phases]} onChange={(value) => setPhase(value as PhaseNumber | '')} />
        <Select label="Status" value={status} options={['', ...statuses]} onChange={(value) => setStatus(value as TaskStatus | '')} />
        <span className="badge badge-blue self-end">{filtered.length} tarefas</span>
      </section>

      {importMessage ? (
        <div className="mb-5 rounded-[8px] border border-brand-600 bg-[#0f1229] px-4 py-3 text-sm text-text-secondary">
          {importMessage}
        </div>
      ) : null}

      {view === 'table' ? (
        <>
          <form className="card mb-5" onSubmit={submit}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">Novo item macro</h2>
              <button className="btn-primary" type="submit"><Plus className="h-4 w-4" /> Adicionar</button>
            </div>
            <div className="grid gap-4 md:grid-cols-6">
              <Input label="WBS" value={draft.wbs ?? ''} onChange={(wbs) => setDraft((d) => ({ ...d, wbs }))} />
              <label className="md:col-span-2"><span className="label">Tarefa / Marco</span><input className="input" required value={draft.title ?? ''} onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))} /></label>
              <Select label="Fase" value={draft.phase ?? '1'} options={phases} onChange={(value) => setDraft((d) => ({ ...d, phase: value as PhaseNumber }))} />
              <Select label="Tipo" value={draft.type ?? 'task'} options={['phase', 'task', 'milestone']} onChange={(value) => setDraft((d) => ({ ...d, type: value as TaskType }))} />
              <Select label="Status" value={draft.status ?? 'pendente'} options={statuses} onChange={(value) => setDraft((d) => ({ ...d, status: value as TaskStatus }))} />
              <Input label="Início" type="date" value={draft.start_date ?? ''} onChange={(start_date) => setDraft((d) => ({ ...d, start_date }))} />
              <Input label="Fim" type="date" value={draft.end_date ?? ''} onChange={(end_date) => setDraft((d) => ({ ...d, end_date }))} />
              <Input label="Responsável" value={draft.assignee ?? ''} onChange={(assignee) => setDraft((d) => ({ ...d, assignee }))} />
              <Input label="Progresso %" type="number" value={String(draft.progress_pct ?? 0)} onChange={(progress_pct) => setDraft((d) => ({ ...d, progress_pct: Number(progress_pct) }))} />
            </div>
          </form>

          <section className="card overflow-hidden p-0">
            {isLoading ? <div className="p-6 text-text-secondary">Carregando cronograma...</div> : (
              <table className="data-table min-w-[1040px]">
                <thead><tr><th>WBS</th><th>Tarefa / Marco</th><th>Fase</th><th>Início</th><th>Fim</th><th>Duração</th><th>Responsável</th><th>Status</th><th>Progresso</th><th>Ações</th></tr></thead>
                <tbody>
                  {filtered.map((task) => (
                    <tr key={task.id} className={task.type === 'phase' ? 'selected' : undefined}>
                      <td><span className="wbs-badge">{task.wbs}</span></td>
                      <td className={`text-text-primary ${task.type === 'phase' ? 'font-bold' : ''}`}>
                        <span className="inline-flex items-center gap-2">{task.type === 'milestone' ? <Diamond className="h-3.5 w-3.5 text-warn" /> : null}{task.title}</span>
                      </td>
                      <td><span className="badge" style={{ background: PHASE_COLORS[task.phase ?? '1'], color: '#fff' }}>F{task.phase}</span></td>
                      <td>{formatDate(task.start_date)}</td>
                      <td>{formatDate(task.end_date)}</td>
                      <td>{getDuration(task.start_date, task.end_date)}d</td>
                      <td>{task.assignee ?? '-'}</td>
                      <td><StatusSelect value={task.status} onChange={(next) => updateTask(task.id, { status: next })} /></td>
                      <td><input className="input w-20" type="number" value={task.progress_pct} onChange={(event) => updateTask(task.id, { progress_pct: Number(event.target.value) })} /></td>
                      <td><button className="btn-danger btn-sm" type="button" onClick={() => removeTask(task.id)}><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : (
        <section className="space-y-5">
          <div className="card2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Timeline Gantt</h2>
              <p className="text-sm text-text-secondary">Visão executiva por fases, marcos e progresso planejado.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Dia', 'Semana', 'Mês', 'Trimestre'].map((item) => <span key={item} className="badge badge-gray">{item}</span>)}
            </div>
          </div>
          <GanttChart tasks={filtered} title="Cronograma Macro" />
          <div className="card2 flex flex-wrap gap-3 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-2"><span className="h-3 w-px bg-danger" /> Hoje</span>
            <span className="inline-flex items-center gap-2"><Diamond className="h-3.5 w-3.5 text-warn" /> Marco</span>
            <span className="inline-flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-text-muted" /> Fim de semana/feriados: referência visual planejada</span>
          </div>
        </section>
      )}

      <div className="mt-5 flex justify-end">
        <button className="btn-green" type="button"><Save className="h-4 w-4" /> Marcar como revisado</button>
      </div>
    </div>
  )
}

function getDuration(start?: string, end?: string) {
  if (!start || !end) return 0
  return Math.max(1, Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000) + 1)
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="card2"><span className="text-sm text-text-secondary">{label}</span><strong className="mt-2 block text-2xl text-text-primary">{value}</strong></div>
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return <label><span className="label">{label}</span><input className="input" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span className="label">{label}</span><select className="input" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option || 'all'} value={option}>{option || 'Todos'}</option>)}</select></label>
}

function StatusSelect({ value, onChange }: { value: TaskStatus; onChange: (value: TaskStatus) => void }) {
  return <select className="badge badge-blue border-0" value={value} onChange={(event) => onChange(event.target.value as TaskStatus)}>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select>
}

function taskToExcelRow(task: Task) {
  return {
    WBS: task.wbs,
    Tarefa: task.title,
    Fase: task.phase ?? '',
    Tipo: task.type,
    Início: task.start_date ?? '',
    Fim: task.end_date ?? '',
    Duração: getDuration(task.start_date, task.end_date),
    Responsável: task.assignee ?? '',
    Status: task.status,
    Progresso: task.progress_pct,
    'Horas Planejadas': task.planned_hours,
    'Horas Reais': task.actual_hours,
    Dependências: task.dependencies.join(', '),
    Notas: task.notes ?? '',
  }
}

type XlsxModule = typeof import('xlsx')

async function loadXlsx(): Promise<XlsxModule> {
  return await import('xlsx')
}

function excelRowToTask(row: Record<string, unknown>, index: number, projectId: string, xlsx?: XlsxModule): Task {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const value = row[key]
      if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
    return ''
  }
  const start = normalizeDate(get('Início', 'Inicio', 'Start', 'Start Date'), xlsx)
  const end = normalizeDate(get('Fim', 'End', 'Finish', 'Finish Date'), xlsx) || start
  const phase = normalizePhase(get('Fase', 'Phase'))
  const type = normalizeType(get('Tipo', 'Type'))
  const status = normalizeStatus(get('Status'))
  const wbs = String(get('WBS', 'wbs') || `${index + 1}.0`)
  const title = String(get('Tarefa', 'Task Name', 'Nome', 'Name', 'Atividade') || `Tarefa ${index + 1}`)

  return {
    id: `import-excel-${Date.now()}-${index}`,
    tenant_id: 'local',
    project_id: projectId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    parent_id: undefined,
    wbs,
    title,
    phase,
    type,
    start_date: start,
    end_date: end,
    duration_days: getDuration(start, end),
    assignee: String(get('Responsável', 'Responsavel', 'Resource Names', 'Assigned To') || ''),
    status,
    progress_pct: normalizeNumber(get('Progresso', '% Concluído', '% Complete', 'Percent Complete'), 0),
    planned_hours: normalizeNumber(get('Horas Planejadas', 'Planned Hours', 'Work'), 0),
    actual_hours: normalizeNumber(get('Horas Reais', 'Actual Hours', 'Actual Work'), 0),
    dependencies: String(get('Dependências', 'Dependencias', 'Predecessors') || '').split(',').map((item) => item.trim()).filter(Boolean),
    notes: String(get('Notas', 'Notes') || ''),
    sort_order: index + 1,
  }
}

function buildProjectXml(tasks: Task[]) {
  const sorted = tasks.slice().sort((a, b) => a.sort_order - b.sort_order)
  const rows = sorted.map((task, index) => {
    const uid = index + 1
    const outlineLevel = Math.max(1, task.wbs.split('.').filter(Boolean).length)
    const percent = Math.max(0, Math.min(100, Math.round(task.progress_pct ?? 0)))
    return `    <Task>
      <UID>${uid}</UID>
      <ID>${uid}</ID>
      <Name>${xmlEscape(task.title)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <CreateDate>${toProjectDate(task.created_at)}</CreateDate>
      <WBS>${xmlEscape(task.wbs)}</WBS>
      <OutlineNumber>${xmlEscape(task.wbs)}</OutlineNumber>
      <OutlineLevel>${outlineLevel}</OutlineLevel>
      <Start>${toProjectDate(task.start_date)}</Start>
      <Finish>${toProjectDate(task.end_date)}</Finish>
      <Duration>PT${Math.max(1, getDuration(task.start_date, task.end_date) * 8)}H0M0S</Duration>
      <Milestone>${task.type === 'milestone' ? 1 : 0}</Milestone>
      <PercentComplete>${percent}</PercentComplete>
      <Notes>${xmlEscape(task.notes ?? '')}</Notes>
    </Task>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Cronograma Macro SAP Activate</Name>
  <Title>Cronograma Macro SAP Activate</Title>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${toProjectDate(sorted[0]?.start_date)}</StartDate>
  <FinishDate>${toProjectDate(sorted[sorted.length - 1]?.end_date)}</FinishDate>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <Tasks>
${rows}
  </Tasks>
</Project>
`
}

function parseProjectXml(text: string, projectId: string): Task[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('XML inválido.')
  const taskNodes = Array.from(doc.getElementsByTagNameNS('*', 'Task'))
  return taskNodes.map((node, index) => {
    const title = getXmlText(node, 'Name') || `Tarefa ${index + 1}`
    const wbs = getXmlText(node, 'WBS') || getXmlText(node, 'OutlineNumber') || `${index + 1}.0`
    const start = normalizeProjectDate(getXmlText(node, 'Start'))
    const end = normalizeProjectDate(getXmlText(node, 'Finish')) || start
    const type: TaskType = getXmlText(node, 'Milestone') === '1' ? 'milestone' : 'task'
    return {
      id: `import-project-${Date.now()}-${index}`,
      tenant_id: 'local',
      project_id: projectId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      parent_id: undefined,
      wbs,
      title,
      phase: normalizePhase(wbs.split('.')[0]),
      type,
      start_date: start,
      end_date: end,
      duration_days: getDuration(start, end),
      assignee: '',
      status: normalizeStatus('pendente'),
      progress_pct: normalizeNumber(getXmlText(node, 'PercentComplete'), 0),
      planned_hours: getDuration(start, end) * 8,
      actual_hours: 0,
      dependencies: [],
      notes: getXmlText(node, 'Notes'),
      sort_order: index + 1,
    }
  }).filter((task) => task.title && task.title !== '0')
}

function getXmlText(node: Element, tagName: string) {
  return node.getElementsByTagNameNS('*', tagName)[0]?.textContent?.trim() ?? ''
}

function normalizeDate(value: unknown, xlsx?: XlsxModule) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number' && xlsx) {
    const parsed = xlsx.SSF.parse_date_code(value)
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }
  const text = String(value).trim()
  if (!text) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function normalizeProjectDate(value: string) {
  return normalizeDate(value)
}

function normalizePhase(value: unknown): PhaseNumber {
  const text = String(value || '').replace(/\D/g, '')
  return phases.includes(text as PhaseNumber) ? text as PhaseNumber : '1'
}

function normalizeType(value: unknown): TaskType {
  const text = String(value || '').toLowerCase()
  if (text.includes('milestone') || text.includes('marco')) return 'milestone'
  if (text.includes('phase') || text.includes('fase')) return 'phase'
  return 'task'
}

function normalizeStatus(value: unknown): TaskStatus {
  const text = String(value || '').toLowerCase().replace(/\s+/g, '_')
  if (statuses.includes(text as TaskStatus)) return text as TaskStatus
  if (text.includes('complete') || text.includes('concl')) return 'concluido'
  if (text.includes('progress') || text.includes('andamento')) return 'em_andamento'
  if (text.includes('late') || text.includes('atras')) return 'atrasado'
  if (text.includes('cancel')) return 'cancelado'
  return 'pendente'
}

function normalizeNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(String(value || '').replace('%', '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function toProjectDate(value?: string) {
  const date = normalizeDate(value) || new Date().toISOString().slice(0, 10)
  return `${date}T09:00:00`
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
