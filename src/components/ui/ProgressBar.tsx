interface ProgressBarProps {
  value: number
  label?: string
  showValue?: boolean
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

const barClasses = {
  default: 'bg-blue-600',
  success: 'bg-emerald-600',
  warning: 'bg-amber-500',
  danger: 'bg-rose-600',
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))
}

export default function ProgressBar({
  value,
  label,
  showValue = true,
  variant = 'default',
}: ProgressBarProps) {
  const normalizedValue = clamp(value)

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          {label ? <span className="font-medium text-slate-700">{label}</span> : <span />}
          {showValue ? <span className="text-slate-500">{Math.round(normalizedValue)}%</span> : null}
        </div>
      )}
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={normalizedValue}
          className={`h-full rounded-full transition-all duration-300 ${barClasses[variant]}`}
          role="progressbar"
          style={{ width: `${normalizedValue}%` }}
        />
      </div>
    </div>
  )
}
