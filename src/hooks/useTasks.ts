import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksDB } from '@/lib/database'
import { useAuthStore, useProjectStore } from '@/store'
import type { CreateTaskInput, PhaseNumber, Task, UpdateTaskInput } from '@/types'

export function useTasks(projectId?: string, phase?: PhaseNumber) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const activeProject = useProjectStore((s) => s.activeProject)
  const id = projectId ?? activeProject?.id
  const hasSupabaseEnv = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

  const query = useQuery({
    queryKey: ['tasks', id, phase],
    queryFn: () => phase ? tasksDB.listByPhase(id!, phase) : tasksDB.list(id!),
    enabled: Boolean(id) && hasSupabaseEnv,
    staleTime: 30_000,
  })

  const fallbackTasks = useMemo(() => {
    if (hasSupabaseEnv || user?.id !== 'demo-user') return []
    return seedTasks(id ?? 'demo-project').filter((task) => !phase || task.phase === phase)
  }, [hasSupabaseEnv, id, phase, user?.id])
  const tasks = query.data ?? fallbackTasks
  const spiData = useMemo(() => calculateSPI(tasks), [tasks])

  const createMutation = useMutation({
    mutationFn: (input: CreateTaskInput) => tasksDB.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id: taskId, input }: { id: string; input: UpdateTaskInput }) =>
      tasksDB.update(taskId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => tasksDB.delete(taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  return {
    tasks,
    isLoading: hasSupabaseEnv ? query.isLoading : false,
    error: query.error,
    refetch: query.refetch,
    spiData,
    createTask: createMutation,
    updateTask: updateMutation,
    deleteTask: deleteMutation,
  }
}

function seedTasks(projectId: string): Task[] {
  const now = '2026-06-26T00:00:00.000Z'
  const rows: Array<Pick<Task, 'wbs' | 'title' | 'phase' | 'type' | 'start_date' | 'end_date' | 'assignee' | 'status' | 'progress_pct' | 'planned_hours' | 'actual_hours' | 'sort_order'>> = [
    { wbs: '1.0', title: 'Prepare', phase: '1', type: 'phase', start_date: '2026-06-01', end_date: '2026-06-21', assignee: 'PMO', status: 'em_andamento', progress_pct: 80, planned_hours: 80, actual_hours: 64, sort_order: 10 },
    { wbs: '1.1', title: 'Kickoff do Projeto', phase: '1', type: 'milestone', start_date: '2026-06-03', end_date: '2026-06-03', assignee: 'GP', status: 'concluido', progress_pct: 100, planned_hours: 8, actual_hours: 8, sort_order: 11 },
    { wbs: '1.2', title: 'Cronograma Macro', phase: '1', type: 'task', start_date: '2026-06-04', end_date: '2026-06-10', assignee: 'PMO', status: 'em_andamento', progress_pct: 70, planned_hours: 24, actual_hours: 18, sort_order: 12 },
    { wbs: '1.3', title: 'Definição de Escopo', phase: '1', type: 'task', start_date: '2026-06-07', end_date: '2026-06-14', assignee: 'Arquitetura', status: 'em_andamento', progress_pct: 55, planned_hours: 32, actual_hours: 18, sort_order: 13 },
    { wbs: '1.4', title: 'Organização e Comunicação', phase: '1', type: 'task', start_date: '2026-06-12', end_date: '2026-06-18', assignee: 'PMO', status: 'pendente', progress_pct: 25, planned_hours: 20, actual_hours: 5, sort_order: 14 },
    { wbs: '1.5', title: 'Quality Gate Fase 1', phase: '1', type: 'milestone', start_date: '2026-06-21', end_date: '2026-06-21', assignee: 'Sponsor', status: 'pendente', progress_pct: 0, planned_hours: 8, actual_hours: 0, sort_order: 15 },
    { wbs: '2.0', title: 'Explore', phase: '2', type: 'phase', start_date: '2026-06-22', end_date: '2026-07-19', assignee: 'Líderes', status: 'pendente', progress_pct: 20, planned_hours: 160, actual_hours: 20, sort_order: 20 },
    { wbs: '2.1', title: 'SOW / BPD', phase: '2', type: 'task', start_date: '2026-06-24', end_date: '2026-07-08', assignee: 'Consultores', status: 'em_andamento', progress_pct: 35, planned_hours: 80, actual_hours: 24, sort_order: 21 },
    { wbs: '2.2', title: 'GAP Analysis', phase: '2', type: 'task', start_date: '2026-07-02', end_date: '2026-07-12', assignee: 'Arquitetura', status: 'em_andamento', progress_pct: 30, planned_hours: 48, actual_hours: 16, sort_order: 22 },
    { wbs: '2.3', title: 'Cronograma Detalhado', phase: '2', type: 'task', start_date: '2026-07-08', end_date: '2026-07-16', assignee: 'PMO', status: 'pendente', progress_pct: 10, planned_hours: 32, actual_hours: 4, sort_order: 23 },
    { wbs: '2.4', title: 'Quality Gate Fase 2', phase: '2', type: 'milestone', start_date: '2026-07-19', end_date: '2026-07-19', assignee: 'Sponsor', status: 'pendente', progress_pct: 0, planned_hours: 8, actual_hours: 0, sort_order: 24 },
    { wbs: '3.0', title: 'Realize', phase: '3', type: 'phase', start_date: '2026-07-20', end_date: '2026-08-23', assignee: 'Squads', status: 'pendente', progress_pct: 0, planned_hours: 220, actual_hours: 0, sort_order: 30 },
    { wbs: '3.1', title: 'Plano de Execução', phase: '3', type: 'task', start_date: '2026-07-20', end_date: '2026-08-05', assignee: 'Squads', status: 'pendente', progress_pct: 0, planned_hours: 72, actual_hours: 0, sort_order: 31 },
    { wbs: '3.2', title: 'Requests SAP', phase: '3', type: 'task', start_date: '2026-07-24', end_date: '2026-08-10', assignee: 'BASIS', status: 'pendente', progress_pct: 0, planned_hours: 32, actual_hours: 0, sort_order: 32 },
    { wbs: '3.3', title: 'Plano de Testes', phase: '3', type: 'task', start_date: '2026-08-01', end_date: '2026-08-15', assignee: 'QA', status: 'pendente', progress_pct: 0, planned_hours: 56, actual_hours: 0, sort_order: 33 },
    { wbs: '3.4', title: 'Controle de Bugs', phase: '3', type: 'task', start_date: '2026-08-05', end_date: '2026-08-20', assignee: 'QA', status: 'pendente', progress_pct: 0, planned_hours: 40, actual_hours: 0, sort_order: 34 },
    { wbs: '3.5', title: 'Status Report', phase: '3', type: 'task', start_date: '2026-07-20', end_date: '2026-08-23', assignee: 'PMO', status: 'pendente', progress_pct: 0, planned_hours: 20, actual_hours: 0, sort_order: 35 },
    { wbs: '3.6', title: 'Monitoramento', phase: '3', type: 'task', start_date: '2026-07-20', end_date: '2026-08-23', assignee: 'PMO', status: 'pendente', progress_pct: 0, planned_hours: 24, actual_hours: 0, sort_order: 36 },
    { wbs: '3.7', title: 'Quality Gate Fase 3', phase: '3', type: 'milestone', start_date: '2026-08-23', end_date: '2026-08-23', assignee: 'Sponsor', status: 'pendente', progress_pct: 0, planned_hours: 8, actual_hours: 0, sort_order: 37 },
    { wbs: '4.0', title: 'Deploy', phase: '4', type: 'phase', start_date: '2026-08-24', end_date: '2026-09-20', assignee: 'PMO', status: 'pendente', progress_pct: 0, planned_hours: 120, actual_hours: 0, sort_order: 40 },
    { wbs: '4.1', title: 'Runbook Cutover', phase: '4', type: 'task', start_date: '2026-08-24', end_date: '2026-09-10', assignee: 'PMO/BASIS', status: 'pendente', progress_pct: 0, planned_hours: 44, actual_hours: 0, sort_order: 41 },
    { wbs: '4.2', title: 'Testes Finais UAT', phase: '4', type: 'task', start_date: '2026-08-28', end_date: '2026-09-12', assignee: 'Key-users', status: 'pendente', progress_pct: 0, planned_hours: 48, actual_hours: 0, sort_order: 42 },
    { wbs: '4.3', title: 'Plano de Transição', phase: '4', type: 'task', start_date: '2026-09-05', end_date: '2026-09-18', assignee: 'Change/AMS', status: 'pendente', progress_pct: 0, planned_hours: 28, actual_hours: 0, sort_order: 43 },
    { wbs: '4.4', title: 'Quality Gate Fase 4', phase: '4', type: 'milestone', start_date: '2026-09-20', end_date: '2026-09-20', assignee: 'Sponsor', status: 'pendente', progress_pct: 0, planned_hours: 8, actual_hours: 0, sort_order: 44 },
    { wbs: '5.0', title: 'Run', phase: '5', type: 'phase', start_date: '2026-09-21', end_date: '2026-09-30', assignee: 'AMS', status: 'pendente', progress_pct: 0, planned_hours: 60, actual_hours: 0, sort_order: 50 },
    { wbs: '5.1', title: 'Hypercare', phase: '5', type: 'task', start_date: '2026-09-21', end_date: '2026-10-20', assignee: 'AMS', status: 'pendente', progress_pct: 0, planned_hours: 80, actual_hours: 0, sort_order: 51 },
    { wbs: '5.2', title: 'Lições Aprendidas', phase: '5', type: 'task', start_date: '2026-09-25', end_date: '2026-10-05', assignee: 'PMO', status: 'pendente', progress_pct: 0, planned_hours: 12, actual_hours: 0, sort_order: 52 },
    { wbs: '5.3', title: 'Encerramento', phase: '5', type: 'task', start_date: '2026-09-28', end_date: '2026-10-08', assignee: 'GP/Sponsor', status: 'pendente', progress_pct: 0, planned_hours: 24, actual_hours: 0, sort_order: 53 },
    { wbs: '5.4', title: 'Quality Gate Fase 5', phase: '5', type: 'milestone', start_date: '2026-10-08', end_date: '2026-10-08', assignee: 'Sponsor', status: 'pendente', progress_pct: 0, planned_hours: 8, actual_hours: 0, sort_order: 54 },
  ]

  return rows.map((row, index) => ({
    id: `demo-task-${index + 1}`,
    tenant_id: 'demo-tenant',
    project_id: projectId,
    created_at: now,
    updated_at: now,
    parent_id: undefined,
    duration_days: row.start_date && row.end_date ? Math.max(1, (new Date(`${row.end_date}T12:00:00`).getTime() - new Date(`${row.start_date}T12:00:00`).getTime()) / 86_400_000 + 1) : undefined,
    dependencies: [],
    notes: '',
    ...row,
  }))
}

function calculateSPI(tasks: Task[]) {
  const today = new Date()
  let bcwp = 0
  let bcws = 0

  tasks.filter((task) => task.type !== 'phase').forEach((task) => {
    if (!task.start_date || !task.end_date || !task.planned_hours) return
    const start = new Date(`${task.start_date}T12:00:00`)
    const end = new Date(`${task.end_date}T12:00:00`)
    const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86_400_000 + 1)
    const elapsedDays = Math.min(Math.max(0, (today.getTime() - start.getTime()) / 86_400_000 + 1), totalDays)

    bcwp += task.planned_hours * ((task.progress_pct ?? 0) / 100)
    if (today >= start) bcws += task.planned_hours * (elapsedDays / totalDays)
  })

  return {
    spi: bcws > 0 ? Math.round((bcwp / bcws) * 100) / 100 : 1,
    bcwp,
    bcws,
  }
}
