import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bpdDB } from '@/lib/database'
import { useProjectStore } from '@/store'
import type { BPDItem, CreateBPDInput, UpdateBPDInput } from '@/types'

export function useBPD(projectId?: string) {
  const qc = useQueryClient()
  const activeProject = useProjectStore((s) => s.activeProject)
  const id = projectId ?? activeProject?.id

  const query = useQuery({
    queryKey: ['bpd', id],
    queryFn: () => bpdDB.list(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
  })

  const items = query.data ?? []
  const stats = useMemo(() => ({
    total: items.length,
    concluidos: items.filter((i) => i.status === 'concluido').length,
    em_andamento: items.filter((i) => i.status === 'em_andamento').length,
    pendentes: items.filter((i) => i.status === 'pendente').length,
  }), [items])

  const createMutation = useMutation({
    mutationFn: (input: CreateBPDInput) => bpdDB.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bpd', id] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id: itemId, input }: { id: string; input: UpdateBPDInput }) =>
      bpdDB.update(itemId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bpd', id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => bpdDB.delete(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bpd', id] }),
  })

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    stats,
    createBPD: createMutation,
    updateBPD: updateMutation,
    deleteBPD: deleteMutation,
  }
}

export function filterBPDItems(items: BPDItem[], search: string, module: string, status: string) {
  const term = search.trim().toLowerCase()
  return items.filter((item) => {
    const haystack = `${item.bpd_id} ${item.process_name} ${item.module} ${item.consultant ?? ''}`.toLowerCase()
    return (!term || haystack.includes(term)) && (!module || item.module === module) && (!status || item.status === status)
  })
}
