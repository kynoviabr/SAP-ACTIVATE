import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { billingDB, changeRequestsDB, costsDB, membersDB, travelsDB } from '@/lib/database'
import { useAuthStore, useProjectStore } from '@/store'
import type {
  BillingItem,
  ChangeRequest,
  CostItem,
  CreateBillingInput,
  CreateChangeRequestInput,
  CreateCostInput,
  CreateTravelInput,
  ProjectMember,
  ProjectMemberInput,
  TravelItem,
  UpdateBillingInput,
  UpdateChangeRequestInput,
  UpdateCostInput,
  UpdateTravelInput,
} from '@/types'

function useProjectContext(projectId?: string) {
  const tenant = useAuthStore((s) => s.tenant)
  const activeProject = useProjectStore((s) => s.activeProject)
  return { tenantId: tenant?.id, projectId: projectId ?? activeProject?.id }
}

export function useTeam(projectId?: string) {
  const qc = useQueryClient()
  const { projectId: id, tenantId } = useProjectContext(projectId)
  const query = useQuery({ queryKey: ['team', id], queryFn: () => membersDB.list(id!), enabled: Boolean(id), staleTime: 30_000 })
  const members = query.data ?? []

  const create = useMutation({
    mutationFn: (input: Omit<ProjectMemberInput, 'tenant_id' | 'project_id'>) =>
      membersDB.create({ ...input, tenant_id: tenantId!, project_id: id! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team', id] }),
  })
  const update = useMutation({
    mutationFn: ({ memberId, input }: { memberId: string; input: Partial<ProjectMemberInput> }) => membersDB.update(memberId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team', id] }),
  })
  const remove = useMutation({ mutationFn: (memberId: string) => membersDB.delete(memberId), onSuccess: () => qc.invalidateQueries({ queryKey: ['team', id] }) })

  return { members, isLoading: query.isLoading, create, update, remove }
}

export function useCosts(projectId?: string) {
  const qc = useQueryClient()
  const { projectId: id, tenantId } = useProjectContext(projectId)
  const query = useQuery({ queryKey: ['costs', id], queryFn: () => costsDB.list(id!), enabled: Boolean(id), staleTime: 30_000 })
  const items = query.data ?? []
  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0), [items])
  const byCategory = useMemo(() => groupSum(items, 'category'), [items])

  const create = useMutation({
    mutationFn: (input: Omit<CreateCostInput, 'project_id'>) => costsDB.create({ ...input, project_id: id!, currency: input.currency ?? 'BRL' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['costs', id] }),
  })
  const update = useMutation({ mutationFn: ({ itemId, input }: { itemId: string; input: UpdateCostInput }) => costsDB.update(itemId, input), onSuccess: () => qc.invalidateQueries({ queryKey: ['costs', id] }) })
  const remove = useMutation({ mutationFn: (itemId: string) => costsDB.delete(itemId), onSuccess: () => qc.invalidateQueries({ queryKey: ['costs', id] }) })

  return { items, total, byCategory, tenantId, isLoading: query.isLoading, create, update, remove }
}

export function useChangeRequests(projectId?: string) {
  const qc = useQueryClient()
  const { projectId: id } = useProjectContext(projectId)
  const query = useQuery({ queryKey: ['change-requests', id], queryFn: () => changeRequestsDB.list(id!), enabled: Boolean(id), staleTime: 30_000 })
  const items = query.data ?? []
  const stats = useMemo(() => ({
    abertas: items.filter((item) => item.status === 'aberta').length,
    aprovadas: items.filter((item) => item.status === 'aprovada').length,
    rejeitadas: items.filter((item) => item.status === 'rejeitada').length,
  }), [items])

  const create = useMutation({ mutationFn: (input: Omit<CreateChangeRequestInput, 'project_id'>) => changeRequestsDB.create({ ...input, project_id: id! }), onSuccess: () => qc.invalidateQueries({ queryKey: ['change-requests', id] }) })
  const update = useMutation({ mutationFn: ({ itemId, input }: { itemId: string; input: UpdateChangeRequestInput }) => changeRequestsDB.update(itemId, input), onSuccess: () => qc.invalidateQueries({ queryKey: ['change-requests', id] }) })
  const remove = useMutation({ mutationFn: (itemId: string) => changeRequestsDB.delete(itemId), onSuccess: () => qc.invalidateQueries({ queryKey: ['change-requests', id] }) })

  return { items, stats, isLoading: query.isLoading, create, update, remove }
}

export function useBilling(projectId?: string) {
  const qc = useQueryClient()
  const { projectId: id } = useProjectContext(projectId)
  const query = useQuery({ queryKey: ['billing', id], queryFn: () => billingDB.list(id!), enabled: Boolean(id), staleTime: 30_000 })
  const items = query.data ?? []
  const total = useMemo(() => items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0), [items])
  const paid = useMemo(() => items.filter((item) => item.status === 'pago').reduce((sum, item) => sum + Number(item.amount ?? 0), 0), [items])

  const create = useMutation({ mutationFn: (input: Omit<CreateBillingInput, 'project_id'>) => billingDB.create({ ...input, project_id: id!, currency: input.currency ?? 'BRL' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['billing', id] }) })
  const update = useMutation({ mutationFn: ({ itemId, input }: { itemId: string; input: UpdateBillingInput }) => billingDB.update(itemId, input), onSuccess: () => qc.invalidateQueries({ queryKey: ['billing', id] }) })
  const remove = useMutation({ mutationFn: (itemId: string) => billingDB.delete(itemId), onSuccess: () => qc.invalidateQueries({ queryKey: ['billing', id] }) })

  return { items, total, paid, pending: total - paid, isLoading: query.isLoading, create, update, remove }
}

export function useTravels(projectId?: string) {
  const qc = useQueryClient()
  const { projectId: id } = useProjectContext(projectId)
  const query = useQuery({ queryKey: ['travels', id], queryFn: () => travelsDB.list(id!), enabled: Boolean(id), staleTime: 30_000 })
  const items = query.data ?? []
  const estimated = useMemo(() => items.reduce((sum, item) => sum + Number(item.estimated_cost ?? 0), 0), [items])
  const actual = useMemo(() => items.reduce((sum, item) => sum + Number(item.actual_cost ?? 0), 0), [items])

  const create = useMutation({ mutationFn: (input: Omit<CreateTravelInput, 'project_id'>) => travelsDB.create({ ...input, project_id: id! }), onSuccess: () => qc.invalidateQueries({ queryKey: ['travels', id] }) })
  const update = useMutation({ mutationFn: ({ itemId, input }: { itemId: string; input: UpdateTravelInput }) => travelsDB.update(itemId, input), onSuccess: () => qc.invalidateQueries({ queryKey: ['travels', id] }) })
  const remove = useMutation({ mutationFn: (itemId: string) => travelsDB.delete(itemId), onSuccess: () => qc.invalidateQueries({ queryKey: ['travels', id] }) })

  return { items, estimated, actual, isLoading: query.isLoading, create, update, remove }
}

function groupSum(items: CostItem[], key: keyof CostItem) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const label = String(item[key] ?? 'Sem categoria')
    acc[label] = (acc[label] ?? 0) + Number(item.amount ?? 0)
    return acc
  }, {})
}

export type { BillingItem, ChangeRequest, CostItem, ProjectMember, TravelItem }
