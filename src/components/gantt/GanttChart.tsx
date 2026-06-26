import { calcGanttPosition, getTodayOffset, formatDate, PHASE_COLORS } from '@/lib/utils'
import type { Task } from '@/types'

type GanttChartProps = {
  tasks: Task[]
  title?: string
}

export default function GanttChart({ tasks, title = 'Gantt simplificado' }: GanttChartProps) {
  const datedTasks = tasks.filter((task) => task.start_date && task.end_date)
  const starts = datedTasks.map((task) => new Date(`${task.start_date}T12:00:00`).getTime())
  const ends = datedTasks.map((task) => new Date(`${task.end_date}T12:00:00`).getTime())
  const projectStart = new Date(Math.min(...starts, Date.now()))
  const projectEnd = new Date(Math.max(...ends, Date.now() + 86_400_000))
  const totalDays = Math.max(1, (projectEnd.getTime() - projectStart.getTime()) / 86_400_000 + 1)
  const today = getTodayOffset(projectStart, totalDays)

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          <p className="text-xs text-text-muted">{formatDate(projectStart.toISOString())} - {formatDate(projectEnd.toISOString())}</p>
        </div>
        <span className="badge badge-blue">{datedTasks.length} tarefas</span>
      </div>

      <div className="relative space-y-3 overflow-x-auto pb-2">
        <div className="absolute bottom-0 top-0 w-px bg-danger" style={{ left: `${today}%` }} />
        {datedTasks.length === 0 ? (
          <div className="rounded-[8px] border border-dashed border-surface-border p-8 text-center text-text-secondary">
            Nenhuma tarefa com datas cadastrada.
          </div>
        ) : datedTasks.slice(0, 18).map((task) => {
          const position = calcGanttPosition(task.start_date!, task.end_date!, projectStart, totalDays)
          const color = task.phase ? PHASE_COLORS[task.phase] : '#3B4FE8'
          return (
            <div key={task.id} className="grid grid-cols-[220px_1fr] items-center gap-4 text-xs">
              <div className="truncate text-text-secondary">
                <span className="wbs-badge mr-2 bg-surface-border text-text-primary">{task.wbs}</span>
                {task.title}
              </div>
              <div className="relative h-7 rounded-[8px] bg-[#0f1229]">
                <div
                  className="absolute top-1 h-5 rounded-[6px]"
                  style={{ left: `${position.left}%`, width: `${position.width}%`, background: color }}
                  title={`${formatDate(task.start_date)} - ${formatDate(task.end_date)}`}
                />
                {task.type === 'milestone' ? (
                  <div
                    className="absolute top-1 h-5 w-5 rotate-45 rounded-[3px]"
                    style={{ left: `${position.left}%`, background: '#F59E0B' }}
                  />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
