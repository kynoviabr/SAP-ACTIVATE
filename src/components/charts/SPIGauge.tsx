import { clamp } from '@/lib/utils'

type SPIGaugeProps = {
  value: number
  label?: string
}

export default function SPIGauge({ value, label = 'SPI' }: SPIGaugeProps) {
  const normalized = clamp(value, 0, 1.4)
  const pct = normalized / 1.4
  const angle = -90 + pct * 180
  const status = value >= 0.95 ? 'Saudável' : value >= 0.8 ? 'Atenção' : 'Crítico'
  const color = value >= 0.95 ? '#10b981' : value >= 0.8 ? '#F59E0B' : '#ef4444'

  return (
    <div className="card2 flex flex-col items-center justify-center">
      <div className="relative h-32 w-56">
        <svg viewBox="0 0 220 130" className="h-full w-full">
          <path d="M30 110a80 80 0 0 1 160 0" fill="none" stroke="#2e3460" strokeWidth="18" strokeLinecap="round" />
          <path
            d="M30 110a80 80 0 0 1 160 0"
            fill="none"
            stroke={color}
            strokeDasharray={`${pct * 252} 252`}
            strokeWidth="18"
            strokeLinecap="round"
          />
          <line
            x1="110"
            y1="110"
            x2="110"
            y2="42"
            stroke="#e2e8f0"
            strokeWidth="4"
            strokeLinecap="round"
            style={{ transformOrigin: '110px 110px', transform: `rotate(${angle}deg)` }}
          />
          <circle cx="110" cy="110" r="6" fill="#e2e8f0" />
        </svg>
      </div>
      <strong className="text-3xl text-text-primary">{value.toFixed(2)}</strong>
      <span className="mt-1 text-sm text-text-secondary">{label} - {status}</span>
    </div>
  )
}
