import { useEffect, useMemo, useState } from 'react'

export type ScopeState = {
  objective: string
  scope: string
  deliverables: string
  assumptions: string
  exclusions: string
  acceptance: string
  fileName?: string
  fileSize?: number
}

export type CalendarEvent = {
  id: string
  title: string
  day: 'seg' | 'ter' | 'qua' | 'qui' | 'sex'
  start_time: string
  duration: number
  type: 'diario' | 'semanal' | 'quinzenal' | 'mensal'
  audience: 'gerentes' | 'lideres' | 'consultores'
  color: string
}

const defaultScope: ScopeState = {
  objective: 'Alinhar escopo inicial, premissas, entregáveis e critérios de aceite do projeto.',
  scope: 'Implantação dos processos FI, CO, MM e SD no SAP S/4HANA com metodologia SAP Activate.',
  deliverables: 'Kickoff, cronograma macro, desenho de escopo, BPD, ciclos de testes, cutover e hypercare.',
  assumptions: 'Disponibilidade dos key-users, ambientes provisionados e decisões de desenho tomadas dentro dos ritos de governança.',
  exclusions: 'Desenvolvimentos fora do escopo aprovado, integrações não mapeadas e mudanças regulatórias posteriores ao baseline.',
  acceptance: 'Escopo aceito pelo sponsor, líderes funcionais e GP antes do Quality Gate da Fase 1.',
}

const defaultEvents: CalendarEvent[] = [
  { id: 'evt-1', title: 'Daily PMO', day: 'seg', start_time: '09:00', duration: 30, type: 'diario', audience: 'gerentes', color: '#3B4FE8' },
  { id: 'evt-2', title: 'Comitê Executivo', day: 'qua', start_time: '10:00', duration: 60, type: 'semanal', audience: 'gerentes', color: '#F59E0B' },
  { id: 'evt-3', title: 'Líderes Funcionais', day: 'qui', start_time: '14:00', duration: 60, type: 'semanal', audience: 'lideres', color: '#10b981' },
  { id: 'evt-4', title: 'Alinhamento Consultores', day: 'sex', start_time: '16:00', duration: 30, type: 'quinzenal', audience: 'consultores', color: '#8b5cf6' },
]

export function useLocalTemplateState<T>(key: string, initialValue: T) {
  const storageKey = useMemo(() => `sap-activate:${key}`, [key])
  const [value, setValue] = useState<T>(() => {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return initialValue
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(initialValue)) return Array.isArray(parsed) ? parsed : initialValue
      if (initialValue && typeof initialValue === 'object') return { ...initialValue, ...parsed }
      return parsed
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  }, [storageKey, value])

  return [value, setValue] as const
}

export function useScopeTemplate(projectId?: string) {
  return useLocalTemplateState<ScopeState>(`scope:${projectId ?? 'default'}`, defaultScope)
}

export function useOrgCommunicationTemplate(projectId?: string) {
  return useLocalTemplateState<CalendarEvent[]>(`org-communication:${projectId ?? 'default'}`, defaultEvents)
}
