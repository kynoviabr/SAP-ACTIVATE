import { Fragment, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Edit3, Plus, ShieldAlert, Target, Trash2 } from 'lucide-react'
import { calculateRiskScore, useRisks, type RiskFilters } from '@/hooks/useRisks'
import { getSeverity } from '@/lib/utils'
import type { CreateRiskInput, Risk, RiskCategory, RiskStatus } from '@/types'

const statuses: RiskStatus[] = ['identificado', 'em_mitigacao', 'mitigado', 'ocorrido']
const categories: RiskCategory[] = ['tecnico', 'prazo', 'recursos', 'escopo', 'externo', 'qualidade']

export default function RisksPage() {
  const { projectId } = useParams()
  const [filters, setFilters] = useState<RiskFilters>({})
  const [editing, setEditing] = useState<Risk | null>(null)
  const [draft, setDraft] = useState<Partial<CreateRiskInput>>({ category: 'tecnico', impact: 3, probability: 3, status: 'identificado' })
  const { risks, filteredRisks, stats, createRisk, updateRisk, deleteRisk, isLoading } = useRisks(projectId, filters)
  const score = calculateRiskScore(draft)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!projectId) return
    if (editing) {
      updateRisk.mutate({ id: editing.id, input: draft }, { onSuccess: reset })
      return
    }
    createRisk.mutate({
      project_id: projectId,
      description: draft.description ?? '',
      category: draft.category ?? 'tecnico',
      impact: Number(draft.impact ?? 1),
      probability: Number(draft.probability ?? 1),
      status: draft.status ?? 'identificado',
      assignee: draft.assignee,
      mitigation: draft.mitigation,
      contingency: draft.contingency,
      phase: draft.phase,
    }, { onSuccess: reset })
  }

  function reset() {
    setEditing(null)
    setDraft({ category: 'tecnico', impact: 3, probability: 3, status: 'identificado' })
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between"><div><span className="badge badge-blue">Módulo transversal</span><h1 className="mt-3 text-2xl font-bold text-text-primary">Plano de Riscos</h1></div><button className="btn-primary" type="button" onClick={reset}><Plus className="h-4 w-4" /> Novo risco</button></header>
      <section className="mb-5 grid gap-4 md:grid-cols-4"><Kpi icon={<Target className="h-4 w-4" />} label="Total" value={stats.total} /><Kpi icon={<ShieldAlert className="h-4 w-4" />} label="Baixo" value={stats.baixo} /><Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Médio" value={stats.medio} /><Kpi icon={<ShieldAlert className="h-4 w-4" />} label="Alto/Crítico" value={stats.alto + stats.critico} /></section>
      <section className="mb-5 grid gap-5 xl:grid-cols-[360px_1fr]"><RiskMatrix risks={risks} /><div className="card2 grid gap-3 md:grid-cols-4 md:items-end"><label className="md:col-span-2"><span className="label">Busca</span><input className="input" value={filters.search ?? ''} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} /></label><Select label="Status" value={filters.status ?? ''} options={['', ...statuses]} onChange={(status) => setFilters((f) => ({ ...f, status: status as RiskStatus | '' }))} /><Select label="Categoria" value={filters.category ?? ''} options={['', ...categories]} onChange={(category) => setFilters((f) => ({ ...f, category: category as RiskCategory | '' }))} /></div></section>
      <form className="card mb-5" onSubmit={submit}><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-text-primary">{editing ? 'Editar risco' : 'Novo risco'}</h2><span className={`rounded-[8px] px-3 py-2 text-sm font-bold ${scoreClass(score)}`}>Score {score}</span></div><div className="grid gap-4 md:grid-cols-4"><label className="md:col-span-2"><span className="label">Descrição</span><input className="input" required value={draft.description ?? ''} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} /></label><Select label="Categoria" value={draft.category ?? 'tecnico'} options={categories} onChange={(category) => setDraft((d) => ({ ...d, category: category as RiskCategory }))} /><Select label="Status" value={draft.status ?? 'identificado'} options={statuses} onChange={(status) => setDraft((d) => ({ ...d, status: status as RiskStatus }))} /><Select label="Impacto" value={String(draft.impact ?? 3)} options={['1','2','3','4','5']} onChange={(impact) => setDraft((d) => ({ ...d, impact: Number(impact) }))} /><Select label="Probabilidade" value={String(draft.probability ?? 3)} options={['1','2','3','4','5']} onChange={(probability) => setDraft((d) => ({ ...d, probability: Number(probability) }))} /><label><span className="label">Responsável</span><input className="input" value={draft.assignee ?? ''} onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))} /></label><div /><label className="md:col-span-2"><span className="label">Mitigação</span><textarea className="input" value={draft.mitigation ?? ''} onChange={(e) => setDraft((d) => ({ ...d, mitigation: e.target.value }))} /></label><label className="md:col-span-2"><span className="label">Contingência</span><textarea className="input" value={draft.contingency ?? ''} onChange={(e) => setDraft((d) => ({ ...d, contingency: e.target.value }))} /></label></div><div className="mt-4 flex justify-end"><button className="btn-primary" type="submit">{editing ? 'Salvar' : 'Criar'}</button></div></form>
      <section className="card overflow-hidden p-0">{isLoading ? <div className="p-6 text-text-secondary">Carregando...</div> : <table className="data-table min-w-[1120px]"><thead><tr><th>ID</th><th>Risco</th><th>Categoria</th><th>Impacto</th><th>Prob.</th><th>Score</th><th>Responsável</th><th>Status</th><th>Mitigação</th><th>Contingência</th><th>Ações</th></tr></thead><tbody>{filteredRisks.map((risk) => <tr key={risk.id}><td>{risk.code}</td><td className="text-text-primary">{risk.description}</td><td>{risk.category}</td><td>{risk.impact}</td><td>{risk.probability}</td><td><span className={`rounded-[8px] px-2 py-1 text-xs font-bold ${scoreClass(risk.exposure)}`}>{risk.exposure}</span></td><td>{risk.assignee ?? '-'}</td><td><StatusSelect value={risk.status} onChange={(status) => updateRisk.mutate({ id: risk.id, input: { status } })} /></td><td>{risk.mitigation ?? '-'}</td><td>{risk.contingency ?? '-'}</td><td><div className="flex gap-2"><button className="btn-secondary btn-sm" type="button" onClick={() => { setEditing(risk); setDraft(risk) }}><Edit3 className="h-3.5 w-3.5" /></button><button className="btn-danger btn-sm" type="button" onClick={() => deleteRisk.mutate(risk.id)}><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>)}</tbody></table>}</section>
    </div>
  )
}

