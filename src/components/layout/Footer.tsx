// src/components/layout/Footer.tsx
import { useUIStore } from '@/store'

export default function Footer() {
  const { realtimeConnected, realtimeCount, lastSyncAt, setSyncTime } = useUIStore()
  return (
    <footer className="flex items-center justify-between px-6 py-3 text-xs shrink-0"
      style={{ borderTop: '1px solid #2e3460', color: '#4b5563' }}>
      <div className="flex items-center gap-2">
        <span className="badge badge-blue" style={{ fontSize: 10 }}>⚙️ GESTÃO SISTÊMICA</span>
        <span>KYNOVIA PROJECT MANAGEMENT v{import.meta.env.VITE_APP_VERSION ?? '2.0'}</span>
      </div>
      <span>© {new Date().getFullYear()} · SAP Activate Methodology</span>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full inline-block"
          style={{ background: realtimeConnected ? '#10b981' : '#6b7280' }} />
        {realtimeConnected
          ? <span>Realtime ON ({realtimeCount}) · sincronizado {lastSyncAt} ·{' '}
              <button onClick={setSyncTime} className="hover:underline" style={{ color: '#3B4FE8' }}>atualizar</button>
            </span>
          : <span>Offline</span>}
      </div>
    </footer>
  )
}
