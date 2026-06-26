import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { risksDB } from '@/lib/database'
import { calcExposure, getSeverity } from '@/lib/utils'
import { useProjectStore } from '@/store'
import type { CreateRiskInput, Risk, RiskCategory, RiskSeverity, RiskStatus, UpdateRiskInput } from '@/types'

export type RiskFilters = {
  status?: RiskStatus | ''
  category?: RiskCategory | ''
  severity?: RiskSeverity | ''
  assignee?: string
  search?: string
}

export function calculateRiskScore(input: Partial<Pick<Risk, 'impact' | 'probability'>>) {
  return calcExposure(Number(input.impact ?? 1), Number(input.probability ?? 1))
}

function matches(risk: Risk, filters: RiskFilters) {
  const search = (filters.search ?? '').trim().toLowerCase()
  const haystack = `${risk.code} ${risk.description} ${risk.assignee ?? ''} ${risk.mitigation ?? ''}`.toLowerCase()

  return (
    (!filters.status || risk.status === filters.status) &&
    (!filters.category || risk.category === filters.category) &&
    (!filters.severity || risk.severity === filters.severity) &&
    (!filters.assignee || (risk.assignee ?? '').toLowerCase().includes(filters.assignee.toLowerCase())) &&
    (!search || haystack.includes(search))
  )
}

export function useRisks(projectId?: string, filters: RiskFilters = {}) {
  const qc = useQueryClient()
  const activeProject = useProjectStore((s) => s.activeProject)
  const id = projectId ?? activeProject?.id

  const query = useQuery({
    queryKey: ['risks', id],
    queryFn: () => risksDB.list(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
  })

  const risks = query.data ?? []
  const filteredRisks = useMemo(() => risks.filter((risk) => matches(risk, filters)), [risks, filters])
  const stats = useMemo(() => ({
    total: risks.length,
    baixo: risks.filter((r) => getSeverity(r.exposure) === 'baixo').length,
    medio: risks.filter((r) => getSeverity(r.exposure) === 'medio').length,
    alto: risks.filter((r) => getSeverity(r.exposure) === 'alto').length,
    critico: risks.filter((r) => getSeverity(r.exposure) === 'critico').length,
  }), [risks])

  const createMutation = useMutation({
    mutationFn: (input: CreateRiskInput) => risksDB.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risks', id] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id: riskId, input }: { id: string; input: UpdateRiskInput }) =>
      risksDB.update(riskId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risks', id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (riskId: string) => risksDB.delete(riskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risks', id] }),
  })

  return {
    risks,
    filteredRisks,
    stats,
    summary: {
      total: stats.total,
      low: stats.baixo,
      medium: stats.medio,
      high: stats.alto,
      critical: stats.critico,
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    createRisk: createMutation,
    updateRisk: updateMutation,
    deleteRisk: deleteMutation,
  }
}
