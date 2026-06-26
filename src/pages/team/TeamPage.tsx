import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, Users } from 'lucide-react'
import { useTeam } from '@/hooks/useTransversal'
import type { ProjectMemberInput, UserRole } from '@/types'

export default function TeamPage() {
  const { projectId } = useParams()
  const { members, isLoading, create, update, remove } = useTeam(projectId)
  const [draft, setDraft] = useState<Partial<ProjectMemberInput>>({ role: 'USER', module: 'FI', is_leader: false, active: true })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate({
      full_name: draft.full_name ?? '',
      email: draft.email ?? '',
      role: draft.role ?? 'USER',
      module: draft.module,
      function: draft.function,
      is_leader: Boolean(draft.is_leader),
      company: draft.company,
      active: true,
    }, { onSuccess: () => setDraft({ role: 'USER', module: 'FI', is_leader: false, active: true }) })
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Header title="Equipe" subtitle="Módulos, consultores, key-users e perfis de acesso." count={members.length} />
      <form className="card mb-5" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-6">
          <Input label="Nome" value={draft.full_name ?? ''} onChange={(full_name) => setDraft((d) => ({ ...d, full_name }))} />
          <Input label="E-mail" value={draft.email ?? ''} onChange={(email) => setDraft((d) => ({ ...d, email }))} />
          <Input label="Módulo" value={draft.module ?? ''} onChange={(module) => setDraft((d) => ({ ...d, module }))} />
          <Input label="Função" value={draft.function ?? ''} onChange={(fn) => setDraft((d) => ({ ...d, function: fn }))} />
          <label><span className="label">Perfil</span><select className="input" value={draft.role ?? 'USER'} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as UserRole }))}><option>ADMIN</option><option>USER</option><option>VIEWER</option></select></label>
          <label className="flex items-end gap-2 pb-2 text-sm text-text-secondary"><input checked={Boolean(draft.is_leader)} type="checkbox" onChange={(e) => setDraft((d) => ({ ...d, is_leader: e.target.checked }))} /> Líder</label>
        </div>
        <div className="mt-4 flex justify-end"><button className="btn-primary" type="submit"><Plus className="h-4 w-4" /> Adicionar</button></div>
      </form>
      <section className="card overflow-hidden p-0">{isLoading ? <div className="p-6 text-text-secondary">Carregando...</div> : <table className="data-table"><thead><tr><th>Módulo</th><th>Nome</th><th>E-mail</th><th>Função</th><th>Perfil</th><th>Líder</th><th>Ações</th></tr></thead><tbody>{members.map((m) => <tr key={m.id}><td>{m.module}</td><td className="text-text-primary">{m.full_name}</td><td>{m.email}</td><td>{m.function ?? '-'}</td><td><span className="badge badge-blue">{m.role}</span></td><td><input checked={m.is_leader} type="checkbox" onChange={(e) => update.mutate({ memberId: m.id, input: { is_leader: e.target.checked } })} /></td><td><button className="btn-danger btn-sm" type="button" onClick={() => remove.mutate(m.id)}><Trash2 className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table>}</section>
    </div>
  )
}

function Header({ title, subtitle, count }: { title: string; subtitle: string; count: number }) {
  return <header className="mb-6 flex items-center justify-between"><div><span className="badge badge-blue">Módulo transversal</span><h1 className="mt-3 text-2xl font-bold text-text-primary">{title}</h1><p className="mt-1 text-sm text-text-secondary">{subtitle}</p></div><div className="card2 text-center"><Users className="mx-auto mb-2 h-5 w-5 text-brand-600" /><strong>{count}</strong></div></header>
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="label">{label}</span><input className="input" required={label === 'Nome' || label === 'E-mail'} value={value} onChange={(e) => onChange(e.target.value)} /></label>
}
