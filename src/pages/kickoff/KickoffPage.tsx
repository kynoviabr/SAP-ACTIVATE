import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import { useKickoff } from '@/hooks/useKickoff'
import { useProject } from '@/hooks/useProjects'

const tabs = ['Identificação', 'Prompt IA', 'Ata', 'Cronograma', 'Equipe', 'Assinaturas']

export default function KickoffPage() {
  const { projectId } = useParams()
  const { data: project } = useProject(projectId)
  const { kickoff, saveKickoff } = useKickoff(projectId)
  const [tab, setTab] = useState(tabs[0])
  const [draft, setDraft] = useState<Record<string, string>>({})

  function value(key: string, fallback = '') {
    return draft[key] ?? String((kickoff as any)?.[key] ?? fallback)
  }

  function update(key: string, next: string) {
    setDraft((current) => ({ ...current, [key]: next }))
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <span className="badge badge-green">Fase 1 - Prepare</span>
          <h1 className="mt-3 text-2xl font-bold text-text-primary">Kickoff do Projeto</h1>
          <p className="mt-1 text-sm text-text-secondary">{project?.name ?? 'Projeto'} - {project?.client ?? 'Cliente'}</p>
        </div>
        <button className="btn-primary" type="button" onClick={() => saveKickoff.mutate(draft)}>
          <Save className="h-4 w-4" />
          Salvar
        </button>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button key={item} className={`section-tab ${tab === item ? 'active' : ''}`} type="button" onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>

      <section className="card">
        {tab === 'Identificação' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Projeto" value={project?.name ?? ''} readOnly />
            <Field label="Cliente" value={project?.client ?? ''} readOnly />
            <Field label="GP" value={project?.project_manager ?? ''} readOnly />
            <Field label="Data Kickoff" type="datetime-local" value={value('kickoff_date')} onChange={(v) => update('kickoff_date', v)} />
            <Field label="Local / Link" value={value('location')} onChange={(v) => update('location', v)} />
            <Field label="Plataforma" value={value('platform', 'Teams')} onChange={(v) => update('platform', v)} />
          </div>
        )}
        {tab === 'Prompt IA' && <TextArea label="Prompt para apresentação" value={value('ai_prompt', `Gere uma apresentação de kickoff para ${project?.name ?? 'o projeto'}.`)} onChange={(v) => update('ai_prompt', v)} />}
        {tab === 'Ata' && <TextArea label="Ata de Kickoff" value={value('decisions')} onChange={(v) => update('decisions', v)} />}
        {tab === 'Cronograma' && <TextArea label="Timeline Macro" value={value('next_steps')} onChange={(v) => update('next_steps', v)} />}
        {tab === 'Equipe' && <TextArea label="Equipe por módulo" value={value('team_notes')} onChange={(v) => update('team_notes', v)} />}
        {tab === 'Assinaturas' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Assinatura GP" type="datetime-local" value={value('gp_signed_at')} onChange={(v) => update('gp_signed_at', v)} />
            <Field label="Assinatura Sponsor" type="datetime-local" value={value('sponsor_signed_at')} onChange={(v) => update('sponsor_signed_at', v)} />
          </div>
        )}
      </section>
    </div>
  )
}

function Field({ label, value, type = 'text', readOnly, onChange }: { label: string; value: string; type?: string; readOnly?: boolean; onChange?: (value: string) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="input" readOnly={readOnly} type={type} value={value} onChange={(event) => onChange?.(event.target.value)} />
    </label>
  )
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <textarea className="input min-h-[320px]" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}
