import type { ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
import { Send, Paperclip } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useAI } from '@/hooks/useAI'
import { useIssues } from '@/hooks/useIssues'
import { useProject } from '@/hooks/useProjects'
import { useRisks } from '@/hooks/useRisks'
import { calcDaysToGoLive, formatBytes, PHASE_LABELS, STATUS_COLORS } from '@/lib/utils'
import type { AIProvider, ProjectContext } from '@/types'

const providers: Record<AIProvider, { label: string; model: string; color: string }> = {
  openai: { label: 'GPT-4 Turbo', model: 'gpt-4-turbo', color: '#10b981' },
  anthropic: { label: 'Claude 3.5 Sonnet', model: 'claude-3-5-sonnet-20241022', color: '#8b5cf6' },
  gemini: { label: 'Gemini 1.5 Pro', model: 'gemini-1.5-pro', color: '#3b82f6' },
}

const quickPrompts = [
  'Status do projeto',
  'Principais riscos',
  'Próximos marcos',
  'E-mail de status',
  'Resumo executivo',
  'Analisar BPDs pendentes',
  'Gerar ata de reunião',
  'Sugestões mitigação riscos',
  'Checklist Quality Gate Fase 2',
]

export default function AIAssistantPage() {
  const { projectId } = useParams()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [provider, setProvider] = useState<AIProvider>('openai')
  const [input, setInput] = useState('')
  const { data: project } = useProject(projectId)
  const { stats: issueStats } = useIssues(projectId)
  const { stats: riskStats } = useRisks(projectId)

  const projectContext = useMemo<ProjectContext | undefined>(() => project ? ({
    projectId: project.id,
    projectName: project.name,
    client: project.client,
    currentPhase: project.current_phase,
    status: project.status,
    spi: project.spi,
    progress: project.progress_pct,
    goLiveDate: project.golive_date,
    openIssues: issueStats.abertas,
    criticalRisks: riskStats.critico,
    modules: project.modules,
  }) : undefined, [issueStats.abertas, project, riskStats.critico])

  const ai = useAI({ provider, model: providers[provider].model, projectContext })

  async function send(content = input) {
    const trimmed = content.trim()
    if (!trimmed || trimmed.length > 4000) return
    setInput('')
    await ai.sendMessage(trimmed)
  }

  function attach(file?: File) {
    if (!file) return
    ai.sendMessage(`Arquivo anexado: ${file.name} (${formatBytes(file.size)}). Considere este documento na análise quando o conteúdo estiver disponível.`)
  }

  const rag = project ? STATUS_COLORS[project.status] : null

  return (
    <div className="flex h-[calc(100vh-112px)] min-h-[680px] bg-[#0f1229] text-text-primary">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-surface-border px-6 py-4">
          <h1 className="text-xl font-bold">Assistente IA</h1>
          <p className="mt-1 text-sm text-text-secondary">Contexto: {project ? `${PHASE_LABELS[project.current_phase].label} | ${providers[provider].label}` : providers[provider].label}</p>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-surface-border px-6 py-3">
          {quickPrompts.map((prompt) => (
            <button key={prompt} className="btn-secondary btn-sm shrink-0" type="button" onClick={() => send(prompt)}>
              {prompt}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {ai.messages.length === 0 ? (
            <div className="msg-ai">
              <span className="ai-label">Assistente IA - {providers[provider].label}</span>
              Olá. Tenho acesso ao contexto do projeto e posso ajudar com status executivo, riscos, BPDs, atas, e-mails e quality gates.
            </div>
          ) : null}
          {ai.messages.filter((m) => m.role !== 'system').map((message, index) => (
            <div key={index} className={message.role === 'user' ? 'msg-user ml-auto' : 'msg-ai'}>
              {message.role === 'assistant' ? <span className="ai-label">Assistente IA - {providers[provider].label}</span> : null}
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          ))}
          {ai.isLoading ? (
            <div className="msg-ai flex items-center gap-2">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          ) : null}
        </div>

        <div className="border-t border-surface-border p-4">
          <textarea
            className="input"
            maxLength={4000}
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-text-muted">{input.length}/4000 chars</span>
            <div className="flex gap-2">
              <input ref={fileRef} className="hidden" type="file" accept=".pdf,.docx,.xlsx,.txt" onChange={(event) => attach(event.target.files?.[0])} />
              <button className="btn-secondary" type="button" onClick={() => fileRef.current?.click()}><Paperclip className="h-4 w-4" /> Anexar</button>
              <button className="btn-primary" type="button" onClick={() => send()}><Send className="h-4 w-4" /> Enviar</button>
            </div>
          </div>
        </div>
      </section>

      <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-surface-border bg-[#0d1128] p-4">
        <Panel title="Contexto do Projeto">
          <KeyValue label="Projeto" value={project?.name ?? '-'} />
          <KeyValue label="Cliente" value={project?.client ?? '-'} />
          <KeyValue label="GP" value={project?.project_manager ?? '-'} />
          <KeyValue label="Fase" value={project ? PHASE_LABELS[project.current_phase].short : '-'} />
          <KeyValue label="Go-Live" value={project ? `${calcDaysToGoLive(project.golive_date)} dias` : '-'} />
          <div className="mt-2">{rag ? <span className="badge" style={{ background: rag.bg, color: rag.text }}>{project?.status}</span> : null}</div>
        </Panel>

        <Panel title="Provedor de IA">
          {(Object.keys(providers) as AIProvider[]).map((key) => (
            <button key={key} className={`mb-2 flex w-full items-center gap-2 rounded-[8px] border px-3 py-2 text-left text-sm ${provider === key ? 'border-brand-600 bg-surface-hover' : 'border-surface-border'}`} type="button" onClick={() => setProvider(key)}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: providers[key].color }} />
              {providers[key].label}
            </button>
          ))}
          <button className="btn-secondary btn-sm w-full" type="button">Configurar API Keys</button>
        </Panel>

        <Panel title="Ações Rápidas">
          {['Resumo executivo', 'Issues críticos', 'E-mail de status', 'Próximos marcos', 'Análise de prazo', 'Gerar ata'].map((action) => (
            <button key={action} className="btn-secondary btn-sm mb-2 w-full justify-start" type="button" onClick={() => send(action)}>
              {action}
            </button>
          ))}
        </Panel>

        <Panel title="Sessão">
          <KeyValue label="Modelo" value={providers[provider].model} />
          <KeyValue label="Tokens" value={String(ai.totalTokens)} />
          <KeyValue label="Status" value="Ativa" />
          <KeyValue label="Contexto" value="8k tokens" />
        </Panel>
      </aside>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mb-4 rounded-[10px] border border-surface-border bg-[#0f1229] p-3"><h2 className="mb-3 text-sm font-bold text-text-primary">{title}</h2>{children}</section>
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return <div className="mb-2 flex justify-between gap-3 text-xs"><span className="text-text-muted">{label}</span><span className="text-right text-text-secondary">{value}</span></div>
}
