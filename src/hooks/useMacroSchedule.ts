import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { macroScheduleDB } from '@/lib/database'
import {
  anonymizeSensitiveProjectText,
  getBrazilNationalHolidays,
  getHolidaysForTaskRange,
  normalizeMacroTasksForSave,
  seedMacroScheduleTasks,
  sortMacroTasks,
} from '@/lib/macroSchedule'
import { useAuthStore, useProjectStore } from '@/store'
import type { CreateMacroScheduleTaskInput, MacroScheduleHoliday, MacroScheduleHolidayInput, MacroScheduleTask } from '@/types'

function hydrateDemoTask(input: CreateMacroScheduleTaskInput, index: number): MacroScheduleTask {
  return {
    id: `demo-macro-${index + 1}`,
    tenant_id: 'demo-tenant',
    created_at: '2026-06-27T00:00:00.000Z',
    updated_at: '2026-06-27T00:00:00.000Z',
    ...input,
  }
}

function hydrateDemoHoliday(input: MacroScheduleHolidayInput, index: number): MacroScheduleHoliday {
  return {
    id: `demo-holiday-${index + 1}`,
    tenant_id: 'demo-tenant',
    created_at: '2026-06-27T00:00:00.000Z',
    updated_at: '2026-06-27T00:00:00.000Z',
    ...input,
  }
}

function demoTasksKey(projectId: string) {
  return `kynovia:macro-schedule:${projectId}:tasks`
}

function demoHolidaysKey(projectId: string) {
  return `kynovia:macro-schedule:${projectId}:holidays`
}

function readLocalItems<T>(key: string): T[] | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T[] : null
  } catch {
    return null
  }
}

function writeLocalItems<T>(key: string, items: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(items))
  } catch {
    // Local persistence is best-effort for demo/offline mode.
  }
}

function anonymizeDemoTask(task: MacroScheduleTask): MacroScheduleTask {
  return {
    ...task,
    title: anonymizeSensitiveProjectText(task.title) ?? task.title,
    squad: anonymizeSensitiveProjectText(task.squad),
    responsible: anonymizeSensitiveProjectText(task.responsible),
    notes: anonymizeSensitiveProjectText(task.notes),
  }
}

function loadDemoTasks(projectId: string) {
  const stored = readLocalItems<MacroScheduleTask>(demoTasksKey(projectId))
  return stored?.length ? stored.map(anonymizeDemoTask) : seedMacroScheduleTasks(projectId).map(hydrateDemoTask)
}

function loadDemoHolidays(projectId: string) {
  return readLocalItems<MacroScheduleHoliday>(demoHolidaysKey(projectId)) ?? []
}

