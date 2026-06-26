import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Loader2, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import { kickoffDB, membersDB, tasksDB } from '@/lib/database'
import { useProjects } from '@/hooks/useProjects'
import { buildActivateTaskInputs } from '@/hooks/useTasks'
import { useAuthStore } from '@/store'
import { SAP_MODULES, type CreateProjectInput, type PhaseNumber, type ProjectMemberInput } from '@/types'

const steps = ['Dados do Projeto', 'Escopo + IA', 'Equipe', 'Stakeholders']

type DraftProject = {
  name: string
  client: string
  project_manager: string
  current_phase: PhaseNumber
  start_date: string
  golive_date: string
  methodology: string
  objective: string
  sponsor: string
  sponsor_email: string
  kickoff_date: string
  kickoff_location: string
}

type DraftMember = {
  module: string
  full_name: string
  function: string
  email: string
  role: ProjectMemberInput['role']
  is_leader: boolean
  company: string
}

const today = new Date().toISOString().slice(0, 10)

export default function ConfigurePage() {
  const navigate = useNavigate()
  const tenant = useAuthStore((state) => state.tenant)
  const user = useAuthStore((state) => state.user)
  const { createProject, setActiveProject } = useProjects()
  const [step, setStep] = useState(0)
  const [modules, setModules] = useState<string[]>(['FI', 'CO'])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [project, setProject] = useState<DraftProject>({
    name: '',
    client: '',
    project_manager: user?.full_name ?? '',
    current_phase: '1',
    start_date: today,
    golive_date: addDays(today, 120),
    methodology: 'SAP Activate',
    objective: '',
    sponsor: '',
    sponsor_email: '',
    kickoff_date: '',
    kickoff_location: '',
  })
  const [members, setMembers] = useState<DraftMember[]>([
    { module: 'FI', full_name: '', function: 'Consultor funcional', email: '', role: 'USER', is_leader: true, company: '' },
  ])

  const scopePreview = useMemo(() => {
    const selected = modules.length ? modules.join(', ') : 'módulos a definir'
    return {
      summary: `Implantação ${project.methodology || 'SAP Activate'} para ${project.client || 'cliente'}, cobrindo ${selected}.`,
      risks: modules.length > 6 ? 'Escopo amplo: reforçar governança, priorização e controle de mudanças.' : 'Escopo controlado: acompanhar disponibilidade de key-users e dados mestres.',
      timeline: `${project.start_date || today} até ${project.golive_date || addDays(today, 120)} com fases Prepare, Explore, Realize, Deploy e Run.`,
    }
  }, [modules, project.client, project.golive_date, project.methodology, project.start_date])

  function updateProject<K extends keyof DraftProject>(key: K, value: DraftProject[K]) {
    setProject((current) => ({ ...current, [key]: value }))
  }

  function toggleModule(module: string) {
    setModules((current) => current.includes(module) ? current.filter((item) => item !== module) : [...current, module])
  }

  function addMember() {
    setMembers((current) => [
      ...current,
      { module: modules[0] ?? 'FI', full_name: '', function: '', email: '', role: 'USER', is_leader: false, company: '' },
    ])
  }

  function updateMember(index: number, key: keyof DraftMember, value: string | boolean) {
    setMembers((current) => current.map((member, itemIndex) => itemIndex === index ? { ...member, [key]: value } : member))
  }

  function removeMember(index: number) {
    setMembers((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  function validateStep(targetStep = step) {
    if (targetStep >= 0 && (!project.name.trim() || !project.client.trim() || !project.project_manager.trim())) {
      return 'Preencha nome, cliente e GP do projeto.'
    }
    if (targetStep >= 1 && modules.length === 0) return 'Selecione pelo menos um módulo SAP.'
    if (targetStep >= 3 && project.sponsor_email && !project.sponsor_email.includes('@')) return 'Informe um e-mail de sponsor válido.'
    return null
  }

  function nextStep() {
    const message = validateStep(step)
    if (message) {
      setError(message)
      return
    }
    setError(null)
    setStep((current) => Math.min(steps.length - 1, current + 1))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = validateStep(steps.length - 1)
    if (message) {
      setError(message)
      return
    }
    if (!tenant?.id) {
      setError('Tenant não encontrado na sessão. Saia e entre novamente antes de criar o projeto.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const input: CreateProjectInput = {
        name: project.name.trim(),
        client: project.client.trim(),
        project_manager: project.project_manager.trim(),
        sponsor: project.sponsor.trim() || undefined,
        sponsor_email: project.sponsor_email.trim() || undefined,
        objective: project.objective.trim() || scopePreview.summary,
        methodology: project.methodology.trim() || 'SAP Activate',
        current_phase: project.current_phase,
        start_date: project.start_date,
        golive_date: project.golive_date,
        progress_pct: project.current_phase === '1' ? 0 : 20,
        planned_value: 0,
        earned_value: 0,
        actual_cost: 0,
        modules,
        tags: ['sap-activate'],
        active: true,
        archived: false,
        created_by: user?.id,
      }
      const created = await createProject.mutateAsync(input)
      await tasksDB.bulkInsert(buildActivateTaskInputs(created.id))
      const validMembers = members
        .filter((member) => member.full_name.trim() && member.email.trim())
        .map((member): ProjectMemberInput => ({
          tenant_id: tenant.id,
          project_id: created.id,
          full_name: member.full_name.trim(),
          email: member.email.trim(),
          role: member.role,
          module: member.module || undefined,
          function: member.function.trim() || undefined,
          is_leader: member.is_leader,
          company: member.company.trim() || undefined,
          active: true,
        }))
      if (validMembers.length) await membersDB.bulkInsert(validMembers)
      if (project.kickoff_date || project.kickoff_location || project.objective) {
        await kickoffDB.upsert({
          tenant_id: tenant.id,
          project_id: created.id,
          kickoff_date: project.kickoff_date || undefined,
          location: project.kickoff_location.trim() || undefined,
          objective: project.objective.trim() || scopePreview.summary,
          agenda: 'Abertura, objetivos, escopo, governança, cronograma macro, riscos iniciais e próximos passos.',
          modality: project.kickoff_location.toLowerCase().startsWith('http') ? 'remoto' : 'hibrido',
          platform: project.kickoff_location.toLowerCase().includes('teams') ? 'Teams' : 'Reunião',
        })
      }
      setActiveProject(created)
      navigate(`/projects/${created.id}/dashboard`, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="mx-auto max-w-5xl px-6 py-8" onSubmit={submit}>
      <header className="mb-6">
        <span className="badge badge-blue">Configuração</span>
        <h1 className="mt-3 text-2xl font-bold text-text-primary">Novo Projeto SAP Activate</h1>
        <p className="mt-1 text-sm text-text-secondary">Wizard de quatro passos para setup do projeto, escopo, equipe e kickoff.</p>
      </header>

      <div className="mb-6 flex items-center">
        {steps.map((label, index) => (
          <div key={label} className="flex flex-1 items-center">
            <button className="flex items-center gap-2 text-left" type="button" onClick={() => setStep(index)}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${index < step ? 'bg-ok text-white' : index === step ? 'bg-brand-600 text-white' : 'bg-surface-border text-text-secondary'}`}>
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className={`hidden text-xs font-semibold md:block ${index === step ? 'text-text-primary' : 'text-text-muted'}`}>{label}</span>
            </button>
            {index < steps.length - 1 ? <div className={`mx-3 h-px flex-1 ${index < step ? 'bg-ok' : 'bg-surface-border'}`} /> : null}
          </div>
        ))}
      </div>

      {error ? (
        <div className="mb-5 rounded-[8px] border border-status-red bg-[#450a0a] px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}

      <section className="card">
        {step === 0 && <StepProject project={project} onChange={updateProject} />}
        {step === 1 && (
          <StepScope modules={modules} preview={scopePreview} onToggleModule={toggleModule} />
        )}
        {step === 2 && (
          <StepTeam members={members} modules={modules} onAdd={addMember} onRemove={removeMember} onChange={updateMember} />
        )}
        {step === 3 && <StepStakeholders project={project} onChange={updateProject} />}
      </section>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" disabled={step === 0 || saving} type="button" onClick={() => setStep((current) => Math.max(0, current - 1))}>Voltar</button>
        {step < steps.length - 1 ? (
          <button className="btn-primary" disabled={saving} type="button" onClick={nextStep}>Próximo</button>
        ) : (
          <button className="btn-green" disabled={saving} type="submit">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Finalizar Configuração
          </button>
        )}
      </div>
    </form>
  )
}

function StepProject({ project, onChange }: { project: DraftProject; onChange: <K extends keyof DraftProject>(key: K, value: DraftProject[K]) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Input label="Nome*" value={project.name} onChange={(value) => onChange('name', value)} />
      <Input label="Cliente*" value={project.client} onChange={(value) => onChange('client', value)} />
      <Input label="GP*" value={project.project_manager} onChange={(value) => onChange('project_manager', value)} />
      <label>
        <span className="label">Fase Atual</span>
        <select className="input" value={project.current_phase} onChange={(event) => onChange('current_phase', event.target.value as PhaseNumber)}>
          <option value="1">1 Prepare</option>
          <option value="2">2 Explore</option>
          <option value="3">3 Realize</option>
          <option value="4">4 Deploy</option>
          <option value="5">5 Run</option>
        </select>
      </label>
      <Input label="Data Início" type="date" value={project.start_date} onChange={(value) => onChange('start_date', value)} />
      <Input label="Data Go-Live" type="date" value={project.golive_date} onChange={(value) => onChange('golive_date', value)} />
      <Input label="Metodologia" value={project.methodology} onChange={(value) => onChange('methodology', value)} />
      <label className="md:col-span-2">
        <span className="label">Objetivo Geral</span>
        <textarea className="input" value={project.objective} onChange={(event) => onChange('objective', event.target.value)} />
      </label>
    </div>
  )
}

function StepScope({ modules, preview, onToggleModule }: {
  modules: string[]
  preview: { summary: string; risks: string; timeline: string }
  onToggleModule: (module: string) => void
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-[12px] border border-dashed border-surface-border bg-[#0f1229] p-8 text-center text-text-secondary">
        <Sparkles className="mx-auto mb-3 h-5 w-5 text-brand-600" />
        Escopo inicial será estruturado a partir dos módulos selecionados e poderá ser refinado nos BPDs.
      </div>
      <div className="flex flex-wrap gap-2">
        {SAP_MODULES.slice(0, 18).map((module) => (
          <button key={module} className={`badge ${modules.includes(module) ? 'badge-blue' : 'badge-gray'}`} type="button" onClick={() => onToggleModule(module)}>{module}</button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Output title="Resumo do Escopo" text={preview.summary} />
        <Output title="Riscos Identificados" text={preview.risks} />
        <Output title="Timeline Estimada" text={preview.timeline} />
      </div>
    </div>
  )
}

function StepTeam({ members, modules, onAdd, onRemove, onChange }: {
  members: DraftMember[]
  modules: string[]
  onAdd: () => void
  onRemove: (index: number) => void
  onChange: (index: number, key: keyof DraftMember, value: string | boolean) => void
}) {
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button className="btn-primary btn-sm" type="button" onClick={onAdd}><Plus className="h-3.5 w-3.5" /> Adicionar Membro</button>
        <span className="badge badge-gray">Equipe opcional nesta etapa</span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[860px]">
          <thead><tr><th>Módulo</th><th>Consultor</th><th>Função</th><th>E-mail</th><th>Perfil</th><th>Líder</th><th /></tr></thead>
          <tbody>
            {members.map((member, index) => (
              <tr key={index}>
                <td><select className="input" value={member.module} onChange={(event) => onChange(index, 'module', event.target.value)}>{(modules.length ? modules : ['FI']).map((module) => <option key={module} value={module}>{module}</option>)}</select></td>
                <td><input className="input" value={member.full_name} onChange={(event) => onChange(index, 'full_name', event.target.value)} /></td>
                <td><input className="input" value={member.function} onChange={(event) => onChange(index, 'function', event.target.value)} /></td>
                <td><input className="input" type="email" value={member.email} onChange={(event) => onChange(index, 'email', event.target.value)} /></td>
                <td><select className="input" value={member.role} onChange={(event) => onChange(index, 'role', event.target.value)}><option value="USER">USER</option><option value="VIEWER">VIEWER</option><option value="ADMIN">ADMIN</option></select></td>
                <td><input type="checkbox" checked={member.is_leader} onChange={(event) => onChange(index, 'is_leader', event.target.checked)} /></td>
                <td><button className="btn-danger btn-sm" type="button" onClick={() => onRemove(index)}><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StepStakeholders({ project, onChange }: { project: DraftProject; onChange: <K extends keyof DraftProject>(key: K, value: DraftProject[K]) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Input label="Sponsor" value={project.sponsor} onChange={(value) => onChange('sponsor', value)} />
      <Input label="E-mail do Sponsor" type="email" value={project.sponsor_email} onChange={(value) => onChange('sponsor_email', value)} />
      <Input label="Data/Hora Kickoff" type="datetime-local" value={project.kickoff_date} onChange={(value) => onChange('kickoff_date', value)} />
      <Input label="Local/Link" value={project.kickoff_location} onChange={(value) => onChange('kickoff_location', value)} />
      <div className="card2 md:col-span-2">
        <h3 className="text-sm font-bold text-text-primary">O que será criado</h3>
        <p className="mt-2 text-sm text-text-secondary">Projeto ativo, cronograma padrão SAP Activate com 28 tarefas/marcos e contexto inicial para os módulos selecionados.</p>
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return <label><span className="label">{label}</span><input className="input" type={type} value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)} /></label>
}

function Output({ title, text }: { title: string; text: string }) {
  return <div className="ai-output-box"><h3 className="mb-2 font-bold text-text-primary">{title}</h3><p className="text-text-secondary">{text}</p></div>
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return value.toISOString().slice(0, 10)
}
