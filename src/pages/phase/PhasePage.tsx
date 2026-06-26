import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Circle, Lock, PlayCircle } from 'lucide-react'
import { PHASE_INFO, type PhaseNumber } from '@/types'
import { useTasks } from '@/hooks/useTasks'

const templatesByPhase: Record<PhaseNumber, Array<{ key: string; name: string; description: string; path?: string }>> = {
  '1': [
    { key: 'kickoff', name: 'Kickoff do Projeto', description: 'Identificação, pauta, ata e plano inicial.', path: 'kickoff' },
    { key: 'macro_schedule', name: 'Cronograma Macro', description: 'Marcos, fases e timeline executiva.', path: 'macro-schedule' },
    { key: 'scope', name: 'Definição de Escopo', description: 'Escopo, premissas e documentos.', path: 'scope' },
    { key: 'org', name: 'Organização e Comunicação', description: 'Rituais, stakeholders e canais.', path: 'organization' },
    { key: 'qg1', name: 'Quality Gate Fase 1', description: 'Checklist de aprovação da fase.', path: 'quality-gate/1' },
  ],
  '2': [
    { key: 'bpd', name: 'SOW / BPD', description: 'Processos, solução proposta e critérios.', path: 'bpd' },
    { key: 'gap', name: 'GAP Analysis', description: 'Deltas de negócio e solução.', path: 'templates/gap' },
    { key: 'detailed_schedule', name: 'Cronograma Detalhado', description: 'Sprints, esforço e SPI.', path: 'templates/detailed_schedule' },
    { key: 'qg2', name: 'Quality Gate Fase 2', description: 'Checklist de Explore.', path: 'quality-gate/2' },
  ],
  '3': [
    { key: 'execution', name: 'Plano de Execução', description: 'Atividades por sprint e módulo.', path: 'templates/execution' },
    { key: 'requests', name: 'Requests SAP', description: 'Transportes e objetos.', path: 'templates/requests' },
    { key: 'tests', name: 'Plano de Testes', description: 'SIT/UAT e evidências.', path: 'templates/tests' },
    { key: 'bugs', name: 'Controle de Bugs', description: 'Defeitos e retestes.', path: 'templates/bugs' },
    { key: 'status', name: 'Status Report', description: 'One page executivo.', path: 'templates/status' },
    { key: 'monitoring', name: 'Monitoramento', description: 'KPIs consolidados.', path: 'templates/monitoring' },
    { key: 'qg3', name: 'Quality Gate Fase 3', description: 'Checklist de Realize.', path: 'quality-gate/3' },
  ],
  '4': [
    { key: 'runbook', name: 'Runbook Cutover', description: 'Janelas, requests e go/no-go.', path: 'templates/runbook' },
    { key: 'uat', name: 'Testes Finais UAT', description: 'Aprovação final por módulo.', path: 'templates/uat' },
    { key: 'transition', name: 'Plano de Transição', description: 'Suporte, treinamento e operação.', path: 'templates/transition' },
    { key: 'qg4', name: 'Quality Gate Fase 4', description: 'Checklist de Deploy.', path: 'quality-gate/4' },
  ],
  '5': [
    { key: 'hypercare', name: 'Hypercare', description: 'Suporte intensivo pós go-live.', path: 'templates/hypercare' },
    { key: 'lessons', name: 'Lições Aprendidas', description: 'Melhorias e retrospectiva.', path: 'templates/lessons' },
    { key: 'closure', name: 'Encerramento', description: 'Aceite e encerramento formal.', path: 'templates/closure' },
    { key: 'qg5', name: 'Quality Gate Fase 5', description: 'Checklist de Run.', path: 'quality-gate/5' },
  ],
}