function RiskMatrix({ risks }: { risks: Risk[] }) {
  const counts = useMemo(() => risks.reduce<Record<string, number>>((acc, risk) => { const key = `${risk.impact}-${risk.probability}`; acc[key] = (acc[key] ?? 0) + 1; return acc }, {}), [risks])
  return <section className="card2"><h2 className="text-lg font-bold text-text-primary">Matriz 5x5</h2><div className="mt-4 grid grid-cols-[42px_repeat(5,minmax(0,1fr))] gap-1 text-center text-xs"><div />{[1,2,3,4,5].map((p) => <div key={p} className="text-text-muted">P{p}</div>)}{[5,4,3,2,1].map((i) => <Fragment key={i}><div className="flex items-center justify-center text-text-muted">I{i}</div>{[1,2,3,4,5].map((p) => { const s = i * p; return <div key={`${i}-${p}`} className={`flex aspect-square items-center justify-center rounded-[8px] font-bold ${scoreClass(s)}`}>{counts[`${i}-${p}`] || s}</div> })}</Fragment>)}</div></section>
}

function scoreClass(score: number) {
  if (score >= 20) return 'bg-[#450a0a] text-[#f87171] border border-[#f87171]'
  if (score >= 10) return 'bg-danger text-white'
  if (score >= 4) return 'bg-warn text-[#1a1f3a]'
  return 'bg-ok text-white'
}

function Kpi({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="card2"><div className="flex justify-between"><span className="text-sm text-text-secondary">{label}</span><span className="text-brand-600">{icon}</span></div><strong className="mt-3 block text-2xl text-text-primary">{value}</strong></div>
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span className="label">{label}</span><select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option || 'all'} value={option}>{option || 'Todos'}</option>)}</select></label>
}

function StatusSelect({ value, onChange }: { value: RiskStatus; onChange: (value: RiskStatus) => void }) {
  return <select className="badge badge-blue border-0" value={value} onChange={(e) => onChange(e.target.value as RiskStatus)}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
}
