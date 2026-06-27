import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { macroScheduleGovernanceDB } from '@/lib/database'
import {
  buildBaselineInput,
  buildBaselineTaskInputs,
  buildSnapshotInputs,
  nextBaselineVersion,
} from '@/lib/scheduleGovernance'
import { useAuthStore, useProjectStore } from '@/store'
import type {
  CreateMacroScheduleBaselineTaskInput,
  CreateMacroScheduleSnapshotTaskInput,
  MacroScheduleBaseline,
  MacroScheduleBaselineTask,
  MacroScheduleSnapshot,
  MacroScheduleSnapshotTask,
  MacroScheduleTask,
} from '@/types'

const stamp = '2026-06-27T00:00:00.000Z'

function key(projectId: string, name: string) {
  return `kynovia:macro-governance:${projectId}:${name}`
}

function readLocalItems<T>(storageKey: string): T[] {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) as T[] : []
  } catch {
    return []
  }
}

function writeLocalItems<T>(storageKey: string, items: T[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(items))
  } catch {
    // Local persistence is best-effort for demo/offline mode.
  }
}

function localId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function hydrateBaseline(input: Omit<MacroScheduleBaseline, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): MacroScheduleBaseline {
  return {
    id: localId('baseline'),
    tenant_id: 'demo-tenant',
    created_at: stamp,
    updated_at: stamp,
    ...input,
  }
}

function hydrateBaselineTask(input: CreateMacroScheduleBaselineTaskInput): MacroScheduleBaselineTask {
  return {
    id: localId('baseline-task'),
    tenant_id: 'demo-tenant',
    created_at: stamp,
    ...input,
  }
}

function hydrateSnapshot(input: Omit<MacroScheduleSnapshot, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): MacroScheduleSnapshot {
  return {
    id: localId('snapshot'),
    tenant_id: 'demo-tenant',
    created_at: stamp,
    updated_at: stamp,
    ...input,
  }
}

function hydrateSnapshotTask(input: CreateMacroScheduleSnapshotTaskInput): MacroScheduleSnapshotTask {
  return {
    id: localId('snapshot-task'),
    tenant_id: 'demo-tenant',
    created_at: stamp,
    ...input,
  }
}

