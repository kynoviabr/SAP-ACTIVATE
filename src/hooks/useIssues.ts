import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { issuesDB } from '@/lib/database'
import { isOverdue } from '@/lib/utils'
import { useProjectStore } from '@/store'
import type { CreateIssueInput, Issue, IssuePriority, IssueStatus, IssueType, UpdateIssueInput } from '@/types'

export type IssueFilters = {
  status?: IssueStatus | ''
  priority?: IssuePriority | ''
  type?: IssueType | ''
  assignee?: string
  search?: string
}

function matches(issue: Issue, filters: IssueFilters) {
  const search = (filters.search ?? '').trim().toLowerCase()
  const haystack = `${issue.code} ${issue.description} ${issue.assignee ?? ''} ${issue.opened_by ?? ''}`.toLowerCase()

  return (
    (!filters.status || issue.status === filters.status) &&
    (!filters.priority || issue.priority === filters.priority) &&
    (!filters.type || issue.issue_type === filters.type) &&
    (!filters.assignee || (issue.assignee ?? '').toLowerCase().includes(filters.assignee.toLowerCase())) &&
    (!search || haystack.includes(search))
  )
}

export function useIssues(projectId?: string, filters: IssueFilters = {}) {
  const qc = useQueryClient()
  const activeProject = useProjectStore((s) => s.activeProject)
  const id = projectId ?? activeProject?.id

  const query = useQuery({
    queryKey: ['issues', id],
    queryFn: () => issuesDB.list(id!),
    enabled: Boolean(id),
    staleTime: 30_000,
  })

  const issues = query.data ?? []
  const filteredIssues = useMemo(() => issues.filter((issue) => matches(issue, filters)), [issues, filters])
  const stats = useMemo(() => ({
    total: issues.length,
    abertas: issues.filter((i) => i.status === 'aberta').length,
    em_andamento: issues.filter((i) => i.status === 'em_andamento').length,
    resolvidas: issues.filter((i) => i.status === 'resolvida').length,
    atrasadas: issues.filter((i) => i.status === 'atrasada' || isOverdue(i.due_date)).length,
    canceladas: issues.filter((i) => i.status === 'cancelada').length,
  }), [issues])

  const createMutation = useMutation({
    mutationFn: (input: CreateIssueInput) => issuesDB.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issues', id] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id: issueId, input }: { id: string; input: UpdateIssueInput }) =>
      issuesDB.update(issueId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issues', id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (issueId: string) => issuesDB.delete(issueId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issues', id] }),
  })

  return {
    issues,
    filteredIssues,
    stats,
    summary: {
      open: stats.abertas,
      inProgress: stats.em_andamento,
      resolved: stats.resolvidas,
      overdue: stats.atrasadas,
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    createIssue: createMutation,
    updateIssue: updateMutation,
    deleteIssue: deleteMutation,
  }
}
