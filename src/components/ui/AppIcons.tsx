import type { ComponentType, SVGProps } from 'react'
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  Circle,
  ClipboardList,
  Compass,
  Gauge,
  Globe2,
  Home,
  LogOut,
  Rocket,
  Search,
  Settings2,
  ShieldAlert,
  Target,
} from 'lucide-react'
import type { PhaseNumber, ProjectStatus } from '@/types'

type IconProps = SVGProps<SVGSVGElement>
type IconComponent = ComponentType<IconProps>

const phaseIcons: Record<PhaseNumber, IconComponent> = {
  '1': Compass,
  '2': Search,
  '3': Settings2,
  '4': Rocket,
  '5': ClipboardList,
}

const statusIcons: Record<ProjectStatus, IconComponent> = {
  verde: CheckCircle2,
  amarelo: AlertTriangle,
  vermelho: ShieldAlert,
  encerrado: Circle,
}

export function PhaseIcon({ phase, className = 'h-4 w-4', ...props }: IconProps & { phase: PhaseNumber }) {
  const Icon = phaseIcons[phase]
  return <Icon className={className} strokeWidth={2} {...props} />
}

export function StatusIcon({ status, className = 'h-3.5 w-3.5', ...props }: IconProps & { status: ProjectStatus }) {
  const Icon = statusIcons[status]
  return <Icon className={className} strokeWidth={2} {...props} />
}

export const AppIcon = {
  ai: Bot,
  dashboard: BarChart3,
  home: Home,
  issues: AlertTriangle,
  language: Globe2,
  logout: LogOut,
  performance: Gauge,
  risks: Target,
}
