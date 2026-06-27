import { cloneElement, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Copy,
  Diamond,
  Download,
  FileInput,
  Globe2,
  Image as ImageIcon,
  PlusCircle,
  RefreshCcw,
  Save,
  Scissors,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { useMacroSchedule } from '@/hooks/useMacroSchedule'
import {
  MACRO_PHASE_COLORS,
  MACRO_PHASES,
  MACRO_ZOOM_LABELS,
  MACRO_ZOOMS,
  calcLineSPI,
  clampNumber,
  countBusinessDays,
  createEmptyMacroTask,
  formatSPI,
  isMilestoneLike,
  normalizeMacroTasksForSave,
  parsePredecessors,
  recalcParentAggregates,
  renumberWbs,
  seedMacroScheduleTasks,
  sortMacroTasks,
} from '@/lib/macroSchedule'
import type { CreateMacroScheduleTaskInput, MacroSchedulePhase, MacroScheduleTask, MacroScheduleZoom } from '@/types'

type MacroRow = MacroScheduleTask | (CreateMacroScheduleTaskInput & { id: string; tenant_id?: string; created_at?: string; updated_at?: string })
type Lang = 'pt' | 'en' | 'es' | 'zh'
type MenuName = 'ai' | 'import' | 'holidays' | null

const zoomLabels = MACRO_ZOOM_LABELS

export default function MacroSchedulePage() {
  const { projectId = 'local' } = useParams()
  const excelInputRef = useRef<HTMLInputElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const autosaveRef = useRef<number | undefined>(undefined)
  const {
    tasks,
    holidays,
    holidayDates,
    isLoading,
    isSaving,
    lastSyncedAt,
    replaceTasks,
    replaceWithTemplate,
    addNationalHolidays,
    detectAndAddHolidays,
    clearHolidays,
    forceSync,
    clearCacheAndSync,
  } = useMacroSchedule(projectId)

  const [rows, setRows] = useState<MacroRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'schedule' | 'timeline'>('schedule')
  const [zoom, setZoom] = useState<MacroScheduleZoom>('month')
  const [menu, setMenu] = useState<MenuName>(null)
  const [lang, setLang] = useState<Lang>('pt')
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (dirty) return
    setRows(sortMacroTasks(tasks) as MacroRow[])
  }, [dirty, tasks])

  useEffect(() => {
    if (!dirty) return
    window.clearTimeout(autosaveRef.current)
    autosaveRef.current = window.setTimeout(() => {
      replaceTasks(rows)
        .then(() => {
          setDirty(false)
          setMessage('Cronograma sincronizado.')
        })
        .catch((error) => setMessage(`Falha ao salvar: ${(error as Error).message}`))
    }, 900)
    return () => window.clearTimeout(autosaveRef.current)
  }, [dirty, replaceTasks, rows])

  const normalizedRows = useMemo(() => recalcParentAggregates(renumberWbs(rows)), [rows])
  const scheduleStats = useMemo(() => ({
    total: normalizedRows.length,
    milestones: normalizedRows.filter((row) => row.is_milestone).length,
    avgReal: normalizedRows.length ? Math.round(normalizedRows.reduce((sum, row) => sum + row.real_pct, 0) / normalizedRows.length) : 0,
    avgPlanned: normalizedRows.length ? Math.round(normalizedRows.reduce((sum, row) => sum + row.planned_pct, 0) / normalizedRows.length) : 0,
  }), [normalizedRows])

  function applyRows(updater: (current: MacroRow[]) => MacroRow[], save = true) {
    setRows((current) => recalcParentAggregates(renumberWbs(updater(current))) as MacroRow[])
    if (save) setDirty(true)
  }

  function updateRow(rowId: string, input: Partial<MacroRow>) {
    applyRows((current) => current.map((row) => {
      if (row.id !== rowId) return row
      const next = { ...row, ...input }
      if (input.is_milestone && next.start_date) next.end_date = next.start_date
      if (next.is_milestone && input.start_date) next.end_date = input.start_date
      return next
    }))
  }

  function addTask() {
    const last = normalizedRows[normalizedRows.length - 1]
    const task = createEmptyMacroTask(projectId, normalizedRows.length + 1, last?.phase ?? 'Prepare')
    applyRows((current) => [...current, withLocalId(task)])
  }

  function insertBelow(index: number) {
    const current = normalizedRows[index]
    const task = withLocalId({
      ...createEmptyMacroTask(projectId, index + 2, current?.phase ?? 'Prepare'),
      level: current?.level ?? 2,
    })
    applyRows((items) => [...items.slice(0, index + 1), task, ...items.slice(index + 1)])
  }

  function duplicateRow(index: number) {
    const current = normalizedRows[index]
    if (!current) return
    applyRows((items) => [...items.slice(0, index + 1), { ...current, id: localId(), title: `${current.title} (cópia)` }, ...items.slice(index + 1)])
  }

  function removeRow(index: number) {
    const removeIds = new Set(getBlock(normalizedRows, index).map((row) => row.id))
    applyRows((items) => items.filter((row) => !removeIds.has(row.id)))
    setSelected((items) => new Set(Array.from(items).filter((id) => !removeIds.has(id))))
  }

  function indentRow(index: number) {
    if (index <= 0) return
    applyRows((items) => items.map((row, rowIndex) => rowIndex === index ? { ...row, level: Math.min(8, row.level + 1) } : row))
  }

  function outdentRow(index: number) {
    applyRows((items) => items.map((row, rowIndex) => rowIndex === index ? { ...row, level: Math.max(1, row.level - 1) } : row))
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const block = getBlock(normalizedRows, index)
    if (!block.length) return
    const blockIds = new Set(block.map((row) => row.id))
    const rest = normalizedRows.filter((row) => !blockIds.has(row.id))
    const anchorIndex = rest.findIndex((row) => row.sort_order > block[0].sort_order)
    const insertAt = direction < 0
      ? Math.max(0, index - 1)
      : Math.min(rest.length, anchorIndex < 0 ? rest.length : anchorIndex + 1)
    const next = [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)]
    applyRows(() => next)
  }

  function toggleSelected(rowId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  async function deleteSelected() {
    if (!selected.size) return
    if (!window.confirm(`Remover ${selected.size} tarefa(s) selecionada(s)?`)) return
    applyRows((items) => items.filter((row) => !selected.has(row.id)))
    setSelected(new Set())
  }

  async function clearAll() {
    if (!window.confirm('Remover todas as tarefas do cronograma?')) return
    setRows([])
    setSelected(new Set())
    setDirty(false)
    await replaceTasks([])
    setMessage('Cronograma limpo.')
  }

  async function applyTemplate() {
    if (!window.confirm('Aplicar template substitui o cronograma atual. Continuar?')) return
    const seeded = seedMacroScheduleTasks(projectId).map(withLocalId)
    setRows(seeded)
    setDirty(false)
    await replaceWithTemplate()
    setMessage('Template aplicado.')
  }

  function validateNames() {
    applyRows((items) => items.map((row) => row.responsible?.trim() ? row : { ...row, responsible: row.squad || row.responsible }))
    setMessage('Nomes validados: responsáveis vazios foram preenchidos pela squad.')
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')
    const worksheet = XLSX.utils.json_to_sheet(normalizedRows.map((row, index) => taskToExcelRow(row, index, holidayDates)))
    worksheet['!cols'] = [
      { wch: 5 }, { wch: 8 }, { wch: 42 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 8 }, { wch: 12 },
      { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 10 },
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cronograma Macro')
    XLSX.writeFile(workbook, `cronograma-macro-${projectId}.xlsx`)
  }

  async function importExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!window.confirm('A carga substituirá o cronograma atual. Continuar?')) return
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const imported = data.map((row, index) => excelRowToTask(row, index, projectId, XLSX)).map(withLocalId)
      setRows(imported)
      setDirty(false)
      await replaceTasks(imported)
      setMessage(`Importadas ${imported.length} tarefa(s) do Excel.`)
    } catch (error) {
      setMessage(`Falha na importação: ${(error as Error).message}`)
    }
  }

  function exportProjectXml() {
    downloadText(`cronograma-macro-${projectId}.xml`, buildProjectXml(normalizedRows), 'application/xml;charset=utf-8')
  }

  async function importProjectXml(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!window.confirm('A carga substituirá o cronograma atual. Continuar?')) return
    try {
      const imported = parseProjectXml(await file.text(), projectId).map(withLocalId)
      setRows(imported)
      setDirty(false)
      await replaceTasks(imported)
      setMessage(`Importadas ${imported.length} tarefa(s) do MS Project XML.`)
    } catch (error) {
      setMessage(`Falha na importação XML: ${(error as Error).message}`)
    }
  }

  async function addHolidays2026And2027() {
    await addNationalHolidays([2026, 2027])
    setMessage('Feriados nacionais 2026/2027 adicionados.')
  }

  async function addDetectedHolidays() {
    await detectAndAddHolidays()
    setMessage('Feriados do período do cronograma adicionados.')
  }

  async function clearAllHolidays() {
    await clearHolidays()
    setMessage('Feriados removidos.')
  }

  async function recalcWithHolidays() {
    applyRows((items) => items.map((row) => {
      if (row.is_milestone || !row.start_date || !row.end_date) return row
      const days = countBusinessDays(row.start_date, row.end_date, holidayDates)
      return { ...row, hours: Math.max(row.hours || 0, days * 8) }
    }))
    setMessage('Horas recalculadas considerando dias úteis e feriados.')
  }

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6">
      <section className="card min-h-[calc(100vh-140px)] overflow-hidden p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#0f1229] text-brand-600">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-text-primary">Cronograma Macro</h1>
                <p className="text-sm text-text-secondary">Cronograma estilo Gantt com tarefas por fase, responsáveis, datas e dependências.</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <button className="btn-secondary btn-sm" type="button" title="Traduzir os rótulos fixos; o conteúdo digitado é preservado." onClick={() => setLang(nextLang(lang))}>
                <Globe2 className="h-3.5 w-3.5" /> {lang.toUpperCase()}
              </button>
              <button className="btn-secondary btn-sm" type="button" title={syncTitle(lastSyncedAt)} onClick={forceSync}>
                <RefreshCcw className="h-3.5 w-3.5" /> {lastSyncedAt ? `Última sincronização: ${lastSyncedAt.toLocaleTimeString('pt-BR')}` : 'Sincronizar'}
              </button>
              <button className="btn-secondary btn-sm" type="button" onClick={clearCacheAndSync}>Limpar cache</button>
            </div>
          </div>
          <button className="btn-secondary btn-sm" type="button" onClick={() => window.history.back()}>
            <X className="h-4 w-4" /> Fechar
          </button>
        </header>

        <div className="border-b border-surface-border px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary btn-sm" type="button" onClick={addTask}><PlusCircle className="h-4 w-4" /> Adicionar tarefa</button>
              <button
                className="btn-secondary btn-sm"
                type="button"
                title="Recalcula agregações pai/filho (% Real, % Planejado, SPI) e re-renderiza a tabela. Use depois de várias edições inline para sincronizar os valores."
                onClick={() => applyRows((items) => items)}
              >
                <RefreshCcw className="h-4 w-4" /> Atualizar
              </button>
              <DropdownButton active={menu === 'ai'} onClick={() => setMenu(menu === 'ai' ? null : 'ai')} icon={<Bot className="h-4 w-4" />} label="Recursos IA" />
              <DropdownButton active={menu === 'import'} onClick={() => setMenu(menu === 'import' ? null : 'import')} icon={<FileInput className="h-4 w-4" />} label="Import/Export de Cronograma" />
              <DropdownButton active={menu === 'holidays'} onClick={() => setMenu(menu === 'holidays' ? null : 'holidays')} icon={<CalendarDays className="h-4 w-4" />} label="Feriados" />
              <button className="btn-danger btn-sm" type="button" onClick={deleteSelected} disabled={!selected.size}><Trash2 className="h-4 w-4" /> Selecionados</button>
              <button className="btn-danger btn-sm" type="button" onClick={clearAll}><Trash2 className="h-4 w-4" /> Limpar tudo</button>
            </div>
            <div className="flex items-center gap-3 text-sm text-text-secondary">
              {isSaving || dirty ? <span className="badge badge-blue">Salvando...</span> : <span className="badge badge-green">Sincronizado</span>}
              <span className="font-semibold text-text-primary">{normalizedRows.length} tarefa(s)</span>
            </div>
          </div>

          {menu ? (
            <div className="mt-3 flex flex-wrap gap-2 rounded-[8px] border border-surface-border bg-[#0f1229]/55 p-3">
              {menu === 'ai' ? (
                <>
                  <MenuAction icon={<FileInput className="h-4 w-4" />} label="Aplicar template" text="Aplica um cronograma-modelo — SUBSTITUI o cronograma atual." onClick={applyTemplate} />
                  <MenuAction icon={<ImageIcon className="h-4 w-4" />} label="Importar de imagem (IA)" text="Planejado: extrair tarefas, fases e datas de imagem." onClick={() => setMessage('Importação por imagem IA está preparada no menu, pendente de endpoint de visão.')} />
                  <MenuAction icon={<Scissors className="h-4 w-4" />} label="IA: do Detalhado" text="Planejado: consolidar Cronograma Detalhado em macro." onClick={() => setMessage('Geração a partir do cronograma detalhado está pendente da fonte detalhada.')} />
                  <MenuAction icon={<Sparkles className="h-4 w-4" />} label="IA: preencher responsáveis" text="Não sobrescreve valores preenchidos." onClick={() => setMessage('Sugestão por IA depende do cadastro de recursos do Setup.')} />
                  <MenuAction icon={<Wrench className="h-4 w-4" />} label="Validar nomes" text="Sem IA: preenche responsável vazio com a squad." onClick={validateNames} />
                </>
              ) : null}
              {menu === 'import' ? (
                <>
                  <MenuAction icon={<Download className="h-4 w-4" />} label="Baixar Excel" text="Exporta todas as colunas do cronograma." onClick={exportExcel} />
                  <MenuAction icon={<FileInput className="h-4 w-4" />} label="Carga de novo cronograma" text="Excel ou CSV; substitui o cronograma atual." onClick={() => excelInputRef.current?.click()} />
                  <MenuAction icon={<Download className="h-4 w-4" />} label="Baixar MS Project XML" text="Exporta XML compatível com MS Project." onClick={exportProjectXml} />
                  <MenuAction icon={<FileInput className="h-4 w-4" />} label="Carga MS Project XML" text="XML substitui o cronograma atual." onClick={() => projectInputRef.current?.click()} />
                  <input ref={excelInputRef} className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={importExcel} />
                  <input ref={projectInputRef} className="hidden" type="file" accept=".xml" onChange={importProjectXml} />
                </>
              ) : null}
              {menu === 'holidays' ? (
                <>
                  <MenuAction icon={<CalendarDays className="h-4 w-4" />} label="Adicionar feriados 2026/2027" text="Inclui feriados nacionais brasileiros fixos e móveis." onClick={addHolidays2026And2027} />
                  <MenuAction icon={<CalendarDays className="h-4 w-4" />} label="Detectar período e adicionar" text="Usa menor início e maior fim do cronograma." onClick={addDetectedHolidays} />
                  <MenuAction icon={<RefreshCcw className="h-4 w-4" />} label="Recalcular com feriados" text="Atualiza horas por dias úteis." onClick={recalcWithHolidays} />
                  <MenuAction icon={<Trash2 className="h-4 w-4" />} label="Remover todos os feriados" text={`${holidays.length} feriado(s) cadastrado(s).`} onClick={clearAllHolidays} />
                </>
              ) : null}
            </div>
          ) : null}

          {message ? <div className="mt-3 rounded-[8px] border border-brand-600/40 bg-brand-600/10 px-3 py-2 text-sm text-text-secondary">{message}</div> : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button className={`section-tab ${view === 'schedule' ? 'active' : ''}`} type="button" onClick={() => setView('schedule')}>Cronograma</button>
            <button className={`section-tab ${view === 'timeline' ? 'active' : ''}`} type="button" onClick={() => setView('timeline')}>Timeline</button>
          </div>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="p-10 text-center text-text-secondary">Carregando cronograma...</div>
          ) : view === 'schedule' ? (
            <ScheduleTable
              rows={normalizedRows}
              selected={selected}
              holidays={holidayDates}
              onSelect={toggleSelected}
              onChange={updateRow}
              onIndent={indentRow}
              onOutdent={outdentRow}
              onMove={moveBlock}
              onInsert={insertBelow}
              onDuplicate={duplicateRow}
              onRemove={removeRow}
            />
          ) : (
            <Timeline rows={normalizedRows} holidays={holidayDates} zoom={zoom} onZoom={setZoom} />
          )}
        </div>

        <footer className="flex justify-end border-t border-surface-border px-5 py-4">
          <button className="btn-green" type="button" onClick={() => setMessage('Cronograma marcado como revisado.')}>
            <Save className="h-4 w-4" /> Marcar como revisado
          </button>
        </footer>
      </section>
    </div>
  )
}

