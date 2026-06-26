import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { kickoffDB } from '@/lib/database'
import { useAuthStore, useProjectStore } from '@/store'
import type { Kickoff } from '@/types'

export function useKickoff(projectId?: string) {
  const qc = useQueryClient()
  const tenant = useAuthStore((s) => s.tenant)
  const activeProject = useProjectStore((s) => s.activeProject)
  const id = projectId ?? activeProject?.id

  const query = useQuery({
    queryKey: ['kickoff', id],
    queryFn: async () => {
      const { data, error } = await kickoffDB.get(id!)
      if (error) throw error
      return data as Kickoff | null
    },
    enabled: Boolean(id),
  })

  const saveMutation = useMutation({
    mutationFn: async (input: Partial<Kickoff>) => {
      const { data, error } = await kickoffDB.upsert({
        project_id: id!,
        tenant_id: tenant!.id,
        platform: 'Teams',
        duration_hours: 1,
        modality: 'remoto',
        ai_generated: false,
        ai_content: {},
        ...input,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kickoff', id] }),
  })

  return {
    kickoff: query.data,
    isLoading: query.isLoading,
    error: query.error,
    saveKickoff: saveMutation,
  }
}