export function useScheduleGovernance(projectId?: string) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const activeProject = useProjectStore((s) => s.activeProject)
  const id = projectId ?? activeProject?.id
  const isDemo = user?.id === 'demo-user'
  const hasSupabaseEnv = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  const realDbEnabled = Boolean(id && hasSupabaseEnv && !isDemo)
  const localMode = !realDbEnabled

  const [localBaselines, setLocalBaselines] = useState<MacroScheduleBaseline[]>(() => readLocalItems(key(id ?? 'demo-project', 'baselines')))
  const [localBaselineTasks, setLocalBaselineTasks] = useState<MacroScheduleBaselineTask[]>(() => readLocalItems(key(id ?? 'demo-project', 'baseline-tasks')))
  const [localSnapshots, setLocalSnapshots] = useState<MacroScheduleSnapshot[]>(() => readLocalItems(key(id ?? 'demo-project', 'snapshots')))
  const [localSnapshotTasks, setLocalSnapshotTasks] = useState<MacroScheduleSnapshotTask[]>(() => readLocalItems(key(id ?? 'demo-project', 'snapshot-tasks')))

  useEffect(() => {
    if (!localMode || !id) return
    setLocalBaselines(readLocalItems(key(id, 'baselines')))
    setLocalBaselineTasks(readLocalItems(key(id, 'baseline-tasks')))
    setLocalSnapshots(readLocalItems(key(id, 'snapshots')))
    setLocalSnapshotTasks(readLocalItems(key(id, 'snapshot-tasks')))
  }, [id, localMode])

  const baselinesQuery = useQuery({
    queryKey: ['macro-schedule-governance', id, 'baselines'],
    queryFn: () => macroScheduleGovernanceDB.listBaselines(id!),
    enabled: realDbEnabled,
    staleTime: 10_000,
  })

  const snapshotsQuery = useQuery({
    queryKey: ['macro-schedule-governance', id, 'snapshots'],
    queryFn: () => macroScheduleGovernanceDB.listSnapshots(id!),
    enabled: realDbEnabled,
    staleTime: 10_000,
  })

  const baselines = useMemo(
    () => (baselinesQuery.data ?? (localMode ? localBaselines : [])).slice().sort((a, b) => b.version - a.version),
    [baselinesQuery.data, localBaselines, localMode]
  )

  const activeBaseline = useMemo(
    () => baselines.find((baseline) => baseline.status === 'locked') ?? null,
    [baselines]
  )

  const baselineTasksQuery = useQuery({
    queryKey: ['macro-schedule-governance', id, 'baseline-tasks', activeBaseline?.id],
    queryFn: () => macroScheduleGovernanceDB.listBaselineTasks(activeBaseline!.id),
    enabled: realDbEnabled && Boolean(activeBaseline),
    staleTime: 10_000,
  })

  const baselineTasks = useMemo(
    () => baselineTasksQuery.data ?? (localMode && activeBaseline ? localBaselineTasks.filter((task) => task.baseline_id === activeBaseline.id) : []),
    [activeBaseline, baselineTasksQuery.data, localBaselineTasks, localMode]
  )

  const snapshots = useMemo(
    () => (snapshotsQuery.data ?? (localMode ? localSnapshots : [])).slice().sort((a, b) => a.status_date.localeCompare(b.status_date)),
    [localMode, localSnapshots, snapshotsQuery.data]
  )

  const createBaselineMutation = useMutation({
    mutationFn: async ({ tasks, holidays, notes }: { tasks: MacroScheduleTask[]; holidays: string[]; notes?: string }) => {
      if (!id) throw new Error('Projeto não definido.')
      const version = nextBaselineVersion(baselines)
      const input = buildBaselineInput(id, version, tasks, holidays, notes)
      const baseline = await macroScheduleGovernanceDB.createBaseline(input)
      const baselineTasksInput = buildBaselineTaskInputs(id, baseline.id, tasks)
      const insertedTasks = baselineTasksInput.length
        ? await macroScheduleGovernanceDB.bulkInsertBaselineTasks(baselineTasksInput)
        : []
      return { baseline, baselineTasks: insertedTasks }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['macro-schedule-governance', id] })
    },
  })

  const supersedeMutation = useMutation({
    mutationFn: async () => {
      if (!id) return []
      return macroScheduleGovernanceDB.supersedeLockedBaselines(id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['macro-schedule-governance', id] })
    },
  })

  const createSnapshotMutation = useMutation({
    mutationFn: async ({ tasks, statusDate, holidays, notes }: { tasks: MacroScheduleTask[]; statusDate: string; holidays: string[]; notes?: string }) => {
      if (!id || !activeBaseline) throw new Error('Crie uma baseline antes de medir.')
      const input = buildSnapshotInputs({ projectId: id, baseline: activeBaseline, baselineTasks, currentTasks: tasks, statusDate, holidays, notes })
      const snapshot = await macroScheduleGovernanceDB.createSnapshot(input.snapshot)
      await macroScheduleGovernanceDB.deleteSnapshotTasks(snapshot.id)
      const snapshotTasks = input.tasks.map((task) => ({ ...task, snapshot_id: snapshot.id }))
      const insertedTasks = snapshotTasks.length
        ? await macroScheduleGovernanceDB.bulkInsertSnapshotTasks(snapshotTasks)
        : []
      return { snapshot, snapshotTasks: insertedTasks }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['macro-schedule-governance', id] })
    },
  })

  async function createBaselineFromTasks(tasks: MacroScheduleTask[], holidays: string[] = [], notes = '') {
    if (!id) throw new Error('Projeto não definido.')
    if (localMode) {
      const version = nextBaselineVersion(localBaselines)
      const baseline = hydrateBaseline(buildBaselineInput(id, version, tasks, holidays, notes))
      const baselineTasks = buildBaselineTaskInputs(id, baseline.id, tasks).map(hydrateBaselineTask)
      const nextBaselines = [baseline, ...localBaselines]
      const nextTasks = [...localBaselineTasks, ...baselineTasks]
      setLocalBaselines(nextBaselines)
      setLocalBaselineTasks(nextTasks)
      writeLocalItems(key(id, 'baselines'), nextBaselines)
      writeLocalItems(key(id, 'baseline-tasks'), nextTasks)
      return { baseline, baselineTasks }
    }
    return createBaselineMutation.mutateAsync({ tasks, holidays, notes })
  }

  async function supersedeActiveBaseline() {
    if (!id) return
    if (localMode) {
      const next = localBaselines.map((baseline) => baseline.status === 'locked' ? { ...baseline, status: 'superseded' as const } : baseline)
      setLocalBaselines(next)
      writeLocalItems(key(id, 'baselines'), next)
      return
    }
    await supersedeMutation.mutateAsync()
  }

  async function createSnapshotFromRows(tasks: MacroScheduleTask[], statusDate: string, holidays: string[] = [], notes = '') {
    if (!id || !activeBaseline) throw new Error('Crie uma baseline antes de medir.')
    if (localMode) {
      const input = buildSnapshotInputs({ projectId: id, baseline: activeBaseline, baselineTasks, currentTasks: tasks, statusDate, holidays, notes })
      const snapshot = hydrateSnapshot(input.snapshot)
      const snapshotTasks = input.tasks.map((task) => hydrateSnapshotTask({ ...task, snapshot_id: snapshot.id }))
      const nextSnapshots = [...localSnapshots.filter((item) => item.status_date !== statusDate), snapshot]
        .sort((a, b) => a.status_date.localeCompare(b.status_date))
      const nextSnapshotTasks = [
        ...localSnapshotTasks.filter((task) => !localSnapshots.find((item) => item.status_date === statusDate && item.id === task.snapshot_id)),
        ...snapshotTasks,
      ]
      setLocalSnapshots(nextSnapshots)
      setLocalSnapshotTasks(nextSnapshotTasks)
      writeLocalItems(key(id, 'snapshots'), nextSnapshots)
      writeLocalItems(key(id, 'snapshot-tasks'), nextSnapshotTasks)
      return { snapshot, snapshotTasks }
    }
    return createSnapshotMutation.mutateAsync({ tasks, statusDate, holidays, notes })
  }

  return {
    baselines,
    activeBaseline,
    baselineTasks,
    snapshots,
    snapshotTasks: localMode ? localSnapshotTasks : [],
    isLoading: realDbEnabled ? baselinesQuery.isLoading || snapshotsQuery.isLoading || baselineTasksQuery.isLoading : false,
    isSaving: createBaselineMutation.isPending || supersedeMutation.isPending || createSnapshotMutation.isPending,
    createBaselineFromTasks,
    supersedeActiveBaseline,
    createSnapshotFromRows,
  }
}
