import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  description?: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose'
}

const toneClasses = {
  slate: 'bg-slate-50 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export default function KPICard({
  title,
  value,
  description,
  icon,
  trend = 'neutral',
  trendLabel,
  tone = 'slate',
}: KPICardProps) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <strong className="mt-2 block text-3xl font-semibold text-slate-950">{value}</strong>
        </div>
        {icon ? (
          <div className={`rounded-lg p-2.5 ring-1 ring-inset ${toneClasses[tone]}`}>{icon}</div>
        ) : null}
      </div>
      {(description || trendLabel) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {trendLabel ? (
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <TrendIcon className="h-4 w-4" />
              {trendLabel}
            </span>
          ) : null}
          {description ? <span className="text-slate-500">{description}</span> : null}
        </div>
      )}
    </article>
  )
}
