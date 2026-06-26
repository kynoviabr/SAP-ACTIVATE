import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, FileText, UploadCloud } from 'lucide-react'
import { useKickoff } from '@/hooks/useKickoff'
import { useProject } from '@/hooks/useProjects'
import { useScopeTemplate } from '@/hooks/usePrepareTemplateState'
import { useProjectStore } from '@/store'
import { formatBytes } from '@/lib/utils'

export default function ScopeDefinitionPage() {
  const { projectId } = useParams()
  const activeProject = useProjectStore((s) => s.activeProject)
  const { data } = useProject(projectId)
  const project = data ?? activeProject
  const { kickoff } = useKickoff(projectId)
  const [scope, setScope] = useScopeTemplate(projectId)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    if (!project && !kickoff) return
    setScope((current) => ({
      ...current,
      objective: project?.objective || current.objective,
      scope: String((kickoff as any)?.scope ?? current.scope),
      deliverables: String((kickoff as any)?.deliverables ?? current.deliverables),
    }))
  }, [kickoff, project, setScope])

  const cards = useMemo(() => [
    { title: 'Resumo do Escopo', value: scope.scope },
    { title: 'Premissas', value: scope.assumptions },
    { title: 'Entregáveis', value: scope.deliverables },
    { title: 'Critérios de Aceite', value: scope.acceptance },
  ], [scope])

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setUploadError(null)
    if (!file) return
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    const extensionAllowed = /\.(pdf|docx|txt)$/i.test(file.name)
    if (!allowed.includes(file.type) && !extensionAllowed) {
      setUploadError('Formato não suportado. Use PDF, DOCX ou TXT.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Arquivo acima de 10MB.')
      return
    }
    setScope((current) => ({ ...current, fileName: file.name, fileSize: file.size }))
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="badge badge-blue">Fase 1 - Prepare</span>
          <h1 className="mt-3 text-2xl font-bold text-text-primary">Definição de Escopo</h1>
          <p className="mt-1 text-sm text-text-secondary">Baseline de escopo, premissas e documentos para aprovação da fase.</p>
        </div>
        <span className="badge badge-green"><CheckCircle2 className="h-3.5 w-3.5" /> Auto-save local</span>
      </header>

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Kpi label="Projeto" value={project?.name ?? 'Projeto'} />
        <Kpi label="Cliente" value={project?.client ?? 'Cliente'} />
        <Kpi label="Módulos" value={project?.modules?.join(', ') || 'FI, CO, MM, SD'} />
        <Kpi label="Documento" value={scope.fileName ? 'Anexado' : 'Pendente'} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((card) => (
            <article key={card.title} className="card2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-text-primary">{card.title}</h2>
                <span className="badge badge-gray">Sincronizado</span>
              </div>
              <textarea className="input min-h-[180px]" readOnly value={card.value} />
            </article>
          ))}
        </div>

        <aside className="space-y-5">
          <section className="card">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-[8px] bg-[#0f1229] p-2 text-brand-600"><UploadCloud className="h-5 w-5" /></span>
              <div>
                <h2 className="font-bold text-text-primary">Documento de escopo</h2>
                <p className="text-xs text-text-muted">PDF, DOCX ou TXT até 10MB.</p>
              </div>
            </div>
            <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-[8px] border border-dashed border-surface-border bg-[#0f1229] p-6 text-center transition hover:border-brand-600">
              <FileText className="mb-3 h-8 w-8 text-brand-600" />
              <span className="text-sm font-semibold text-text-primary">Selecionar documento</span>
              <span className="mt-1 text-xs text-text-muted">Upload local preparado para Supabase Storage</span>
              <input className="sr-only" type="file" accept=".pdf,.docx,.txt" onChange={handleUpload} />
            </label>
            {uploadError ? <p className="mt-3 text-sm text-danger">{uploadError}</p> : null}
            {scope.fileName ? (
              <div className="mt-4 rounded-[8px] border border-surface-border bg-surface-card2 p-3">
                <p className="font-semibold text-text-primary">{scope.fileName}</p>
                <p className="text-xs text-text-muted">{formatBytes(scope.fileSize ?? 0)}</p>
              </div>
            ) : null}
          </section>

          <section className="card2">
            <h2 className="text-lg font-bold text-text-primary">Exclusões</h2>
            <textarea className="input mt-3 min-h-[120px]" value={scope.exclusions} onChange={(event) => setScope((current) => ({ ...current, exclusions: event.target.value }))} />
          </section>

          <section className="ai-output-box">
            <h2 className="mb-2 font-bold text-text-primary">Prompt IA</h2>
            <p className="text-sm text-text-secondary">Use o documento anexado e o baseline acima para identificar riscos de escopo, lacunas e pontos de aceite antes do Quality Gate Fase 1.</p>
          </section>
        </aside>
      </section>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="card2"><span className="text-sm text-text-secondary">{label}</span><strong className="mt-2 block truncate text-lg text-text-primary">{value}</strong></div>
}
