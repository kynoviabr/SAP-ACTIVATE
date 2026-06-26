import { PHASE_INFO, type PhaseNumber } from '@/types'

type PhaseProgressItem = {
  phase: PhaseNumber
  progress: number
  completed?: number
  total?: number
}

type PhaseProgressProps = {
  items: PhaseProgressItem[]
}

export default function PhaseProgress({ items }: PhaseProgressProps) {
  const byPhase = Object.fromEntries(items.map((item) => [item.phase, item]))

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary">Progresso por fase</h2>
        <span className="badge badge-blue">AUTO</span>
      </div>
      <div className="space-y-4">
        {(['1', '2', '3', '4', '5'] as PhaseNumber[]).map((phase) => {
          const info = PHASE_INFO[phase]
          const item = byPhase[phase] as PhaseProgressItem | undefined
          const progress = Math.max(0, Math.min(100, item?.progress ?? 0))

          return (
            <div key={phase}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-semibold text-text-primary">{info.icon} {info.short}</span>
                <span className="text-text-secondary">
                  {item?.completed ?? 0}/{item?.total ?? 0} - {Math.round(progress)}%
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%`, background: info.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
