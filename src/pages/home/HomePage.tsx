import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Briefcase, Filter, Plus, Search, ShieldAlert } from 'lucide-react'
import ProjectCard from '@/components/project/ProjectCard'
import { useProjects } from '@/hooks/useProjects'
import { useProjectStore } from '@/store'
import type { Project, ProjectStatus, PhaseNumber } from '@/types'

export default function HomePage() {
  const navigate = useNavigate()
  const { projects, isLoading, archiveProject, setActiveProject } = useProjects()
  const activeProject = useProjectStore((s) => s.activeProject)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ProjectStatus | ''>('')
  const [phase, setPhase] = useState<PhaseNumber | ''>('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return projects.filter((project) => {
      const haystack = `${project.name} ${project.client} ${project.project_manager}`.toLowerCase()
      return (!term || haystack.includes(term)) && (!status || project.status === status) && (!phase || project.current_phase === phase)
    })
  }, [phase, projects, search, status])

  const summary = useMemo(() => ({
    total: projects.length,
    active: projects.filter((project) => project.active && !project.archived).length,
    red: projects.filter((project) => project.status === 'vermelho').length,
    avgProgress: projects.length ? Math.round(projects.reduce((sum, project) => sum + project.progress_pct, 0) / projects.length) : 0,
  }), [projects])

  function openProject(project: Project) {
    setActiveProject(project)
    navigate(`/projects/${project.id}/dashboard`)
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-600">KYNOVIA PROJECT MANAGEMENT</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Meus Projetos</h1>
          <p className="mt-1 text-sm text-text-secondary">SAP Activate Methodology</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="badge badge-blue">{filtered.length} exibidos</span>
          <button className="btn-secondary" type="button" onClick={() => setFiltersOpen((open) => !open)}>
            <Filter className="h-4 w-4" />
            Filtrar
          </button>
          <button className="btn-primary" type="button" onClick={() => navigate('/projects/new/configure')}>
            <Plus className="h-4 w-4" />
            Novo Projeto
          </button>
        </div>
      </header>

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Summary label="Projetos" value={summary.total} icon={<Briefcase className="h-4 w-4" />} />
        <Summary label="Ativos" value={summary.active} icon={<Briefcase className="h-4 w-4" />} />
        <Summary label="RAG vermelho" value={summary.red} icon={<ShieldAlert className="h-4 w-4" />} />
        <Summary label="Progresso médio" value={`${summary.avgProgress}%`} icon={<BarChart3 className="h-4 w-4" />} />
      </section>

      {filtersOpen ? (
        <section className="card2 mb-5 grid gap-3 md:grid-cols-[1fr_180px_180px] md:items-end">
          <label>
            <span className="label">Busca</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
              <input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </label>
          <label>
            <span className="label">Status</span>
            <select className="input" value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus | '')}>
              <option value="">Todos</option>
              <option value="verde">Verde</option>
              <option value="amarelo">Amarelo</option>
              <option value="vermelho">Vermelho</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </label>
          <label>
            <span className="label">Fase</span>
            <select className="input" value={phase} onChange={(event) => setPhase(event.target.value as PhaseNumber | '')}>
              <option value="">Todas</option>
              <option value="1">1 Prepare</option>
              <option value="2">2 Explore</option>
              <option value="3">3 Realize</option>
              <option value="4">4 Deploy</option>
              <option value="5">5 Run</option>
            </select>
          </label>
        </section>
      ) : null}

      {isLoading ? (
        <div className="card text-text-secondary">Carregando projetos...</div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              active={activeProject?.id === project.id}
              onOpen={openProject}
              onArchive={(item) => archiveProject.mutate(item.id)}
              onTrash={(item) => archiveProject.mutate(item.id)}
            />
          ))}
        </section>
      )}

      {activeProject ? (
        <section className="card mt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="badge badge-blue">Projeto ativo</span>
              <h2 className="mt-3 text-xl font-bold text-text-primary">{activeProject.name}</h2>
              <p className="mt-1 text-sm text-text-secondary">{activeProject.client} - Fase {activeProject.current_phase}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary btn-sm" type="button" onClick={() => navigate(`/projects/${activeProject.id}/issues`)}>Pendências</button>
              <button className="btn-secondary btn-sm" type="button" onClick={() => navigate(`/projects/${activeProject.id}/risks`)}>Riscos</button>
              <button className="btn-secondary btn-sm" type="button" onClick={() => navigate(`/projects/${activeProject.id}/team`)}>Equipe</button>
              <button className="btn-secondary btn-sm" type="button" onClick={() => navigate(`/projects/${activeProject.id}/costs`)}>Custos</button>
              <button className="btn-secondary btn-sm" type="button" onClick={() => navigate(`/projects/${activeProject.id}/change-requests`)}>CRs</button>
              <button className="btn-secondary btn-sm" type="button" onClick={() => navigate(`/projects/${activeProject.id}/billing`)}>Faturamento</button>
              <button className="btn-secondary btn-sm" type="button" onClick={() => navigate(`/projects/${activeProject.id}/travels`)}>Viagens</button>
              <button className="btn-secondary btn-sm" type="button" onClick={() => navigate(`/projects/${activeProject.id}/bpd`)}>BPD</button>
              <button className="btn-secondary btn-sm" type="button" onClick={() => navigate(`/projects/${activeProject.id}/assistant`)}>IA</button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Summary({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="card2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="rounded-[8px] bg-[#0f1229] p-2 text-brand-600">{icon}</span>
      </div>
      <strong className="mt-3 block text-2xl text-text-primary">{value}</strong>
    </div>
  )
}
