import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { macroScheduleDB } from '@/lib/database'
import {
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

export function useMacroSchedule(projectId?: string) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const activeProject = useProjectStore((s) => s.activeProject)
  const id = projectId ?? activeProject?.id
  const isDemo = user?.id === 'demo-user'
  const hasSupabaseEnv = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  const realDbEnabled = Boolean(id && hasSupabaseEnv && !isDemo)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [demoTasks, setDemoTasks] = useState<MacroScheduleTask[]>(() =>
    seedMacroScheduleTasks(id ?? 'demo-project').map(hydrateDemoTask)
  )
  const [demoHolidays, setDemoHolidays] = useState<MacroScheduleHoliday[]>([])

  useEffect(() => {
    if (!isDemo || !id) return
    setDemoTasks(seedMacroScheduleTasks(id).map(hydrateDemoTask))
  }, [id, isDemo])

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
    () => sortMacroTasks(tasksQuery.data ?? (isDemo ? demoTasks : [])),
    [demoTasks, isDemo, tasksQuery.data]
  )

  const holidays = useMemo(
    () => holidaysQuery.data ?? (isDemo ? demoHolidays : []),
    [demoHolidays, holidaysQuery.data, isDemo]
  )

  const replaceMutation = useMutation({
    mutationFn: async (nextTasks: CreateMacroScheduleTaskInput[]) => {
      if (!id) return []
      return macroScheduleDB.replaceTasks(id, nextTasks)
    },
    onSuccess: () => {
      setLastSyncedAt(new Date())
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

  async function replaceTasks(nextTasks: (MacroScheduleTask | CreateMacroScheduleTaskInput)[]) {
    if (!id) return
    const normalized = normalizeMacroTasksForSave(id, nextTasks)
    if (isDemo || !realDbEnabled) {
      setDemoTasks(normalized.map(hydrateDemoTask))
      setLastSyncedAt(new Date())
      return
    }
    await replaceMutation.mutateAsync(normalized)
  }

  async function replaceWithTemplate() {
    if (!id) return
    await replaceTasks(seedMacroScheduleTasks(id))
  }

  async function addNationalHolidays(years = [2026, 2027]) {
    if (!id) return
    const items = years.flatMap((year) => getBrazilNationalHolidays(year, id))
    if (isDemo || !realDbEnabled) {
      setDemoHolidays(items.map(hydrateDemoHoliday))
      return
    }
    await holidaysMutation.mutateAsync(items)
  }

  async function detectAndAddHolidays() {
    if (!id) return
    const items = getHolidaysForTaskRange(id, tasks)
    if (isDemo || !realDbEnabled) {
      setDemoHolidays(items.map(hydrateDemoHoliday))
      return
    }
    await holidaysMutation.mutateAsync(items)
  }

  async function clearHolidays() {
    if (isDemo || !realDbEnabled) {
      setDemoHolidays([])
      return
    }
    await clearHolidaysMutation.mutateAsync()
  }

  async function forceSync() {
    if (!realDbEnabled) {
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