function ScheduleTable({ rows, selected, holidays, onSelect, onChange, onIndent, onOutdent, onMove, onInsert, onDuplicate, onRemove }: {
  rows: MacroRow[]
  selected: Set<string>
  holidays: string[]
  onSelect: (id: string) => void
  onChange: (id: string, input: Partial<MacroRow>) => void
  onIndent: (index: number) => void
  onOutdent: (index: number) => void
  onMove: (index: number, direction: -1 | 1) => void
  onInsert: (index: number) => void
  onDuplicate: (index: number) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="overflow-auto rounded-[8px] border border-surface-border">
      <table className="data-table min-w-[1780px]">
        <thead>
          <tr>
            <th className="w-10">☐</th>
            <th>#</th>
            <th>WBS</th>
            <th>Tarefa</th>
            <th>Fase</th>
            <th>Squad</th>
            <th>Responsável</th>
            <th>% Aloc</th>
            <th>Início</th>
            <th>Fim</th>
            <th>Dias</th>
            <th>% Real</th>
            <th>% Plan.</th>
            <th>SPI</th>
            <th>Pred.</th>
            <th>Horas</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const milestone = isMilestoneLike(row)
            const hasChildren = Boolean(rows[index + 1] && rows[index + 1].level > row.level)
            return (
              <tr key={row.id} className={hasChildren ? 'selected' : undefined}>
                <td>
                  <input title="Marca esta linha para mover/apagar em massa" type="checkbox" checked={selected.has(row.id)} onChange={() => onSelect(row.id)} />
                </td>
                <td>{index + 1}</td>
                <td><span className="wbs-badge">{row.wbs}</span></td>
                <td style={{ paddingLeft: `${Math.max(0, row.level - 1) * 14}px` }}>
                  <div className="flex items-center gap-2">
                    {milestone ? <Diamond className="h-3.5 w-3.5 fill-warn text-warn" /> : null}
                    <input className="input min-w-[280px]" value={row.title} onChange={(event) => onChange(row.id, { title: event.target.value })} />
                  </div>
                </td>
                <td>
                  <select className="input min-w-[110px]" value={row.phase} onChange={(event) => onChange(row.id, { phase: event.target.value as MacroSchedulePhase })}>
                    {MACRO_PHASES.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
                  </select>
                </td>
                <td><input className="input min-w-[120px]" value={row.squad ?? ''} onChange={(event) => onChange(row.id, { squad: event.target.value })} /></td>
                <td><input className="input min-w-[150px]" value={row.responsible ?? ''} onChange={(event) => onChange(row.id, { responsible: event.target.value })} /></td>
                <td><NumberCell value={row.allocation_pct} onChange={(allocation_pct) => onChange(row.id, { allocation_pct })} /></td>
                <td><input className="input min-w-[138px]" type="date" value={row.start_date ?? ''} onChange={(event) => onChange(row.id, { start_date: event.target.value })} /></td>
                <td>
                  <input
                    className="input min-w-[138px]"
                    type="date"
                    title={milestone ? 'Marcos têm fim = início (zero duração)' : undefined}
                    value={row.end_date ?? ''}
                    onChange={(event) => onChange(row.id, { end_date: event.target.value })}
                  />
                </td>
                <td>{countBusinessDays(row.start_date, row.end_date, holidays, milestone)}</td>
                <td><NumberCell value={row.real_pct} onChange={(real_pct) => onChange(row.id, { real_pct })} /></td>
                <td><NumberCell value={row.planned_pct} onChange={(planned_pct) => onChange(row.id, { planned_pct })} /></td>
                <td><span className={spiClass(calcLineSPI(row.real_pct, row.planned_pct))}>{formatSPI(row.real_pct, row.planned_pct)}</span></td>
                <td><input className="input min-w-[100px]" placeholder="ex: 5, 12" value={row.predecessors.join(', ')} onChange={(event) => onChange(row.id, { predecessors: parsePredecessors(event.target.value) })} /></td>
                <td><NumberCell max={99999} value={row.hours} onChange={(hours) => onChange(row.id, { hours })} /></td>
                <td>
                  <div className="flex gap-1">
                    <IconAction label="Desindentar" onClick={() => onOutdent(index)}><ArrowLeft /></IconAction>
                    <IconAction label="Indentar" onClick={() => onIndent(index)}><ArrowRight /></IconAction>
                    <IconAction label="Mover para cima" onClick={() => onMove(index, -1)}><ArrowUp /></IconAction>
                    <IconAction label="Mover para baixo" onClick={() => onMove(index, 1)}><ArrowDown /></IconAction>
                    <IconAction label="Inserir nova linha" onClick={() => onInsert(index)}><PlusCircle /></IconAction>
                    <IconAction label="Marco/Milestone" onClick={() => onChange(row.id, { is_milestone: !row.is_milestone, end_date: row.start_date ?? row.end_date })}><Diamond /></IconAction>
                    <IconAction label="Duplicar tarefa" onClick={() => onDuplicate(index)}><Copy /></IconAction>
                    <IconAction label="Remover tarefa" danger onClick={() => onRemove(index)}><X /></IconAction>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Timeline({ rows, holidays, zoom, onZoom }: { rows: MacroRow[]; holidays: string[]; zoom: MacroScheduleZoom; onZoom: (zoom: MacroScheduleZoom) => void }) {
  const datedRows = rows.filter((row) => row.start_date && row.end_date)
  const range = getTimelineRange(datedRows)
  const units = getTimelineUnits(range.start, range.end, zoom)
  const totalMs = Math.max(1, range.end.getTime() - range.start.getTime())
  const todayLeft = `${clampNumber((Date.now() - range.start.getTime()) / totalMs * 100, 0, 100)}%`

  return (
    <section className="space-y-4">
      <div className="card2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Timeline Gantt</h2>
          <p className="text-sm text-text-secondary">Linha vermelha tracejada = hoje · áreas hachuradas = feriados · cinza claro = fim de semana</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MACRO_ZOOMS.map((item) => (
            <button key={item} className={`section-tab ${zoom === item ? 'active' : ''}`} type="button" onClick={() => onZoom(item)}>
              {zoomLabels[item]}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-auto rounded-[8px] border border-surface-border bg-surface-card">
        <div className="min-w-[1180px]">
          <div className="grid grid-cols-[300px_1fr] border-b border-surface-border text-xs text-text-secondary">
            <div className="sticky left-0 z-10 bg-surface-card p-3 font-semibold text-text-primary">WBS + tarefa</div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${units.length}, minmax(${unitWidth(zoom)}px, 1fr))` }}>
              {units.map((unit) => <div key={unit.key} className="border-l border-surface-border p-3 text-center">{unit.label}</div>)}
            </div>
          </div>
          <div className="relative">
            <div className="absolute bottom-0 top-0 z-10 border-l border-dashed border-danger" style={{ left: `calc(300px + (${todayLeft}))` }} />
            {datedRows.map((row) => {
              const milestone = isMilestoneLike(row)
              const left = `${clampNumber((new Date(`${row.start_date}T12:00:00`).getTime() - range.start.getTime()) / totalMs * 100, 0, 100)}%`
              const width = `${milestone ? 0 : clampNumber((new Date(`${row.end_date}T12:00:00`).getTime() - new Date(`${row.start_date}T12:00:00`).getTime()) / totalMs * 100, 0.4, 100)}%`
              return (
                <div key={row.id} className="grid grid-cols-[300px_1fr] border-b border-surface-border/60 text-xs">
                  <div className="sticky left-0 z-10 truncate bg-surface-card p-3 text-text-secondary">
                    <span className="wbs-badge mr-2">{row.wbs}</span>{row.title}
                  </div>
                  <div className="relative h-10 bg-[#0f1229]">
                    <TimelineBackground range={range} holidays={holidays} />
                    {milestone ? (
                      <div className="absolute top-3 h-4 w-4 rotate-45 rounded-[3px] bg-warn" style={{ left }} title={row.title} />
                    ) : (
                      <div
                        className="absolute top-2 h-6 rounded-[6px]"
                        style={{ left, width, background: barColor(row) }}
                        title={`${row.wbs} ${row.title}`}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

function TimelineBackground({ range, holidays }: { range: { start: Date; end: Date }; holidays: string[] }) {
  const overlays = []
  const totalMs = Math.max(1, range.end.getTime() - range.start.getTime())
  const current = new Date(range.start)
  while (current <= range.end) {
    const iso = current.toISOString().slice(0, 10)
    const day = current.getDay()
    const left = `${clampNumber((current.getTime() - range.start.getTime()) / totalMs * 100, 0, 100)}%`
    const width = `${clampNumber(86_400_000 / totalMs * 100, 0.2, 100)}%`
    if (day === 0 || day === 6) overlays.push(<span key={`w-${iso}`} className="absolute bottom-0 top-0 bg-white/5" style={{ left, width }} />)
    if (holidays.includes(iso)) overlays.push(<span key={`h-${iso}`} className="absolute bottom-0 top-0 opacity-40" style={{ left, width, backgroundImage: 'repeating-linear-gradient(45deg, rgba(245,158,11,0.35) 0 4px, transparent 4px 8px)' }} />)
    current.setDate(current.getDate() + 1)
  }
  return <>{overlays}</>
}

function NumberCell({ value, onChange, max = 100 }: { value: number; max?: number; onChange: (value: number) => void }) {
  return <input className="input w-20" type="number" min={0} max={max} value={value} onChange={(event) => onChange(clampNumber(event.target.value, 0, max))} />
}

function DropdownButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={`btn-secondary btn-sm ${active ? 'border-brand-600' : ''}`} type="button" onClick={onClick}>{icon}{label}<ChevronDown className="h-3.5 w-3.5" /></button>
}

function MenuAction({ icon, label, text, onClick }: { icon: React.ReactNode; label: string; text: string; onClick: () => void }) {
  return (
    <button className="btn-secondary btn-sm max-w-[290px] justify-start text-left" type="button" title={text} onClick={onClick}>
      {icon}
      <span className="flex flex-col">
        <span>{label}</span>
        <span className="text-[10px] font-normal text-text-muted">{text}</span>
      </span>
    </button>
  )
}

function IconAction({ children, label, danger, onClick }: { children: React.ReactElement; label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button className={`inline-flex h-8 w-8 items-center justify-center rounded-[8px] border ${danger ? 'border-danger/40 text-danger' : 'border-surface-border text-text-secondary'} bg-[#0f1229] hover:border-brand-600 hover:text-text-primary`} type="button" title={label} onClick={onClick}>
      {cloneElement(children, { className: 'h-3.5 w-3.5' })}
    </button>
  )
}

function taskToExcelRow(row: MacroRow, index: number, holidays: string[]) {
  return {
    '#': index + 1,
    WBS: row.wbs,
    Tarefa: row.title,
    Fase: row.phase,
    Squad: row.squad ?? '',
    Responsável: row.responsible ?? '',
    '% Aloc': row.allocation_pct,
    Início: row.start_date ?? '',
    Fim: row.end_date ?? '',
    Dias: countBusinessDays(row.start_date, row.end_date, holidays, row.is_milestone),
    '% Real': row.real_pct,
    '% Plan.': row.planned_pct,
    SPI: formatSPI(row.real_pct, row.planned_pct),
    'Pred.': row.predecessors.join(', '),
    Horas: row.hours,
    Marco: row.is_milestone ? 'Sim' : 'Não',
    Nivel: row.level,
  }
}

function excelRowToTask(row: Record<string, unknown>, index: number, projectId: string, xlsx: typeof import('xlsx')): CreateMacroScheduleTaskInput {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const value = row[key]
      if (value !== undefined && value !== null && String(value).trim() !== '') return value
    }
    return ''
  }
  const start = normalizeDate(get('Início', 'Inicio', 'Start'), xlsx)
  const end = normalizeDate(get('Fim', 'Finish', 'End'), xlsx)
  const milestone = String(get('Marco', 'Milestone')).toLowerCase().startsWith('s') || start === end
  return {
    project_id: projectId,
    wbs: String(get('WBS') || `1.${index + 1}`),
    title: String(get('Tarefa', 'Name', 'Task Name') || `Tarefa ${index + 1}`),
    phase: normalizeMacroPhase(get('Fase', 'Phase')),
    squad: String(get('Squad', 'Módulo', 'Modulo') || ''),
    responsible: String(get('Responsável', 'Responsavel', 'Resource Names') || ''),
    allocation_pct: clampNumber(get('% Aloc', 'Allocation'), 0, 100),
    start_date: start || undefined,
    end_date: milestone ? start || end || undefined : end || undefined,
    is_milestone: milestone,
    planned_pct: clampNumber(get('% Plan.', '% Plan', 'Planned'), 0, 100),
    real_pct: clampNumber(get('% Real', 'Percent Complete', 'Progresso'), 0, 100),
    predecessors: parsePredecessors(String(get('Pred.', 'Predecessors') || '')),
    hours: Math.max(0, Number(get('Horas', 'Work') || 0)),
    level: Math.max(1, Number(get('Nivel', 'Level') || String(get('WBS') || '').split('.').length || 2)),
    sort_order: index + 1,
    notes: '',
  }
}

function buildProjectXml(rows: MacroRow[]) {
  const tasks = normalizeMacroTasksForSave('project', rows)
  return `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Cronograma Macro</Name>
  <ScheduleFromStart>1</ScheduleFromStart>
  <Tasks>
${tasks.map((task, index) => `    <Task>
      <UID>${index + 1}</UID>
      <ID>${index + 1}</ID>
      <Name>${xmlEscape(task.title)}</Name>
      <WBS>${xmlEscape(task.wbs)}</WBS>
      <OutlineNumber>${xmlEscape(task.wbs)}</OutlineNumber>
      <OutlineLevel>${task.level}</OutlineLevel>
      <Start>${toProjectDate(task.start_date)}</Start>
      <Finish>${toProjectDate(task.end_date)}</Finish>
      <Milestone>${task.is_milestone ? 1 : 0}</Milestone>
      <PercentComplete>${task.real_pct}</PercentComplete>
      <Notes>${xmlEscape(task.notes ?? '')}</Notes>
    </Task>`).join('\n')}
  </Tasks>
</Project>`
}

function parseProjectXml(text: string, projectId: string): CreateMacroScheduleTaskInput[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('XML inválido.')
  return Array.from(doc.getElementsByTagNameNS('*', 'Task')).map((node, index) => {
    const wbs = getXmlText(node, 'WBS') || getXmlText(node, 'OutlineNumber') || `1.${index + 1}`
    const start = normalizeDate(getXmlText(node, 'Start'))
    const end = normalizeDate(getXmlText(node, 'Finish')) || start
    const milestone = getXmlText(node, 'Milestone') === '1' || start === end
    return {
      project_id: projectId,
      wbs,
      title: getXmlText(node, 'Name') || `Tarefa ${index + 1}`,
      phase: normalizeMacroPhase(wbs.split('.')[0]),
      squad: '',
      responsible: '',
      allocation_pct: 100,
      start_date: start || undefined,
      end_date: end || undefined,
      is_milestone: milestone,
      planned_pct: 0,
      real_pct: clampNumber(getXmlText(node, 'PercentComplete'), 0, 100),
      predecessors: [],
      hours: 0,
      level: Math.max(1, Number(getXmlText(node, 'OutlineLevel')) || wbs.split('.').length),
      sort_order: index + 1,
      notes: getXmlText(node, 'Notes'),
    }
  }).filter((task) => task.title && task.title !== '0')
}

function getBlock(rows: MacroRow[], index: number) {
  const first = rows[index]
  if (!first) return []
  const block = [first]
  for (let i = index + 1; i < rows.length; i += 1) {
    if (rows[i].level <= first.level) break
    block.push(rows[i])
  }
  return block
}

function getTimelineRange(rows: MacroRow[]) {
  const starts = rows.map((row) => new Date(`${row.start_date}T12:00:00`).getTime()).filter(Number.isFinite)
  const ends = rows.map((row) => new Date(`${row.end_date}T12:00:00`).getTime()).filter(Number.isFinite)
  return {
    start: new Date(Math.min(...starts, Date.now())),
    end: new Date(Math.max(...ends, Date.now() + 86_400_000)),
  }
}

function getTimelineUnits(start: Date, end: Date, zoom: MacroScheduleZoom) {
  const units: Array<{ key: string; label: string }> = []
  const current = new Date(start)
  current.setHours(12, 0, 0, 0)
  if (zoom === 'month' || zoom === 'quarter') current.setDate(1)
  while (current <= end) {
    const key = current.toISOString().slice(0, 10)
    units.push({ key, label: unitLabel(current, zoom) })
    if (zoom === 'day') current.setDate(current.getDate() + 1)
    if (zoom === 'week') current.setDate(current.getDate() + 7)
    if (zoom === 'month') current.setMonth(current.getMonth() + 1)
    if (zoom === 'quarter') current.setMonth(current.getMonth() + 3)
  }
  return units
}

function unitLabel(date: Date, zoom: MacroScheduleZoom) {
  if (zoom === 'day') return String(date.getDate())
  if (zoom === 'week') return `S${Math.ceil(date.getDate() / 7)}`
  if (zoom === 'quarter') return `${date.getFullYear()}·T${Math.floor(date.getMonth() / 3) + 1}`
  return date.toLocaleDateString('pt-BR', { month: 'short' })
}

function unitWidth(zoom: MacroScheduleZoom) {
  return zoom === 'day' ? 34 : zoom === 'week' ? 74 : zoom === 'month' ? 110 : 150
}

function barColor(row: MacroRow) {
  if (row.real_pct >= 100) return '#10b981'
  if (row.real_pct > 0) return MACRO_PHASE_COLORS[row.phase]
  return `${MACRO_PHASE_COLORS[row.phase]}99`
}

function spiClass(spi: number | null) {
  if (spi === null) return 'text-text-muted'
  if (spi >= 1) return 'font-semibold text-success'
  if (spi > 0) return 'font-semibold text-warn'
  return 'font-semibold text-danger'
}

function normalizeMacroPhase(value: unknown): MacroSchedulePhase {
  const text = String(value || '').toLowerCase()
  const found = MACRO_PHASES.find((phase) => phase.toLowerCase() === text || phase.toLowerCase().startsWith(text))
  if (found) return found
  if (text === '1') return 'Prepare'
  if (text === '2') return 'Explore'
  if (text === '3') return 'Realize'
  if (text === '4') return 'Deploy'
  if (text === '5') return 'Run'
  return 'Prepare'
}

function normalizeDate(value: unknown, xlsx?: typeof import('xlsx')) {
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

function getXmlText(node: Element, tagName: string) {
  return node.getElementsByTagNameNS('*', tagName)[0]?.textContent?.trim() ?? ''
}

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function toProjectDate(value?: string) {
  return `${normalizeDate(value) || new Date().toISOString().slice(0, 10)}T09:00:00`
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

function localId() {
  return `local-macro-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function withLocalId<T extends CreateMacroScheduleTaskInput>(task: T): T & { id: string } {
  return { ...task, id: localId() }
}

function syncTitle(lastSyncedAt: Date | null) {
  return lastSyncedAt
    ? `Última sincronização: ${lastSyncedAt.toLocaleString('pt-BR')} — Clique para forçar atualização agora. Intervalo automático: 30s.`
    : 'Clique para forçar atualização agora. Intervalo automático: 30s.'
}

function nextLang(lang: Lang): Lang {
  if (lang === 'pt') return 'en'
  if (lang === 'en') return 'es'
  if (lang === 'es') return 'zh'
  return 'pt'
}
