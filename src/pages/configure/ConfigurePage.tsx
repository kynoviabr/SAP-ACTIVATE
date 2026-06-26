import { useState } from 'react'
import { Check, Plus, Save } from 'lucide-react'
import { SAP_MODULES } from '@/types'

const steps = ['Dados do Projeto', 'Escopo + IA', 'Equipe', 'Stakeholders']

export default function ConfigurePage() {
  const [step, setStep] = useState(0)
  const [modules, setModules] = useState<string[]>(['FI', 'CO'])

  function toggleModule(module: string) {
    setModules((current) => current.includes(module) ? current.filter((item) => item !== module) : [...current, module])
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
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

      <section className="card">
        {step === 0 && <StepProject />}
        {step === 1 && (
          <div className="space-y-5">
            <div className="rounded-[12px] border border-dashed border-surface-border bg-[#0f1229] p-8 text-center text-text-secondary">Arraste PDF/DOCX/XLSX até 10MB ou clique para selecionar.</div>
            <div className="flex flex-wrap gap-2">
              {SAP_MODULES.slice(0, 10).map((module) => (
                <button key={module} className={`badge ${modules.includes(module) ? 'badge-blue' : 'badge-gray'}`} type="button" onClick={() => toggleModule(module)}>{module}</button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Output title="Resumo do Escopo" />
              <Output title="Riscos Identificados" />
              <Output title="Timeline Estimada" />
            </div>
          </div>
        )}
        {step === 2 && <StepTeam />}
        {step === 3 && <StepStakeholders />}
      </section>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" disabled={step === 0} type="button" onClick={() => setStep((current) => Math.max(0, current - 1))}>Voltar</button>
        {step < steps.length - 1 ? (
          <button className="btn-primary" type="button" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}>Próximo</button>
        ) : (
          <button className="btn-green" type="button"><Save className="h-4 w-4" /> Finalizar Configuração</button>
        )}
      </div>
    </div>
  )
}

function StepProject() {
  return <div className="grid gap-4 md:grid-cols-2"><Input label="Nome*" /><Input label="Cliente*" /><Input label="GP*" /><Input label="Fase Atual" /><Input label="Data Início" type="date" /><Input label="Data Go-Live" type="date" /><Input label="Metodologia" /><Input label="Status Inicial" /><label className="md:col-span-2"><span className="label">Objetivo Geral</span><textarea className="input" /></label></div>
}

function StepTeam() {
  return <div><div className="mb-3 flex gap-2"><button className="btn-secondary btn-sm" type="button">Importar Excel</button><button className="btn-primary btn-sm" type="button"><Plus className="h-3.5 w-3.5" /> Adicionar Membro</button><button className="btn-secondary btn-sm" type="button">Bloquear Equipe</button></div><div className="overflow-x-auto"><table className="data-table min-w-[760px]"><thead><tr><th>Módulo</th><th>Consultor</th><th>Função</th><th>E-mail</th><th>Perfil</th><th>Líder</th></tr></thead><tbody><tr><td>FI</td><td><input className="input" /></td><td><input className="input" /></td><td><input className="input" /></td><td>USER</td><td><input type="checkbox" /></td></tr></tbody></table></div><p className="mt-3 text-xs text-text-muted">Política de senha: mínimo 8 caracteres.</p></div>
}

function StepStakeholders() {
  return <div className="grid gap-4 md:grid-cols-2"><Input label="Sponsor" /><Input label="E-mail do Sponsor" /><label><span className="label">Key Users</span><textarea className="input" /></label><label><span className="label">Outras partes interessadas</span><textarea className="input" /></label><Input label="Data/Hora Kickoff" type="datetime-local" /><Input label="Local/Link" /><Input label="Duração" /><Input label="Pauta principal" /></div>
}

function Input({ label, type = 'text' }: { label: string; type?: string }) {
  return <label><span className="label">{label}</span><input className="input" type={type} /></label>
}

function Output({ title }: { title: string }) {
  return <div className="ai-output-box"><h3 className="mb-2 font-bold text-text-primary">{title}</h3><p className="text-text-secondary">Resultado gerado pela análise de escopo.</p></div>
}