export function useMacroSchedule(projectId?: string) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const activeProject = useProjectStore((s) => s.activeProject)
  const id = projectId ?? activeProject?.id
  const isDemo = user?.id === 'demo-user'
  const hasSupabaseEnv = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  const realDbEnabled = Boolean(id && hasSupabaseEnv && !isDemo)
  const localMode = !realDbEnabled
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [demoTasks, setDemoTasks] = useState<MacroScheduleTask[]>(() => loadDemoTasks(id ?? 'demo-project'))
  const [demoHolidays, setDemoHolidays] = useState<MacroScheduleHoliday[]>(() => loadDemoHolidays(id ?? 'demo-project'))

  useEffect(() => {
    if (!localMode || !id) return
    setDemoTasks(loadDemoTasks(id))
    setDemoHolidays(loadDemoHolidays(id))
  }, [id, localMode])

  const tasksQuery = useQuery({
    queryKey: ['macro-schedule', id, 'tasks'],
    queryFn: () => macroScheduleDB.listTasks(id!),
    enabled: realDbEnabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const holidaysQuery = useQuery({
    queryKey: ['macro-schedule', id, 'holidays'],
    queryFn: () => macroScheduleDB.listHolidays(id!),
    enabled: realDbEnabled,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  useEffect(() => {
    if (tasksQuery.dataUpdatedAt) setLastSyncedAt(new Date(tasksQuery.dataUpdatedAt))
  }, [tasksQuery.dataUpdatedAt])

  const tasks = useMemo(
    () => sortMacroTasks(tasksQuery.data ?? (localMode ? demoTasks : [])),
    [demoTasks, localMode, tasksQuery.data]
  )

  const holidays = useMemo(
    () => holidaysQuery.data ?? (localMode ? demoHolidays : []),
    [demoHolidays, holidaysQuery.data, localMode]
  )

  const replaceMutation = useMutation({
    mutationFn: async (nextTasks: CreateMacroScheduleTaskInput[]) => {
      if (!id) return []
      return macroScheduleDB.replaceTasks(id, nextTasks)
    },
    onSuccess: (savedTasks) => {
      setLastSyncedAt(new Date())
      qc.setQueryData(['macro-schedule', id, 'tasks'], savedTasks)
      qc.invalidateQueries({ queryKey: ['macro-schedule', id] })
    },
  })

  const holidaysMutation = useMutation({
    mutationFn: (items: MacroScheduleHolidayInput[]) => macroScheduleDB.upsertHolidays(items),
    onSuccess: () => {
      setLastSyncedAt(new Date())
      qc.invalidateQueries({ queryKey: ['macro-schedule', id, 'holidays'] })
    },
  })

  const clearHolidaysMutation = useMutation({
    mutationFn: () => macroScheduleDB.deleteHolidays(id!),
    onSuccess: () => {
      setLastSyncedAt(new Date())
      qc.invalidateQueries({ queryKey: ['macro-schedule', id, 'holidays'] })
    },
  })

  async function replaceTasks(nextTasks: (MacroScheduleTask | CreateMacroScheduleTaskInput)[], options: { preserveWbs?: boolean } = {}) {
    if (!id) return []
    const normalized = normalizeMacroTasksForSave(id, nextTasks, options)
    if (localMode) {
      const hydrated = normalized.map(hydrateDemoTask)
      setDemoTasks(hydrated)
      qc.setQueryData(['macro-schedule', id, 'tasks'], hydrated)
      writeLocalItems(demoTasksKey(id), hydrated)
      setLastSyncedAt(new Date())
      return hydrated
    }
    return replaceMutation.mutateAsync(normalized)
  }

  async function replaceWithTemplate() {
    if (!id) return
    await replaceTasks(seedMacroScheduleTasks(id))
  }

  async function addNationalHolidays(years = [2026, 2027]) {
    if (!id) return
    const items = years.flatMap((year) => getBrazilNationalHolidays(year, id))
    if (localMode) {
      const hydrated = items.map(hydrateDemoHoliday)
      setDemoHolidays(hydrated)
      writeLocalItems(demoHolidaysKey(id), hydrated)
      return
    }
    await holidaysMutation.mutateAsync(items)
  }

  async function detectAndAddHolidays() {
    if (!id) return
    const items = getHolidaysForTaskRange(id, tasks)
    if (localMode) {
      const hydrated = items.map(hydrateDemoHoliday)
      setDemoHolidays(hydrated)
      writeLocalItems(demoHolidaysKey(id), hydrated)
      return
    }
    await holidaysMutation.mutateAsync(items)
  }

  async function clearHolidays() {
    if (localMode) {
      setDemoHolidays([])
      if (id) writeLocalItems(demoHolidaysKey(id), [])
      return
    }
    await clearHolidaysMutation.mutateAsync()
  }

  async function forceSync() {
    if (localMode) {
      setLastSyncedAt(new Date())
      return
    }
    await Promise.all([tasksQuery.refetch(), holidaysQuery.refetch()])
    setLastSyncedAt(new Date())
  }

  async function clearCacheAndSync() {
    await qc.invalidateQueries({ queryKey: ['macro-schedule', id] })
    await forceSync()
  }

  return {
    tasks,
    holidays,
    holidayDates: holidays.map((item) => item.holiday_date),
    isLoading: realDbEnabled ? tasksQuery.isLoading || holidaysQuery.isLoading : false,
    error: tasksQuery.error ?? holidaysQuery.error,
    lastSyncedAt,
    isSaving: replaceMutation.isPending || holidaysMutation.isPending || clearHolidaysMutation.isPending,
    replaceTasks,
    replaceWithTemplate,
    addNationalHolidays,
    detectAndAddHolidays,
    clearHolidays,
    forceSync,
    clearCacheAndSync,
  }
}
