// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ProjectStatus, RiskSeverity, IssuePriority, PhaseNumber } from '@/types'

// ── Tailwind merge ────────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Date helpers ──────────────────────────────────────────────────────────
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr.split('T')[0] + 'T12:00:00')
  return d.toLocaleDateString('pt-BR')
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatTimeOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })
}

export function calcDaysToGoLive(goLiveDate: string | null | undefined): number {
  if (!goLiveDate) return 0
  const today  = new Date()
  const golive = new Date(goLiveDate + 'T12:00:00')
  return Math.ceil((golive.getTime() - today.getTime()) / 86_400_000)
}

export function isOverdue(dueDateStr: string | null | undefined): boolean {
  if (!dueDateStr) return false
  return new Date(dueDateStr + 'T23:59:59') < new Date()
}

export function daysAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'ontem'
  if (diff < 7)  return `${diff} dias atrás`
  if (diff < 30) return `${Math.floor(diff / 7)} sem. atrás`
  return formatDate(dateStr)
}

// ── Number helpers ────────────────────────────────────────────────────────
export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style:    'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ── SPI / EVM ─────────────────────────────────────────────────────────────
export function calcSPI(earnedValue: number, plannedValue: number): number {
  if (plannedValue <= 0) return 1
  return Math.round((earnedValue / plannedValue) * 100) / 100
}

export function calcCPI(earnedValue: number, actualCost: number): number {
  if (actualCost <= 0) return 1
  return Math.round((earnedValue / actualCost) * 100) / 100
}

export function getRAGStatus(spi: number): ProjectStatus {
  if (spi >= 0.95) return 'verde'
  if (spi >= 0.80) return 'amarelo'
  return 'vermelho'
}

// ── Risk helpers ──────────────────────────────────────────────────────────
export function calcExposure(impact: number, probability: number): number {
  return impact * probability
}

export function getSeverity(exposure: number): RiskSeverity {
  if (exposure >= 15) return 'critico'
  if (exposure >= 8)  return 'alto'
  if (exposure >= 4)  return 'medio'
  return 'baixo'
}

// ── Color maps ────────────────────────────────────────────────────────────
export const STATUS_COLORS: Record<ProjectStatus, { bg: string; text: string; icon: string }> = {
  verde:    { bg: '#064e3b', text: '#34d399', icon: '🟢' },
  amarelo:  { bg: '#78350f', text: '#fcd34d', icon: '🟡' },
  vermelho: { bg: '#7f1d1d', text: '#fca5a5', icon: '🔴' },
  encerrado:{ bg: '#1f2937', text: '#9ca3af', icon: '🏁' },
}

export const SEVERITY_COLORS: Record<RiskSeverity, { bg: string; text: string; border?: string }> = {
  baixo:   { bg: '#064e3b', text: '#34d399' },
  medio:   { bg: '#78350f', text: '#fcd34d' },
  alto:    { bg: '#7f1d1d', text: '#fca5a5' },
  critico: { bg: '#450a0a', text: '#f87171', border: '#f87171' },
}

export const PRIORITY_COLORS: Record<IssuePriority, { bg: string; text: string; label: string }> = {
  baixa:   { bg: '#064e3b', text: '#34d399', label: '🟢 Baixa' },
  media:   { bg: '#1e3a8a', text: '#93c5fd', label: '🟡 Média' },
  alta:    { bg: '#78350f', text: '#fcd34d', label: '🟠 Alta' },
  critica: { bg: '#7f1d1d', text: '#fca5a5', label: '🔴 Crítica' },
}

export const PHASE_COLORS: Record<PhaseNumber, string> = {
  '1': '#10b981',
  '2': '#F59E0B',
  '3': '#3B4FE8',
  '4': '#8b5cf6',
  '5': '#ec4899',
}

export const PHASE_LABELS: Record<PhaseNumber, { label: string; short: string; icon: string }> = {
  '1': { label: 'Fase 1 — Prepare', short: 'Prepare', icon: '⏱' },
  '2': { label: 'Fase 2 — Explore', short: 'Explore', icon: '🔍' },
  '3': { label: 'Fase 3 — Realize', short: 'Realize', icon: '⚙️' },
  '4': { label: 'Fase 4 — Deploy',  short: 'Deploy',  icon: '🚀' },
  '5': { label: 'Fase 5 — Run',     short: 'Run',     icon: '📋' },
}

// ── Gantt helpers ─────────────────────────────────────────────────────────
export function calcGanttPosition(
  taskStart: string,
  taskEnd: string,
  projectStart: Date,
  totalDays: number
): { left: number; width: number } {
  const start = new Date(taskStart + 'T12:00:00')
  const end   = new Date(taskEnd   + 'T12:00:00')
  const offset = Math.max(0, (start.getTime() - projectStart.getTime()) / 86_400_000)
  const dur    = Math.max(1, (end.getTime() - start.getTime()) / 86_400_000 + 1)
  return {
    left:  clamp((offset / totalDays) * 100, 0, 100),
    width: clamp((dur    / totalDays) * 100, 0.5, 100),
  }
}

export function getTodayOffset(projectStart: Date, totalDays: number): number {
  const offset = (Date.now() - projectStart.getTime()) / 86_400_000
  return clamp((offset / totalDays) * 100, 0, 100)
}

// ── String helpers ────────────────────────────────────────────────────────
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '…'
}

export function initials(name: string, max = 2): string {
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, max)
    .join('')
    .toUpperCase()
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function generateCode(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(3, '0')}`
}

// ── Array helpers ─────────────────────────────────────────────────────────
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key])
    acc[k] = acc[k] ? [...acc[k], item] : [item]
    return acc
  }, {} as Record<string, T[]>)
}

export function sortBy<T>(arr: T[], key: keyof T, dir: 'asc' | 'desc' = 'asc'): T[] {
  return [...arr].sort((a, b) => {
    const av = a[key], bv = b[key]
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1  : -1
    return 0
  })
}

// ── White label ───────────────────────────────────────────────────────────
export function applyTenantTheme(tenant: {
  primary_color?:   string
  secondary_color?: string
  accent_color?:    string
  name?:            string
  logo_url?:        string
}) {
  const root = document.documentElement
  if (tenant.primary_color)   root.style.setProperty('--brand-600', tenant.primary_color)
  if (tenant.secondary_color) root.style.setProperty('--brand-700', tenant.secondary_color)
  if (tenant.accent_color)    root.style.setProperty('--accent', tenant.accent_color)
  if (tenant.name) document.title = `${tenant.name} — Portal de Projetos SAP`
  const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (favicon && tenant.logo_url) favicon.href = tenant.logo_url
}

// ── Debounce ──────────────────────────────────────────────────────────────
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

// ── Download helpers ──────────────────────────────────────────────────────
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, filename)
}
