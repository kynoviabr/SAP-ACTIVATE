import { useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Clock3, Edit3, Plus, Trash2 } from 'lucide-react'
import { useIssues, type IssueFilters } from '@/hooks/useIssues'
import { useAuthStore } from '@/store'
import type { CreateIssueInput, Issue, IssuePriority, IssueStatus, IssueType } from '@/types'

const statuses: IssueStatus[] = ['aberta', 'em_andamento', 'resolvida', 'atrasada', 'cancelada']
const priorities: IssuePriority[] = ['baixa', 'media', 'alta', 'critica']
const types: IssueType[] = ['tecnica', 'processo', 'gestao', 'cliente', 'escopo']

export default function IssuesPage() {
  const { projectId } = useParams()
  const tenant = useAuthStore((s) => s.tenant)
  const [filters, setFilters] = useState<IssueFilters>({})
  const [editing, setEditing] = useState<Issue | null>(null)
  const [draft, setDraft] = useState<Partial<CreateIssueInput>>({ issue_type: 'tecnica', priority: 'media', status: 'aberta' })
  const { filteredIssues, stats, isLoading, createIssue, updateIssue, deleteIssue } = useIssues(projectId, filters)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!projectId || !tenant) return
    if (editing) {
      updateIssue.mutate({ id: editing.id, input: draft }, { onSuccess: reset })
      return
    }
    createIssue.mutate({
      project_id: projectId,
      description: draft.description ?? '',
      issue_type: draft.issue_type ?? 'tecnica',
      priority: draft.priority ?? 'media',
      status: draft.status ?? 'aberta',
      assignee: draft.assignee,
      opened_by: draft.opened_by,
      due_date: draft.due_date,
      action_plan: draft.action_plan,
      phase: draft.phase,
    }, { onSuccess: reset })
  }

  function reset() {
    setEditing(null)
    setDraft({ issue_type: 'tecnica', priority: 'media', status: 'aberta' })
  }

  function edit(issue: Issue) {
    setEditing(issue)
    setDraft(issue)
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Header title="Pendências" count={filteredIssues.length} onNew={reset} />
      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Kpi icon={<AlertCircle className="h-4 w-4" />} label="Abertas" value={stats.abertas} />
        <Kpi icon={<Clock3 className="h-4 w-4" />} label="Em andamento" value={stats.em_andamento} />
        <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Resolvidas" value={stats.resolvidas} />
        <Kpi icon={<AlertCircle className="h-4 w-4" />} label="Atrasadas" value={stats.atrasadas} />
      </section>

      <section className="card2 mb-5 grid gap-3 md:grid-cols-[1fr_160px_160px_160px] md:items-end">
        <label><span className="label">Busca</span><input className="input" value={filters.search ?? ''} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} /></label>
        <Select label="Status" value={filters.status ?? ''} options={['', ...statuses]} onChange={(status) => setFilters((f) => ({ ...f, status: status as IssueStatus | '' }))} />
        <Select label="Prioridade" value={filters.priority ?? ''} options={['', ...priorities]} onChange={(priority) => setFilters((f) => ({ ...f, priority: priority as IssuePriority | '' }))} />
        <Select label="Tipo" value={filters.type ?? ''} options={['', ...types]} onChange={(type) => setFilters((f) => ({ ...f, type: type as IssueType | '' }))} />
      </section>

      <form className="card mb-5" onSubmit={submit}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">{editing ? 'Editar pendência' : 'Nova pendência'}</h2>
          {editing ? <button className="btn-secondary btn-sm" type="button" onClick={reset}>Cancelar</button> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <label className="md:col-span-2"><span className="label">Descrição</span><input className="input" required value={draft.description ?? ''} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} /></label>
          <Select label="Tipo" value={draft.issue_type ?? 'tecnica'} options={types} onChange={(issue_type) => setDraft((d) => ({ ...d, issue_type: issue_type as IssueType }))} />
          <Select label="Prioridade" value={draft.priority ?? 'media'} options={priorities} onChange={(priority) => setDraft((d) => ({ ...d, priority: priority as IssuePriority }))} />
          <label><span className="label">Responsável</span><input className="input" value={draft.assignee ?? ''} onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))} /></label>
          <label><span className="label">Aberto por</span><input className="input" value={draft.opened_by ?? ''} onChange={(e) => setDraft((d) => ({ ...d, opened_by: e.target.value }))} /></label>
          <label><span className="label">Prazo</span><input className="input" type="date" value={draft.due_date ?? ''} onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))} /></label>
          <Select label="Status" value={draft.status ?? 'aberta'} options={statuses} onChange={(status) => setDraft((d) => ({ ...d, status: status as IssueStatus }))} />
          <label className="md:col-span-4"><span className="label">Plano de ação</span><textarea className="input" value={draft.action_plan ?? ''} onChange={(e) => setDraft((d) => ({ ...d, action_plan: e.target.value }))} /></label>
        </div>
        <div className="mt-4 flex justify-end"><button className="btn-primary" type="submit">{editing ? 'Salvar' : 'Criar'}</button></div>
      </form>

      <section className="card overflow-hidden p-0">
        {isLoading ? <div className="p-6 text-text-secondary">Carregando...</div> : (
          <table className="data-table min-w-[980px]">
            <thead><tr><th>ID</th><th>Descrição</th><th>Tipo</th><th>Prioridade</th><th>Responsável</th><th>Prazo</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {filteredIssues.map((issue) => (
                <tr key={issue.id}>
                  <td>{issue.code}</td><td className="text-text-primary">{issue.description}</td><td>{issue.issue_type}</td>
                  <td><span className={`badge ${issue.priority === 'critica' ? 'badge-critical' : issue.priority === 'alta' ? 'badge-red' : issue.priority === 'media' ? 'badge-amber' : 'badge-green'}`}>{issue.priority}</span></td>
                  <td>{issue.assignee ?? '-'}</td><td>{issue.due_date ?? '-'}</td>
                  <td><StatusSelect value={issue.status} onChange={(status) => updateIssue.mutate({ id: issue.id, input: { status } })} /></td>
                  <td><div className="flex gap-2"><button className="btn-secondary btn-sm" type="button" onClick={() => edit(issue)}><Edit3 className="h-3.5 w-3.5" /></button><button className="btn-danger btn-sm" type="button" onClick={() => deleteIssue.mutate(issue.id)}><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function Header({ title, count, onNew }: { title: string; count: number; onNew: () => void }) {
  return <header className="mb-6 flex items-center justify-between"><div><span className="badge badge-blue">Módulo transversal</span><h1 className="mt-3 text-2xl font-bold text-text-primary">{title}</h1></div><div className="flex gap-2"><span className="badge badge-blue">{count} registros</span><button className="btn-primary" type="button" onClick={onNew}><Plus className="h-4 w-4" /> Novo</button></div></header>
}

function Kpi({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="card2"><div className="flex justify-between"><span className="text-sm text-text-secondary">{label}</span><span className="text-brand-600">{icon}</span></div><strong className="mt-3 block text-2xl text-text-primary">{value}</strong></div>
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span className="label">{label}</span><select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option || 'all'} value={option}>{option || 'Todos'}</option>)}</select></label>
}

function StatusSelect({ value, onChange }: { value: IssueStatus; onChange: (value: IssueStatus) => void }) {
  return <select className="badge badge-blue border-0" value={value} onChange={(e) => onChange(e.target.value as IssueStatus)}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
}
