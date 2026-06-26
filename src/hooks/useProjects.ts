import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectsDB } from '@/lib/database'
import { useAuthStore, useProjectStore } from '@/store'
import type { CreateProjectInput, Project, UpdateProjectInput } from '@/types'

export function useProjects() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const storeProjects = useProjectStore((s) => s.projects)
  const activeProject = useProjectStore((s) => s.activeProject)
  const setProjects = useProjectStore((s) => s.setProjects)
  const setActiveProject = useProjectStore((s) => s.setActiveProject)
  const hasSupabaseEnv = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  const isDemo = user?.id === 'demo-user'
  const realDbEnabled = hasSupabaseEnv && !isDemo
  const demoProject = useMemo<Project | null>(() => {
    if (!isDemo) return null
    return {
      id: 'demo-project',
      tenant_id: 'demo-tenant',
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-26T00:00:00.000Z',
      name: 'Projeto Demo SAP Activate',
      client: 'Cliente Demo',
      project_manager: 'Usuário Demo',
      sponsor: 'Sponsor Demo',
      sponsor_email: 'sponsor@sap.local',
      objective: 'Implantação SAP S/4HANA com metodologia SAP Activate.',
      methodology: 'SAP Activate',
      current_phase: '2',
      status: 'verde',
      start_date: '2026-06-01',
      golive_date: '2026-09-30',
      spi: 0.98,
      cpi: 1.02,
      progress_pct: 38,
      planned_value: 100000,
      earned_value: 38000,
      actual_cost: 36000,
      modules: ['FI', 'CO', 'MM', 'SD'],
      tags: ['demo', 'activate'],
      active: true,
      archived: false,
      created_by: 'demo-user',
    }
  }, [isDemo])

  const query = useQuery({
    queryKey: ['projects'],
    queryFn: projectsDB.getSummaries,
    enabled: realDbEnabled,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (query.data) setProjects(query.data)
  }, [query.data, setProjects])

  useEffect(() => {
    if (!query.data && !storeProjects.length && !activeProject && demoProject) {
      setProjects([demoProject])
      setActiveProject(demoProject)
    }
  }, [activeProject, demoProject, query.data, setActiveProject, setProjects, storeProjects.length])

  const offlineProjects = storeProjects.length ? storeProjects : activeProject ? [activeProject] : demoProject ? [demoProject] : []
  const projects = query.data ?? offlineProjects

  const createMutation = useMutation({
    mutationFn: (input: CreateProjectInput) => projectsDB.create(input),
    onSuccess: (project) => {
      setActiveProject(project)
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      projectsDB.update(id, input),
    onSuccess: (project) => {
      setActiveProject(project)
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['project', project.id] })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => projectsDB.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  return {
    projects,
    filteredProjects: projects,
    isLoading: realDbEnabled ? query.isLoading : false,
    isFetching: realDbEnabled ? query.isFetching : false,
    error: query.error,
    refetch: query.refetch,
    createProject: createMutation,
    updateProject: updateMutation,
    archiveProject: archiveMutation,
    setActiveProject,
  }
}

export function useProject(projectId?: string) {
  return useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => projectsDB.get(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  })
}
