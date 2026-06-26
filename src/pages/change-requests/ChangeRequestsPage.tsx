import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { useChangeRequests } from '@/hooks/useTransversal'
import type { ChangeRequest, CreateChangeRequestInput } from '@/types'

const statuses: ChangeRequest['status'][] = ['aberta', 'aprovada', 'rejeitada', 'cancelada']

export default function ChangeRequestsPage() {
  const { projectId } = useParams()
  const { items, stats, isLoading, create, update, remove } = useChangeRequests(projectId)
  const [draft, setDraft] = useState<Partial<CreateChangeRequestInput>>({ status: 'aberta' })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate({ title: draft.title ?? '', description: draft.description, impact: draft.impact, requester: draft.requester, status: draft.status ?? 'aberta', decision_date: draft.decision_date, notes: draft.notes }, { onSuccess: () => setDraft({ status: 'aberta' }) })
  }

  return <div className="mx-auto max-w-7xl px-6 py-8"><header className="mb-6"><span className="badge badge-blue">Módulo transversal</span><h1 className="mt-3 text-2xl font-bold text-text-primary">Change Requests</h1><p className="mt-1 text-sm text-text-secondary">Abertas {stats.abertas} - Aprovadas {stats.aprovadas} - Rejeitadas {stats.rejeitadas}</p></header><form className="card mb-5" onSubmit={submit}><div className="grid gap-4 md:grid-cols-5"><Input label="Título" value={draft.title ?? ''} onChange={(title) => setDraft((d) => ({ ...d, title }))} /><Input label="Impacto" value={draft.impact ?? ''} onChange={(impact) => setDraft((d) => ({ ...d, impact }))} /><Input label="Solicitante" value={draft.requester ?? ''} onChange={(requester) => setDraft((d) => ({ ...d, requester }))} /><Select value={draft.status ?? 'aberta'} onChange={(status) => setDraft((d) => ({ ...d, status: status as ChangeRequest['status'] }))} /><button className="btn-primary self-end" type="submit"><Plus className="h-4 w-4" /> Criar</button></div></form><section className="card overflow-hidden p-0">{isLoading ? <div className="p-6 text-text-secondary">Carregando...</div> : <table className="data-table"><thead><tr><th>#</th><th>Título</th><th>Impacto</th><th>Solicitante</th><th>Status</th><th>Notas</th><th>Ações</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.cr_number}</td><td className="text-text-primary">{item.title}</td><td>{item.impact ?? '-'}</td><td>{item.requester ?? '-'}</td><td><Select compact value={item.status} onChange={(status) => update.mutate({ itemId: item.id, input: { status: status as ChangeRequest['status'] } })} /></td><td>{item.notes ?? '-'}</td><td><button className="btn-danger btn-sm" type="button" onClick={() => remove.mutate(item.id)}><Trash2 className="h-3.5 w-3.5" /></button></td></tr>)}</tbody></table>}</section></div>
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span className="label">{label}</span><input className="input" required={label === 'Título'} value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function Select({ value, onChange, compact }: { value: string; compact?: boolean; onChange: (value: string) => void }) { return <label className={compact ? '' : undefined}>{!compact ? <span className="label">Status</span> : null}<select className={compact ? 'badge badge-blue border-0' : 'input'} value={value} onChange={(e) => onChange(e.target.value)}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></label> }
