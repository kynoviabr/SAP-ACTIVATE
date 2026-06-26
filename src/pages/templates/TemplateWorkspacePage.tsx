import { useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { BarChart3, CheckCircle2, FileDown, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useLocalTemplateState } from '@/hooks/usePrepareTemplateState'
import { useTasks } from '@/hooks/useTasks'
import { PHASE_INFO, type PhaseNumber } from '@/types'

type TemplateRecord = Record<string, string> & { id: string }

type TemplateDefinition = {
  key: string
  phase: PhaseNumber
  title: string
  description: string
  badge: string
  fields: string[]
  checklist: string[]
  aiPrompt: string
  seed: TemplateRecord[]
}

const definitions: Record<string, TemplateDefinition> = {
  gap: {
    key: 'gap',
    phase: '2',
    title: 'GAP Analysis',
    description: 'Mapeamento de lacunas entre requisitos de negócio, SAP standard e solução alvo.',
    badge: 'Explore',
    fields: ['Módulo', 'Processo', 'Requisito', 'Solução SAP', 'GAP', 'Complexidade', 'Responsável', 'Status'],
    checklist: ['Requisitos priorizados', 'GAPs classificados', 'Impacto estimado', 'Decisão de solução registrada'],
    aiPrompt: 'Compare o documento de escopo com o standard SAP e gere lacunas, impacto, complexidade e recomendação de solução.',
    seed: [
      { id: 'gap-1', Módulo: 'FI', Processo: 'Contas a pagar', Requisito: 'Aprovação em múltiplos níveis', 'Solução SAP': 'Workflow standard', GAP: 'Ajuste de regra de alçada', Complexidade: 'média', Responsável: 'Consultor FI', Status: 'em_andamento' },
      { id: 'gap-2', Módulo: 'MM', Processo: 'Compras', Requisito: 'Integração fornecedor externo', 'Solução SAP': 'API + RICEFW', GAP: 'Interface a especificar', Complexidade: 'alta', Responsável: 'Arquiteto', Status: 'pendente' },
    ],
  },
  detailed_schedule: {
    key: 'detailed_schedule',
    phase: '2',
    title: 'Cronograma Detalhado',
    description: 'Planejamento detalhado por sprint, responsável, horas e predecessoras.',
    badge: 'Explore',
    fields: ['Sprint', 'Atividade', 'Módulo', 'Responsável', 'Início', 'Fim', 'Horas Planejadas', 'Horas Reais', '% Concluído', 'Predecessora'],
    checklist: ['Sprints definidos', 'Responsáveis atribuídos', 'Horas estimadas', 'Predecessoras mapeadas'],
    aiPrompt: 'Transforme o cronograma macro em um plano detalhado por sprint com esforço, precedência e risco de prazo.',
    seed: [
      { id: 'sch-1', Sprint: 'Sprint 1', Atividade: 'Workshops Explore FI/CO', Módulo: 'FI/CO', Responsável: 'Líder Funcional', Início: '2026-06-24', Fim: '2026-07-01', 'Horas Planejadas': '40', 'Horas Reais': '16', '% Concluído': '45', Predecessora: 'Kickoff' },
      { id: 'sch-2', Sprint: 'Sprint 2', Atividade: 'Validação de BPD MM/SD', Módulo: 'MM/SD', Responsável: 'Consultores', Início: '2026-07-02', Fim: '2026-07-10', 'Horas Planejadas': '56', 'Horas Reais': '8', '% Concluído': '15', Predecessora: 'Workshops' },
    ],
  },
  execution: {
    key: 'execution',
    phase: '3',
    title: 'Plano de Execução',
    description: 'Atividades de Realize por sprint, módulo, aceite e bloqueadores.',
    badge: 'Realize',
    fields: ['Sprint', 'Atividade', 'Módulo', 'Responsável', 'Início', 'Fim', 'Requests SAP', 'Aceite', 'Bloqueadores', 'Status'],
    checklist: ['Backlog aprovado', 'Requests vinculadas', 'Aceites claros', 'Bloqueadores monitorados'],
    aiPrompt: 'Gere um plano de execução Realize com atividades, responsáveis, requests SAP, aceite e bloqueadores.',
    seed: [
      { id: 'exe-1', Sprint: 'R1', Atividade: 'Configuração FI básica', Módulo: 'FI', Responsável: 'Consultor FI', Início: '2026-07-20', Fim: '2026-07-26', 'Requests SAP': 'DEVK900101', Aceite: 'Cenário contabilização aprovado', Bloqueadores: '-', Status: 'pendente' },
      { id: 'exe-2', Sprint: 'R1', Atividade: 'Configuração MM compras', Módulo: 'MM', Responsável: 'Consultor MM', Início: '2026-07-22', Fim: '2026-07-29', 'Requests SAP': 'DEVK900112', Aceite: 'Pedido de compras ponta a ponta', Bloqueadores: 'Dados mestres', Status: 'pendente' },
    ],
  },
  requests: {
    key: 'requests',
    phase: '3',
    title: 'Requests SAP',
    description: 'Controle consolidado de transportes e objetos SAP por módulo.',
    badge: 'Realize',
    fields: ['Request', 'Tipo', 'Módulo', 'Objeto', 'Origem', 'Destino', 'Responsável', 'Janela', 'Status'],
    checklist: ['Requests identificadas', 'Sequência validada', 'Janela reservada', 'Evidência anexada'],
    aiPrompt: 'Agrupe requests SAP por módulo, dependência, janela de transporte e risco de liberação.',
    seed: [
      { id: 'req-1', Request: 'DEVK900101', Tipo: 'Customizing', Módulo: 'FI', Objeto: 'Parâmetros contábeis', Origem: 'DEV', Destino: 'QAS', Responsável: 'BASIS', Janela: 'Semanal', Status: 'planejada' },
      { id: 'req-2', Request: 'DEVK900112', Tipo: 'Customizing', Módulo: 'MM', Objeto: 'Estratégia de liberação', Origem: 'DEV', Destino: 'QAS', Responsável: 'BASIS', Janela: 'Semanal', Status: 'planejada' },
    ],
  },
  tests: {
    key: 'tests',
    phase: '3',
    title: 'Plano de Testes',
    description: 'Ciclos SIT/UAT por módulo, cenário, evidência e aprovação.',
    badge: 'Realize',
    fields: ['Ciclo', 'Cenário', 'Módulo', 'Responsável', 'Data', 'Evidência', 'Resultado', 'Status'],
    checklist: ['Cenários definidos', 'Key-users alocados', 'Evidências exigidas', 'Critério de reteste claro'],
    aiPrompt: 'Gere cenários SIT/UAT por módulo, com dados de entrada, resultado esperado e evidência.',
    seed: [
      { id: 'test-1', Ciclo: 'SIT 1', Cenário: 'Contabilização fornecedor', Módulo: 'FI', Responsável: 'Key-user FI', Data: '2026-08-05', Evidência: 'Pendente', Resultado: '-', Status: 'pendente' },
      { id: 'test-2', Ciclo: 'SIT 1', Cenário: 'Pedido de compras', Módulo: 'MM', Responsável: 'Key-user MM', Data: '2026-08-06', Evidência: 'Pendente', Resultado: '-', Status: 'pendente' },
    ],
  },
  bugs: {
    key: 'bugs',
    phase: '3',
    title: 'Controle de Bugs',
    description: 'Defeitos SIT/UAT com severidade, responsável, correção e reteste.',
    badge: 'Realize',
    fields: ['ID', 'Tipo', 'Módulo', 'Descrição', 'Severidade', 'Responsável', 'Correção', 'Reteste', 'Status'],
    checklist: ['Triagem diária', 'Críticos priorizados', 'Correções vinculadas', 'Reteste planejado'],
    aiPrompt: 'Classifique bugs por severidade, impacto, causa provável e plano de correção/reteste.',
    seed: [
      { id: 'bug-1', ID: 'BUG-001', Tipo: 'SIT', Módulo: 'FI', Descrição: 'Erro em centro de lucro', Severidade: 'alta', Responsável: 'Consultor FI', Correção: 'Ajuste customizing', Reteste: 'pendente', Status: 'aberto' },
    ],
  },
  status: {
    key: 'status',
    phase: '3',
    title: 'Status Report Semanal',
    description: 'One page executivo com progresso, riscos, pendências e decisões.',
    badge: 'Realize',
    fields: ['Semana', 'Progresso', 'Principais entregas', 'Riscos', 'Pendências', 'Decisões', 'Próximos passos', 'Status'],
    checklist: ['Progresso atualizado', 'Riscos revistos', 'Decisões registradas', 'Plano da semana validado'],
    aiPrompt: 'Gere uma narrativa executiva curta com progresso, riscos, pendências críticas e próximos passos.',
    seed: [
      { id: 'st-1', Semana: 'W31', Progresso: '38%', 'Principais entregas': 'BPDs e gaps em validação', Riscos: 'Disponibilidade key-users', Pendências: 'Ambiente QAS', Decisões: 'Priorizar FI/MM', 'Próximos passos': 'Fechar desenho Explore', Status: 'amarelo' },
    ],
  },
  monitoring: {
    key: 'monitoring',
    phase: '3',
    title: 'Monitoramento e Controle',
    description: 'KPIs consolidados de execução, testes, bugs, requests e riscos.',
    badge: 'Realize',
    fields: ['Indicador', 'Meta', 'Atual', 'Tendência', 'Responsável', 'Ação', 'Prazo', 'Status'],
    checklist: ['KPIs definidos', 'Ações por desvio', 'Responsáveis nomeados', 'Comitê informado'],
    aiPrompt: 'Analise os KPIs e gere pontos de atenção com ações corretivas por responsável.',
    seed: [
      { id: 'mon-1', Indicador: 'SPI', Meta: '>= 0.95', Atual: '0.92', Tendência: 'queda', Responsável: 'PMO', Ação: 'Replanejar sprint', Prazo: '2026-08-02', Status: 'atenção' },
      { id: 'mon-2', Indicador: 'Bugs críticos', Meta: '0', Atual: '1', Tendência: 'estável', Responsável: 'Líder Técnico', Ação: 'War room', Prazo: '2026-08-03', Status: 'crítico' },
    ],
  },
  runbook: {
    key: 'runbook',
    phase: '4',
    title: 'Runbook Cutover',
    description: 'Plano D-30 a D+7 com transportes, cargas, go/no-go e contingência.',
    badge: 'Deploy',
    fields: ['Janela', 'Atividade', 'Responsável', 'Início', 'Fim', 'Dependência', 'Critério Go/No-Go', 'Contingência', 'Status'],
    checklist: ['Sequência fechada', 'Responsáveis confirmados', 'Contingência aprovada', 'Go/No-Go definido'],
    aiPrompt: 'Gere um runbook de cutover com sequência, janelas, responsáveis, critérios e contingência.',
    seed: [
      { id: 'run-1', Janela: 'D-7', Atividade: 'Freeze de configuração', Responsável: 'PMO/BASIS', Início: '2026-09-13', Fim: '2026-09-13', Dependência: 'QG4', 'Critério Go/No-Go': 'Sem bugs críticos', Contingência: 'Rollback requests', Status: 'planejado' },
      { id: 'run-2', Janela: 'D-1', Atividade: 'Carga final dados mestres', Responsável: 'Migração', Início: '2026-09-19', Fim: '2026-09-20', Dependência: 'Freeze', 'Critério Go/No-Go': 'Reconciliação aprovada', Contingência: 'Carga delta', Status: 'planejado' },
    ],
  },
  uat: {
    key: 'uat',
    phase: '4',
    title: 'Testes Finais UAT',
    description: 'Aprovação final por módulo, ciclo, evidência e threshold.',
    badge: 'Deploy',
    fields: ['Módulo', 'Ciclo', 'Cenários', 'Aprovados', 'Reprovados', 'Threshold', 'Aprovador', 'Status'],
    checklist: ['Threshold definido', 'Evidências completas', 'Reprovações tratadas', 'Aceite por módulo'],
    aiPrompt: 'Resuma os resultados UAT por módulo e indique se o threshold de aprovação foi atingido.',
    seed: [
      { id: 'uat-1', Módulo: 'FI', Ciclo: 'UAT Final', Cenários: '24', Aprovados: '23', Reprovados: '1', Threshold: '95%', Aprovador: 'Key-user FI', Status: 'atenção' },
      { id: 'uat-2', Módulo: 'MM', Ciclo: 'UAT Final', Cenários: '18', Aprovados: '18', Reprovados: '0', Threshold: '95%', Aprovador: 'Key-user MM', Status: 'aprovado' },
    ],
  },
  transition: {
    key: 'transition',
    phase: '4',
    title: 'Plano de Transição',
    description: 'Suporte pós go-live, treinamentos, operação assistida e migração restante.',
    badge: 'Deploy',
    fields: ['Frente', 'Atividade', 'Responsável', 'Data', 'Canal', 'Material', 'Critério de aceite', 'Status'],
    checklist: ['Treinamento executado', 'Suporte definido', 'AMS acionado', 'Pendências migradas'],
    aiPrompt: 'Monte um plano de transição com suporte, treinamento, canais e critérios para operação assistida.',
    seed: [
      { id: 'tr-1', Frente: 'Treinamento', Atividade: 'Sessão key-users', Responsável: 'Change', Data: '2026-09-10', Canal: 'Teams', Material: 'Manual FI/MM', 'Critério de aceite': 'Lista presença', Status: 'planejado' },
      { id: 'tr-2', Frente: 'Suporte', Atividade: 'War room hypercare', Responsável: 'AMS', Data: '2026-09-21', Canal: 'Teams + Jira', Material: 'Runbook', 'Critério de aceite': 'SLA publicado', Status: 'planejado' },
    ],
  },
  hypercare: {
    key: 'hypercare',
    phase: '5',
    title: 'Hypercare',
    description: 'Suporte intensivo D+1 a D+30 com chamados críticos e estabilização.',
    badge: 'Run',
    fields: ['Chamado', 'Módulo', 'Descrição', 'Severidade', 'Responsável', 'Aberto em', 'SLA', 'Solução', 'Status'],
    checklist: ['War room ativo', 'SLA publicado', 'Críticos monitorados', 'Passagem AMS preparada'],
    aiPrompt: 'Priorize chamados de hypercare por severidade, impacto no negócio, SLA e recomendação de estabilização.',
    seed: [
      { id: 'hc-1', Chamado: 'HC-001', Módulo: 'SD', Descrição: 'Dúvida faturamento', Severidade: 'média', Responsável: 'Consultor SD', 'Aberto em': '2026-09-22', SLA: '8h', Solução: 'Orientação key-user', Status: 'em_andamento' },
    ],
  },
  lessons: {
    key: 'lessons',
    phase: '5',
    title: 'Lições Aprendidas',
    description: 'Retrospectiva por categoria, votação e ações de melhoria.',
    badge: 'Run',
    fields: ['Categoria', 'Lição', 'Impacto', 'Votos', 'Responsável', 'Ação recomendada', 'Prazo', 'Status'],
    checklist: ['Sessão realizada', 'Lições categorizadas', 'Ações priorizadas', 'Relatório exportado'],
    aiPrompt: 'Agrupe lições aprendidas por categoria e gere ações práticas para próximos projetos.',
    seed: [
      { id: 'les-1', Categoria: 'positivo', Lição: 'Comitê semanal acelerou decisões', Impacto: 'alto', Votos: '8', Responsável: 'PMO', 'Ação recomendada': 'Manter rito desde Prepare', Prazo: 'Próximo projeto', Status: 'registrado' },
      { id: 'les-2', Categoria: 'melhoria', Lição: 'Dados mestres iniciaram tarde', Impacto: 'alto', Votos: '10', Responsável: 'Migração', 'Ação recomendada': 'Antecipar profiling', Prazo: 'Explore', Status: 'registrado' },
    ],
  },
  closure: {
    key: 'closure',
    phase: '5',
    title: 'Encerramento do Projeto',
    description: 'Checklist final, aceite formal, pendências residuais e transição para operação.',
    badge: 'Run',
    fields: ['Item', 'Evidência', 'Responsável', 'Data alvo', 'Assinatura', 'Pendência residual', 'Status'],
    checklist: ['Aceite formal', 'Pendências transferidas', 'Acessos revisados', 'Documentação entregue'],
    aiPrompt: 'Gere um termo de encerramento com aceite, entregáveis, pendências residuais e próximos responsáveis.',
    seed: [
      { id: 'clo-1', Item: 'Termo de aceite', Evidência: 'PDF assinado', Responsável: 'Sponsor', 'Data alvo': '2026-09-30', Assinatura: 'pendente', 'Pendência residual': '-', Status: 'pendente' },
      { id: 'clo-2', Item: 'Transferência AMS', Evidência: 'Checklist operação', Responsável: 'AMS', 'Data alvo': '2026-10-02', Assinatura: 'n/a', 'Pendência residual': 'Fila baixa prioridade', Status: 'em_andamento' },
    ],
  },
}

export default function TemplateWorkspacePage() {
  const { projectId, templateKey = 'gap' } = useParams()
  const definition = definitions[templateKey] ?? definitions.gap
  const [records, setRecords] = useLocalTemplateState<TemplateRecord[]>(`template:${projectId}:${definition.key}`, definition.seed)
  const [notes, setNotes] = useLocalTemplateState<Record<string, string>>(`template-notes:${projectId}:${definition.key}`, {
    objective: definition.description,
    assumptions: 'Dados sincronizados dos módulos anteriores e validados em rito de governança.',
    decision: 'Sem decisão final registrada.',
  })
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(definition.fields.map((field) => [field, ''])))
  const [tab, setTab] = useState<'dados' | 'checklist' | 'ia'>('dados')
  const { tasks, spiData } = useTasks(projectId, definition.phase)
  const info = PHASE_INFO[definition.phase]

  const completeCount = records.filter((record) => String(record.Status ?? record.status ?? '').match(/concluido|aprovado|registrado|planejado/i)).length
  const progress = records.length ? Math.round((completeCount / records.length) * 100) : 0
  const phaseTask = tasks.find((task) => task.title.toLowerCase().includes(definition.title.toLowerCase().split(' ')[0]))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRecords((current) => [...current, { id: `${definition.key}-${Date.now()}`, ...draft }])
    setDraft(Object.fromEntries(definition.fields.map((field) => [field, ''])))
  }

  function updateRecord(id: string, field: string, value: string) {
    setRecords((current) => current.map((record) => record.id === id ? { ...record, [field]: value } : record))
  }

  function removeRecord(id: string) {
    setRecords((current) => current.filter((record) => record.id !== id))
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="badge" style={{ background: info.color, color: '#fff' }}>{definition.badge}</span>
          <h1 className="mt-3 text-2xl font-bold text-text-primary">{definition.title}</h1>
          <p className="mt-1 text-sm text-text-secondary">{definition.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button"><FileDown className="h-4 w-4" /> Exportar</button>
          <button className="btn-primary" type="button"><Sparkles className="h-4 w-4" /> Gerar com IA</button>
        </div>
      </header>

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Kpi label="Registros" value={records.length} />
        <Kpi label="Concluídos" value={completeCount} />
        <Kpi label="Progresso" value={`${progress}%`} />
        <Kpi label="SPI fase" value={spiData.spi.toFixed(2)} />
      </section>

      <section className="card2 mb-5 grid gap-4 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-text-primary">Progresso do template</span>
            <span className="text-text-secondary">{phaseTask?.status ?? 'pendente'}</span>
          </div>
          <div className="progress-bar"><div className="progress-fill bg-brand-600" style={{ width: `${progress}%` }} /></div>
        </div>
        <div className="rounded-[8px] bg-[#0f1229] p-3 text-sm text-text-secondary">
          <strong className="text-text-primary">Nota:</strong> dados salvos localmente até a migration dedicada.
        </div>
      </section>

      <div className="mb-5 flex flex-wrap gap-2">
        <button className={`section-tab ${tab === 'dados' ? 'active' : ''}`} type="button" onClick={() => setTab('dados')}>Dados</button>
        <button className={`section-tab ${tab === 'checklist' ? 'active' : ''}`} type="button" onClick={() => setTab('checklist')}>Checklist</button>
        <button className={`section-tab ${tab === 'ia' ? 'active' : ''}`} type="button" onClick={() => setTab('ia')}>Prompt IA</button>
      </div>

      {tab === 'dados' ? (
        <section className="space-y-5">
          <form className="card" onSubmit={submit}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-text-primary">Novo registro</h2>
              <button className="btn-primary" type="submit"><Plus className="h-4 w-4" /> Adicionar</button>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {definition.fields.slice(0, 8).map((field) => (
                <label key={field}>
                  <span className="label">{field}</span>
                  <input className="input" required={field === definition.fields[0] || field === definition.fields[1]} value={draft[field] ?? ''} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} />
                </label>
              ))}
            </div>
          </form>

          <section className="card overflow-hidden p-0">
            <table className="data-table min-w-[1100px]">
              <thead><tr>{definition.fields.map((field) => <th key={field}>{field}</th>)}<th>Ações</th></tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    {definition.fields.map((field, index) => (
                      <td key={field} className={index === 0 ? 'text-text-primary' : ''}>
                        <input className="input min-w-[130px]" value={record[field] ?? ''} onChange={(event) => updateRecord(record.id, field, event.target.value)} />
                      </td>
                    ))}
                    <td><button className="btn-danger btn-sm" type="button" onClick={() => removeRecord(record.id)}><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      ) : null}

      {tab === 'checklist' ? (
        <section className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="card">
            <h2 className="mb-4 text-lg font-bold text-text-primary">Checklist de conclusão</h2>
            <div className="space-y-3">
              {definition.checklist.map((item, index) => (
                <label key={item} className="flex items-center gap-3 rounded-[8px] border border-surface-border bg-surface-card2 p-3 text-sm text-text-secondary">
                  <input defaultChecked={index < Math.ceil(definition.checklist.length * progress / 100)} type="checkbox" />
                  <CheckCircle2 className="h-4 w-4 text-ok" />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="card2">
            <h2 className="mb-3 text-lg font-bold text-text-primary">Notas e decisão</h2>
            {(['objective', 'assumptions', 'decision'] as const).map((field) => (
              <label key={field} className="mb-3 block">
                <span className="label">{field === 'objective' ? 'Objetivo' : field === 'assumptions' ? 'Premissas' : 'Decisão'}</span>
                <textarea className="input min-h-[90px]" value={notes[field] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [field]: event.target.value }))} />
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'ia' ? (
        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="ai-output-box">
            <h2 className="mb-3 text-lg font-bold text-text-primary">Prompt recomendado</h2>
            <textarea className="input min-h-[260px]" value={definition.aiPrompt} readOnly />
          </div>
          <div className="card2">
            <BarChart3 className="mb-3 h-6 w-6 text-brand-600" />
            <h2 className="font-bold text-text-primary">Contexto coletado</h2>
            <p className="mt-2 text-sm text-text-secondary">Use os registros deste template, tarefas da fase, riscos, pendências e decisões anteriores para gerar uma recomendação executiva.</p>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="card2"><span className="text-sm text-text-secondary">{label}</span><strong className="mt-2 block text-2xl text-text-primary">{value}</strong></div>
}
