import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useQualityGate } from '@/hooks/useQualityGate'
import { PHASE_INFO, type PhaseNumber, type QGAnswerType } from '@/types'

export default function QualityGatePage() {
  const { projectId, phase = '1' } = useParams()
  const phaseNumber = (['1', '2', '3', '4', '5'].includes(phase) ? phase : '1') as PhaseNumber
  const { templates, answerMap, decision, stats, isLoading, saveAnswer, decide } = useQualityGate(projectId, phaseNumber)
  const [comments, setComments] = useState(decision?.comments ?? '')
  const info = PHASE_INFO[phaseNumber]

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="badge" style={{ background: info.color, color: '#fff' }}>Quality Gate {phaseNumber}</span>
          <h1 className="mt-3 text-2xl font-bold text-text-primary">{info.label}</h1>
          <p className="mt-1 text-sm text-text-secondary">Classifique os entregáveis obrigatórios antes da decisão final.</p>
        </div>
        <div className="card2 min-w-[220px]">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-text-secondary">Progresso</span>
            <span className="text-text-primary">{stats.progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill bg-brand-600" style={{ width: `${stats.progress}%` }} />
          </div>
        </div>
      </header>

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Kpi label="Itens" value={stats.total} />
        <Kpi label="Atendidos" value={stats.atendidos} />
        <Kpi label="Não atendidos" value={stats.nao} />
        <Kpi label="Obrigatórios" value={`${stats.requiredMet}/${stats.requiredTotal}`} />
      </section>

      <section className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-6 text-text-secondary">Carregando checklist...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Entregável</th>
                <th>Obrigatório</th>
                <th>Classificação</th>
                <th>Observações</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => {
                const answer = answerMap[template.id]
                return (
                  <tr key={template.id}>
                    <td className="text-text-primary">{template.description}</td>
                    <td>{template.required ? <span className="badge badge-amber">Obrigatório</span> : <span className="badge badge-gray">Opcional</span>}</td>
                    <td>
                      <div className="flex gap-2">
                        {(['sim', 'nao', 'na'] as QGAnswerType[]).map((option) => (
                          <button
                            key={option}
                            className={`badge ${answer?.answer === option ? option === 'sim' ? 'badge-green' : option === 'nao' ? 'badge-red' : 'badge-gray' : 'badge-gray'}`}
                            type="button"
                            onClick={() => saveAnswer.mutate({ template_id: template.id, answer: option, notes: answer?.notes })}
                          >
                            {option.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input
                        className="input"
                        defaultValue={answer?.notes ?? ''}
                        onBlur={(event) => {
                          if (answer?.answer) saveAnswer.mutate({ template_id: template.id, answer: answer.answer, notes: event.target.value })
                        }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card mt-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Decisão da fase</h2>
            <p className="mt-1 text-sm text-text-secondary">Status atual: {decision?.decision ?? 'sem decisão'}</p>
          </div>
          {stats.ready ? <span className="badge badge-green">Pronto</span> : <span className="badge badge-amber">Pendências</span>}
        </div>
        <textarea className="input" value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Comentários do aprovador" />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-danger" type="button" onClick={() => decide.mutate({ decision: 'rejeitado', comments })}>
            <XCircle className="h-4 w-4" />
            Rejeitar
          </button>
          <button className="btn-green" type="button" onClick={() => decide.mutate({ decision: 'aprovado', comments })}>
            <CheckCircle2 className="h-4 w-4" />
            Aprovar
          </button>
        </div>
      </section>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card2">
      <span className="text-sm text-text-secondary">{label}</span>
      <strong className="mt-2 block text-2xl text-text-primary">{value}</strong>
    </div>
  )
}
