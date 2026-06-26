import { useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { useCosts } from '@/hooks/useTransversal'
import { formatCurrency } from '@/lib/utils'
import type { CreateCostInput } from '@/types'

export default function CostsPage() {
  const { projectId } = useParams()
  const { items, total, byCategory, isLoading, create, remove } = useCosts(projectId)
  const [draft, setDraft] = useState<Partial<CreateCostInput>>({ currency: 'BRL', amount: 0 })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    create.mutate({
      description: draft.description ?? '',
      category: draft.category,
      amount: Number(draft.amount ?? 0),
      currency: draft.currency ?? 'BRL',
      date: draft.date,
      notes: draft.notes,
    }, { onSuccess: () => setDraft({ currency: 'BRL', amount: 0 }) })
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Header title="Custos" value={formatCurrency(total)} />
      <section className="mb-5 grid gap-4 md:grid-cols-3">{Object.entries(byCategory).slice(0, 3).map(([label, value]) => <Kpi key={label} label={label} value={formatCurrency(value)} />)}</section>
      <form className="card mb-5" onSubmit={submit}><div className="grid gap-4 md:grid-cols-6"><Input label="Descrição" value={draft.description ?? ''} onChange={(description) => setDraft((d) => ({ ...d, description }))} /><Input label="Categoria" value={draft.category ?? ''} onChange={(category) => setDraft((d) => ({ ...d, category }))} /><Input label="Valor" type="number" value={String(draft.amount ?? 0)} onChange={(amount) => setDraft((d) => ({ ...d, amount: Number(amount) }))} /><Input label="Moeda" value={draft.currency ?? 'BRL'} onChange={(currency) => setDraft((d) => ({ ...d, currency }))} /><Input label="Data" type="date" value={draft.date ?? ''} onChange={(date) => setDraft((d) => ({ ...d, date }))} /><button className="btn-primary self-end" type="submit"><Plus className="h-4 w-4" /> Adicionar</button></div></form>
      <Table loading={isLoading} headers={['Descrição','Categoria','Valor','Data','Notas','Ações']} rows={items.map((item) => [item.description, item.category ?? '-', formatCurrency(item.amount, item.currency), item.date ?? '-', item.notes ?? '-', <button className="btn-danger btn-sm" type="button" onClick={() => remove.mutate(item.id)}><Trash2 className="h-3.5 w-3.5" /></button>])} />
    </div>
  )
}

function Header({ title, value }: { title: string; value: string }) { return <header className="mb-6"><span className="badge badge-blue">Módulo transversal</span><h1 className="mt-3 text-2xl font-bold text-text-primary">{title}</h1><p className="mt-1 text-sm text-text-secondary">Total: {value}</p></header> }
function Kpi({ label, value }: { label: string; value: string }) { return <div className="card2"><span className="text-sm text-text-secondary">{label}</span><strong className="mt-2 block text-xl text-text-primary">{value}</strong></div> }
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; type?: string; onChange: (value: string) => void }) { return <label><span className="label">{label}</span><input className="input" required={label === 'Descrição'} type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label> }
function Table({ loading, headers, rows }: { loading: boolean; headers: string[]; rows: ReactNode[][] }) { return <section className="card overflow-hidden p-0">{loading ? <div className="p-6 text-text-secondary">Carregando...</div> : <table className="data-table"><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className={j === 0 ? 'text-text-primary' : ''}>{cell}</td>)}</tr>)}</tbody></table>}</section> }
