import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, FileDown, Paperclip, Plus, Sparkles } from 'lucide-react'
import { filterBPDItems, useBPD } from '@/hooks/useBPD'
import { SAP_MODULES, type BPDItem, type BPDStatus } from '@/types'

const subTabs = ['Identificação', 'Equipe', 'Documento', 'Processo', 'Solução', 'Critérios']
const statuses: BPDStatus[] = ['pendente', 'em_andamento', 'concluido']

export default function BPDPage() {
  const { projectId } = useParams()
  const { items, stats, isLoading, createBPD, updateBPD, deleteBPD } = useBPD(projectId)
  const [search, setSearch] = useState('')
  const [module, setModule] = useState('')
  const [status, setStatus] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({})

  const visibleItems = useMemo(() => filterBPDItems(items, search, module, status), [items, module, search, status])

  function createDefault() {
    createBPD.mutate({
      project_id: projectId!,
      bpd_id: `BPD-${String(items.length + 1).padStart(3, '0')}`,
      module: 'FI',
      process_name: 'Novo processo',
      version: '1.0',
      priority: 'media',
      item_type: 'obrigatorio',
      status: 'pendente',
      gap_type: 'standard',
      complexity: 'media',
      effort_hours: 0,
      client_signed: false,
      sort_order: items.length + 1,
    })
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="badge badge-amber">Fase 2 - Explore</span>
          <h1 className="mt-3 text-2xl font-bold text-text-primary">SOW / BPD</h1>
          <p className="mt-1 text-sm text-text-secondary">Processos, solução proposta, critérios e documentação do escopo.</p>
        </div>
        <button className="btn-primary" type="button" onClick={createDefault}>
          <Plus className="h-4 w-4" />
          Novo processo
        </button>
      </header>

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Kpi label="Total processos" value={stats.total} />
        <Kpi label="Concluídos" value={stats.concluidos} />
        <Kpi label="Em andamento" value={stats.em_andamento} />
        <Kpi label="Pendentes" value={stats.pendentes} />
      </section>

      <section className="card2 mb-5 grid gap-3 md:grid-cols-[1fr_160px_160px_auto_auto] md:items-end">
        <label>
          <span className="label">Busca</span>
          <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          <span className="label">Módulo</span>
          <select className="input" value={module} onChange={(event) => setModule(event.target.value)}>
            <option value="">Todos</option>
            {SAP_MODULES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Status</span>
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button className="btn-secondary" type="button" onClick={() => setExpanded(Object.fromEntries(visibleItems.map((item) => [item.id, true])))}>
          Expandir
        </button>
        <button className="btn-secondary" type="button" onClick={() => setExpanded({})}>
          Recolher
        </button>
      </section>

      <section className="space-y-3">
        {isLoading ? <div className="card text-text-secondary">Carregando BPDs...</div> : null}
        {visibleItems.map((item) => {
          const open = expanded[item.id] ?? false
          const activeTab = activeTabs[item.id] ?? subTabs[0]
          return (
            <article key={item.id} className="card p-0">
              <button className="flex w-full items-center gap-3 px-5 py-4 text-left" type="button" onClick={() => setExpanded((current) => ({ ...current, [item.id]: !open }))}>
                {open ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-bold text-text-primary">{item.bpd_id} - {item.process_name}</h2>
                  <p className="text-xs text-text-secondary">{item.consultant ?? 'Consultor não definido'} - v{item.version}</p>
                </div>
                <span className="badge badge-blue">{item.module}</span>
                <span className={`badge ${item.status === 'concluido' ? 'badge-green' : item.status === 'em_andamento' ? 'badge-amber' : 'badge-gray'}`}>{item.status}</span>
              </button>

              {open ? (
                <div className="border-t border-surface-border p-5">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {subTabs.map((tab) => (
                      <button key={tab} className={`section-tab ${activeTab === tab ? 'active' : ''}`} type="button" onClick={() => setActiveTabs((current) => ({ ...current, [item.id]: tab }))}>
                        {tab}
                      </button>
                    ))}
                  </div>
                  <BPDSubTab item={item} activeTab={activeTab} onUpdate={(input) => updateBPD.mutate({ id: item.id, input })} />
                  <div className="mt-5 flex flex-wrap justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-secondary btn-sm" type="button"><Paperclip className="h-3.5 w-3.5" /> Anexar</button>
                      <button className="btn-amber btn-sm" type="button"><Sparkles className="h-3.5 w-3.5" /> Gerar com IA</button>
                      <button className="btn-secondary btn-sm" type="button"><FileDown className="h-3.5 w-3.5" /> Exportar .docx</button>
                    </div>
                    <button className="btn-danger btn-sm" type="button" onClick={() => deleteBPD.mutate(item.id)}>Remover</button>
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </section>
    </div>
  )
}

function BPDSubTab({ item, activeTab, onUpdate }: { item: BPDItem; activeTab: string; onUpdate: (input: Partial<BPDItem>) => void }) {
  if (activeTab === 'Identificação') {
    return <Grid><Field label="ID" value={item.bpd_id} onBlur={(v) => onUpdate({ bpd_id: v })} /><Field label="Módulo" value={item.module} onBlur={(v) => onUpdate({ module: v })} /><Field label="Nome" value={item.process_name} onBlur={(v) => onUpdate({ process_name: v })} /><Field label="Versão" value={item.version} onBlur={(v) => onUpdate({ version: v })} /></Grid>
  }
  if (activeTab === 'Equipe') {
    return <Grid><Field label="Consultor" value={item.consultant ?? ''} onBlur={(v) => onUpdate({ consultant: v })} /><Field label="Key-user" value={item.key_user ?? ''} onBlur={(v) => onUpdate({ key_user: v })} /><Field label="Revisor" value={item.reviewer ?? ''} onBlur={(v) => onUpdate({ reviewer: v })} /><Field label="Aprovador" value={item.approver ?? ''} onBlur={(v) => onUpdate({ approver: v })} /></Grid>
  }
  if (activeTab === 'Documento') {
    return <Grid><Text label="Referências legais" value={item.legal_refs ?? ''} onBlur={(v) => onUpdate({ legal_refs: v })} /></Grid>
  }
  if (activeTab === 'Processo') {
    return <Grid><Text label="AS-IS" value={item.as_is ?? ''} onBlur={(v) => onUpdate({ as_is: v })} /><Text label="TO-BE" value={item.to_be ?? ''} onBlur={(v) => onUpdate({ to_be: v })} /><Text label="Gatilhos" value={item.triggers ?? ''} onBlur={(v) => onUpdate({ triggers: v })} /></Grid>
  }
  if (activeTab === 'Solução') {
    return <Grid><Text label="Solução proposta" value={item.solution ?? ''} onBlur={(v) => onUpdate({ solution: v })} /><Field label="GAP" value={item.gap_type} onBlur={(v) => onUpdate({ gap_type: v as BPDItem['gap_type'] })} /><Field label="Complexidade" value={item.complexity} onBlur={(v) => onUpdate({ complexity: v as BPDItem['complexity'] })} /><Field label="Esforço" value={String(item.effort_hours)} onBlur={(v) => onUpdate({ effort_hours: Number(v) })} /></Grid>
  }
  return <Grid><Text label="Critérios de aceite" value={item.acceptance ?? ''} onBlur={(v) => onUpdate({ acceptance: v })} /><Text label="Limitações / exclusões" value={item.exclusions ?? ''} onBlur={(v) => onUpdate({ exclusions: v })} /></Grid>
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>
}

function Field({ label, value, onBlur }: { label: string; value: string; onBlur: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  return <label><span className="label">{label}</span><input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => onBlur(draft)} /></label>
}

function Text({ label, value, onBlur }: { label: string; value: string; onBlur: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  return <label className="md:col-span-2"><span className="label">{label}</span><textarea className="input" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => onBlur(draft)} /></label>
}

function Kpi({ label, value }: { label: string; value: number }) {
  return <div className="card2"><span className="text-sm text-text-secondary">{label}</span><strong className="mt-2 block text-2xl text-text-primary">{value}</strong></div>
}
