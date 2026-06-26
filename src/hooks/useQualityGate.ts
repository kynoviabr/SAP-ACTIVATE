import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qualityGateDB } from '@/lib/database'
import { useAuthStore, useProjectStore } from '@/store'
import type { PhaseNumber, QGAnswerType } from '@/types'

export function useQualityGate(projectId?: string, phase?: PhaseNumber) {
  const qc = useQueryClient()
  const tenant = useAuthStore((s) => s.tenant)
  const activeProject = useProjectStore((s) => s.activeProject)
  const activePhase = useProjectStore((s) => s.activePhase)
  const id = projectId ?? activeProject?.id
  const phaseId = phase ?? activePhase

  const templatesQuery = useQuery({
    queryKey: ['qg-templates', phaseId],
    queryFn: async () => {
      const { data, error } = await qualityGateDB.getTemplates(phaseId)
      if (error) throw error
      return data ?? []
    },
    staleTime: 300_000,
  })

  const answersQuery = useQuery({
    queryKey: ['qg-answers', id, phaseId],
    queryFn: async () => {
      const { data, error } = await qualityGateDB.getAnswers(id!, phaseId)
      if (error) throw error
      return data ?? []
    },
    enabled: Boolean(id),
  })

  const decisionQuery = useQuery({
    queryKey: ['qg-decision', id, phaseId],
    queryFn: async () => {
      const { data, error } = await qualityGateDB.getDecision(id!, phaseId)
      if (error) throw error
      return data
    },
    enabled: Boolean(id),
  })

  const templates = templatesQuery.data ?? []
  const answers = answersQuery.data ?? []
  const answerMap = useMemo(() => Object.fromEntries(answers.map((answer) => [answer.template_id, answer])), [answers])
  const stats = useMemo(() => {
    const total = templates.length
    const classified = templates.filter((item) => answerMap[item.id]).length
    const atendidos = templates.filter((item) => answerMap[item.id]?.answer === 'sim').length
    const nao = templates.filter((item) => answerMap[item.id]?.answer === 'nao').length
    const na = templates.filter((item) => answerMap[item.id]?.answer === 'na').length
    const concluidos = atendidos + na
    const progress = total ? Math.round((concluidos / total) * 100) : 0
    const required = templates.filter((item) => item.required)
    const requiredMet = required.filter((item) => answerMap[item.id]?.answer === 'sim').length
    return { total, classified, atendidos, nao, na, concluidos, progress, requiredTotal: required.length, requiredMet, ready: required.length > 0 && requiredMet === required.length }
  }, [templates, answerMap])

  const answerMutation = useMutation({
    mutationFn: async (input: { template_id: string; answer: QGAnswerType; notes?: string }) => {
      const { data, error } = await qualityGateDB.upsertAnswer({
        project_id: id!,
        tenant_id: tenant!.id,
        phase: phaseId,
        ...input,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qg-answers', id, phaseId] }),
  })

  const decideMutation = useMutation({
    mutationFn: async (input: { decision: 'aprovado' | 'rejeitado'; comments?: string }) => {
      const { data, error } = await qualityGateDB.saveDecision({
        project_id: id!,
        tenant_id: tenant!.id,
        phase: phaseId,
        ...input,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qg-decision', id, phaseId] }),
  })

  return {
    templates,
    answers,
    answerMap,
    decision: decisionQuery.data,
    stats,
    isLoading: templatesQuery.isLoading || answersQuery.isLoading,
    saveAnswer: answerMutation,
    decide: decideMutation,
  }
}