export default function PhasePage() {
  const navigate = useNavigate()
  const { projectId, phase = '1' } = useParams()
  const phaseNumber = (['1', '2', '3', '4', '5'].includes(phase) ? phase : '1') as PhaseNumber
  const [filter, setFilter] = useState<'all' | 'done' | 'pending'>('all')
  const { tasks, spiData } = useTasks(projectId, phaseNumber)
  const templates = templatesByPhase[phaseNumber]
  const info = PHASE_INFO[phaseNumber]

  const templateTasks = tasks.filter((task) => task.type !== 'phase')
  const completedTasks = templateTasks.filter((task) => task.status === 'concluido').length
  const phaseProgress = templateTasks.length ? Math.round((completedTasks / templateTasks.length) * 100) : 0
  const visibleTemplates = useMemo(() => {
    if (filter === 'all') return templates
    if (filter === 'done') return templates.filter((template) => getTemplateStatus(template.key, templateTasks) === 'done')
    return templates.filter((template) => getTemplateStatus(template.key, templateTasks) !== 'done')
  }, [filter, templateTasks, templates])

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <span className="badge" style={{ background: info.color, color: '#fff' }}>{info.icon} {info.label}</span>
          <h1 className="mt-3 text-2xl font-bold text-text-primary">{info.short}</h1>
          <p className="mt-1 text-sm text-text-secondary">{visibleTemplates.length} templates disponíveis nesta fase.</p>
        </div>
        <button className="btn-primary" type="button" onClick={() => navigate(`/projects/${projectId}/dashboard`)}>
          Dashboard
        </button>
      </header>

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <Kpi label="Progresso" value={`${phaseProgress}%`} />
        <Kpi label="Templates" value={`${completedTasks}/${templateTasks.length || templates.length}`} />
        <Kpi label="Dias na fase" value={templateTasks.length ? `${templateTasks.length} itens` : '0'} />
        <Kpi label="Status SPI" value={spiData.spi.toFixed(2)} />
      </section>

      <div className="mb-5 flex flex-wrap gap-2">
        {(['all', 'done', 'pending'] as const).map((item) => (
          <button key={item} className={`section-tab ${filter === item ? 'active' : ''}`} type="button" onClick={() => setFilter(item)}>
            {item === 'all' ? 'Todos' : item === 'done' ? 'Concluídos' : 'Pendentes'}
          </button>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleTemplates.map((template, index) => {
          const templateStatus = getTemplateStatus(template.key, templateTasks)
          const done = templateStatus === 'done'
          const inProgress = templateStatus === 'progress' || (!templateTasks.length && index === 0)
          return (
            <button
              key={template.key}
              className={`card text-left transition hover:-translate-y-0.5 hover:border-brand-600 ${!done && !inProgress ? 'opacity-90' : ''}`}
              type="button"
              onClick={() => template.path && navigate(`/projects/${projectId}/${template.path}`)}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className={`badge ${done ? 'badge-green' : inProgress ? 'badge-amber' : 'badge-gray'}`}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : inProgress ? <PlayCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  {done ? 'Concluído' : inProgress ? 'Em andamento' : 'Pendente'}
                </span>
                {!template.path ? <Lock className="h-4 w-4 text-text-muted" /> : null}
              </div>
              <h2 className="text-lg font-bold text-text-primary">{template.name}</h2>
              <p className="mt-2 text-sm text-text-secondary">{template.description}</p>
            </button>
          )
        })}
      </section>
    </div>
  )
}

function getTemplateStatus(key: string, tasks: Array<{ title: string; status: string }>) {
  const terms: Record<string, string[]> = {
    kickoff: ['kickoff'],
    macro_schedule: ['cronograma macro'],
    scope: ['escopo'],
    org: ['organização', 'comunicação'],
    qg1: ['quality gate'],
    bpd: ['bpd', 'sow'],
    gap: ['gap'],
    detailed_schedule: ['cronograma detalhado'],
    qg2: ['quality gate'],
    execution: ['execução'],
    requests: ['requests'],
    tests: ['testes'],
    bugs: ['bugs'],
    status: ['status report'],
    monitoring: ['monitoramento'],
    qg3: ['quality gate'],
    runbook: ['runbook'],
    uat: ['uat'],
    transition: ['transição'],
    qg4: ['quality gate'],
    hypercare: ['hypercare'],
    lessons: ['lições'],
    closure: ['encerramento'],
    qg5: ['quality gate'],
  }
  const task = tasks.find((item) => terms[key]?.some((term) => item.title.toLowerCase().includes(term)))
  if (!task) return 'pending'
  if (task.status === 'concluido') return 'done'
  if (task.status === 'em_andamento') return 'progress'
  return 'pending'
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card2">
      <span className="text-sm text-text-secondary">{label}</span>
      <strong className="mt-2 block text-2xl text-text-primary">{value}</strong>
    </div>
  )
}
