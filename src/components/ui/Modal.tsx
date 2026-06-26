import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  title: string
  children: ReactNode
  description?: string
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  onClose: () => void
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

export default function Modal({
  open,
  title,
  children,
  description,
  footer,
  size = 'md',
  onClose,
}: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        aria-label="Fechar modal"
        className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-sm"
        type="button"
        onClick={onClose}
      />
      <section
        aria-modal="true"
        className={`relative flex max-h-[90vh] w-full ${sizeClasses[size]} flex-col overflow-hidden rounded-lg bg-white shadow-2xl ring-1 ring-slate-900/10`}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            aria-label="Fechar"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <footer className="border-t border-slate-200 px-6 py-4">{footer}</footer> : null}
      </section>
    </div>
  )
}
