// src/pages/AuthPage.tsx
import { useEffect, useRef, useState, type InputHTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Activity,
  AlertTriangle,
  Building2,
  Layers,
  LogIn,
  Mail,
  Monitor,
  PlayCircle,
  UserPlus,
} from 'lucide-react'
import { useAuthStore, useProjectStore } from '@/store'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Project } from '@/types'

type Tab = 'login' | 'register' | 'reset'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(4, 'Mínimo 4 caracteres'),
})

const registerSchema = z.object({
  full_name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
})

const resetSchema = z.object({
  email: z.string().email('E-mail inválido'),
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>
type ResetForm = z.infer<typeof resetSchema>

const tabLabel: Record<Tab, string> = {
  login: 'Entrar',
  register: 'Criar conta',
  reset: 'Redefinir senha',
}

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>('login')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [regLoading, setRegLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const { login, user, loading, setUser, setTenant } = useAuthStore()
  const navigate = useNavigate()

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) })

  useEffect(() => {
    if (user) navigate('/home', { replace: true })
  }, [navigate, user])

  function selectTab(nextTab: Tab) {
    setTab(nextTab)
    setError(null)
    setSuccess(null)
  }

  const handleLogin = async (data: LoginForm) => {
    setError(null)
    setSuccess(null)
    if (data.email === 'demo@sap.local' && data.password === 'demo1234') {
      handleDemoLogin('ADMIN')
      return
    }
    if (data.email === 'super@sap.local' && data.password === 'super1234') {
      handleDemoLogin('SUPER_ADMIN')
      return
    }
    if (!isSupabaseConfigured) {
      setError('Login real indisponível: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local. O modo demo continua disponível.')
      return
    }
    await login(data.email, data.password)
    const { error: err } = useAuthStore.getState()
    if (err) setError(err)
  }

  const handleDemoLogin = (role: 'ADMIN' | 'SUPER_ADMIN' = 'ADMIN') => {
    const now = new Date().toISOString()
    const isSuper = role === 'SUPER_ADMIN'
    const demoProject: Project = {
      id: 'demo-project',
      tenant_id: 'demo-tenant',
      created_at: now,
      updated_at: now,
      name: 'Projeto Demo SAP Activate',
      client: 'Cliente Demo',
      project_manager: isSuper ? 'Super Admin Kynovia' : 'Usuário Demo',
      sponsor: 'Sponsor Demo',
      sponsor_email: 'sponsor@sap.local',
      objective: 'Implantação SAP S/4HANA com metodologia SAP Activate.',
      methodology: 'SAP Activate',
      current_phase: '2',
      status: 'verde',
      start_date: '2026-06-01',
      golive_date: '2026-09-30',
      spi: 0.98,
      cpi: 1.02,
      progress_pct: 38,
      planned_value: 100000,
      earned_value: 38000,
      actual_cost: 36000,
      modules: ['FI', 'CO', 'MM', 'SD'],
      tags: ['demo', 'activate'],
      active: true,
      archived: false,
      created_by: 'demo-user',
    }
    setTenant({
      id: 'demo-tenant',
      tenant_id: 'demo-tenant',
      slug: 'demo',
      name: 'KYNOVIA PROJECT MANAGEMENT',
      primary_color: '#3B4FE8',
      secondary_color: '#1E2A78',
      accent_color: '#F59E0B',
      plan: 'enterprise',
      max_projects: 99,
      max_users: 999,
      ai_provider: 'openai',
      ai_model: 'gpt-4-turbo',
      active: true,
      created_at: now,
    } as any)
    setUser({
      id: 'demo-user',
      tenant_id: 'demo-tenant',
      full_name: isSuper ? 'Super Admin Kynovia' : 'Usuário Demo',
      email: isSuper ? 'super@sap.local' : 'demo@sap.local',
      role,
      active: true,
      created_at: now,
    } as any)
    const { setProjects, setActiveProject } = useProjectStore.getState()
    setProjects([demoProject])
    setActiveProject(demoProject)
    navigate('/home', { replace: true })
  }

  const handleRegister = async (data: RegisterForm) => {
    setError(null)
    setSuccess(null)
    if (!isSupabaseConfigured) {
      setError('Cadastro indisponível: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.')
      return
    }
    setRegLoading(true)
    try {
      const { error: err } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.full_name } },
      })
      if (err) throw err
      registerForm.reset()
      setSuccess('Conta criada. Verifique seu e-mail para confirmar o cadastro.')
      setTab('login')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setRegLoading(false)
    }
  }

  const handleReset = async (data: ResetForm) => {
    setError(null)
    setSuccess(null)
    if (!isSupabaseConfigured) {
      setError('Redefinição indisponível: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.')
      return
    }
    setResetLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (err) throw err
      resetForm.reset()
      setSuccess('Link de redefinição enviado. Verifique seu e-mail.')
      setTab('login')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-[#0A0A0B] antialiased lg:grid-cols-2 lg:grid-rows-[1fr_auto]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#0A0A0B] px-12 py-10 lg:flex lg:flex-col">
        <LeftCanvas />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.045)_1px,transparent_1px)] bg-[length:56px_56px] [mask-image:radial-gradient(ellipse_80%_90%_at_30%_50%,black_10%,transparent_80%)]" />
        <div className="pointer-events-none absolute right-[-80px] top-[-120px] h-[380px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.18)_0%,transparent_65%)] blur-[100px]" />
        <div className="pointer-events-none absolute bottom-[-80px] left-[-60px] h-[280px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.09)_0%,transparent_70%)] blur-[100px]" />

        <div className="relative z-10 flex h-full flex-col">
          <a className="inline-flex items-center gap-2.5" href="/login" aria-label="Kynovia">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#2563EB]">
              <Layers className="h-4 w-4 text-white" strokeWidth={1.6} />
            </span>
            <span className="text-base font-bold tracking-[-0.2px] text-[#F4F4F5]">
              Kynov<span className="text-[#3B82F6]">ia</span>
            </span>
          </a>

          <div className="mt-9 inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(37,99,235,0.22)] bg-[rgba(37,99,235,0.10)] py-[5px] pl-2 pr-3.5 font-mono text-[11px] font-medium tracking-[0.04em] text-[#93C5FD]">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#3B82F6] shadow-[0_0_6px_#3B82F6,0_0_12px_rgba(59,130,246,0.4)]" />
            SAP Activate · Project Management
          </div>

          <div className="flex flex-1 flex-col justify-center py-8">
            <div className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#52525B]">
              // Project Management Portal
            </div>
            <h1 className="mb-4 max-w-[560px] text-[clamp(26px,2.8vw,40px)] font-bold leading-[1.2] tracking-[-1.5px] text-[#F4F4F5]">
              Visibilidade total sobre cada <span className="text-[#3B82F6]">fase</span> do projeto.
            </h1>
            <p className="mb-8 max-w-[360px] text-[14.5px] leading-[1.65] text-[#A1A1AA]">
              Rastreie entregas, riscos e KPIs em tempo real, da Preparação ao Go-Live.
            </p>

            <div className="flex flex-col gap-2.5">
              <Feature icon={<Monitor className="h-[15px] w-[15px]" />} title="Dashboard em tempo real">
                Acompanhe cada fase SAP Activate com indicadores vivos
              </Feature>
              <Feature icon={<Activity className="h-[15px] w-[15px]" />} title="EVM e cronograma integrados">
                Custo, prazo e escopo sob controle em um só lugar
              </Feature>
              <Feature icon={<Building2 className="h-[15px] w-[15px]" />} title="Multi-tenant white-label">
                Cada cliente acessa seu próprio ambiente isolado
              </Feature>
            </div>

            <div className="mt-7 flex flex-col gap-[7px]">
              <PhaseRow color="#3B82F6" shadow="rgba(59,130,246,.55)" name="Discover" tag="Fase 1" />
              <PhaseRow color="#10B981" shadow="rgba(16,185,129,.55)" name="Prepare" tag="Fase 2" />
              <PhaseRow color="#F59E0B" shadow="rgba(245,158,11,.55)" name="Explore" tag="Fase 3" />
              <PhaseRow color="#8B5CF6" shadow="rgba(139,92,246,.55)" name="Realize" tag="Fase 4" />
              <PhaseRow color="#EC4899" shadow="rgba(236,72,153,.50)" name="Deploy" tag="Fase 5" />
              <PhaseRow color="#60A5FA" shadow="rgba(96,165,250,.50)" name="Run" tag="Fase 6" />
            </div>
          </div>

          <div className="mt-7 font-mono text-[10px] tracking-[0.06em] text-[#52525B]">
            © 2026 KYNOVIA · ENTERPRISE EDITION
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[#F8F8FA] px-6 py-10 lg:px-12 lg:py-[60px]">
        <div className="w-full max-w-[400px]">
          <h2 className="mb-[5px] text-[26px] font-bold tracking-[-0.8px] text-[#0F0F10]">Acessar portal.</h2>
          <p className="mb-[26px] text-sm text-[#71717A]">Entre com sua conta corporativa para continuar.</p>

          <div className="mb-5 flex gap-[3px] rounded-[9px] bg-[#EBEBED] p-[3px]">
            {(['login', 'register', 'reset'] as Tab[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`flex-1 rounded-[7px] px-1.5 py-2 text-[13px] font-medium tracking-[-0.1px] transition ${
                  tab === item
                    ? 'bg-white text-[#0F0F10] shadow-[0_1px_3px_rgba(0,0,0,0.10)]'
                    : 'text-[#71717A] hover:text-[#0F0F10]'
                }`}
                onClick={() => selectTab(item)}
              >
                {tabLabel[item]}
              </button>
            ))}
          </div>

          {error && <Message tone="error">{error}</Message>}
          {success && <Message tone="success">{success}</Message>}

          {tab === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)}>
              <Field
                label="E-mail corporativo"
                error={loginForm.formState.errors.email?.message}
                inputProps={{
                  ...loginForm.register('email'),
                  type: 'email',
                  placeholder: 'voce@empresa.com.br',
                  autoComplete: 'email',
                }}
              />
              <Field
                label="Senha"
                action={
                  <button type="button" className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]" onClick={() => selectTab('reset')}>
                    Esqueci minha senha
                  </button>
                }
                error={loginForm.formState.errors.password?.message}
                inputProps={{
                  ...loginForm.register('password'),
                  type: 'password',
                  placeholder: '••••••••',
                  autoComplete: 'current-password',
                }}
              />
              <div className="h-1" />
              <PrimaryButton loading={loading} icon={<LogIn className="h-3.5 w-3.5" />}>
                Entrar
              </PrimaryButton>
              <div className="my-3.5 flex items-center gap-3">
                <span className="h-px flex-1 bg-[#E4E4E7]" />
                <span className="font-mono text-[11px] tracking-[0.08em] text-[#A1A1AA]">OU</span>
                <span className="h-px flex-1 bg-[#E4E4E7]" />
              </div>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-dashed border-[#D4D4D8] bg-transparent p-2.5 text-[13.5px] font-medium tracking-[-0.1px] text-[#71717A] transition hover:border-[#3B82F6] hover:bg-[rgba(37,99,235,0.04)] hover:text-[#2563EB]"
                onClick={() => handleDemoLogin('ADMIN')}
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Entrar em modo demo
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={registerForm.handleSubmit(handleRegister)}>
              <Field
                label="Nome completo"
                error={registerForm.formState.errors.full_name?.message}
                inputProps={{
                  ...registerForm.register('full_name'),
                  type: 'text',
                  placeholder: 'Seu nome',
                  autoComplete: 'name',
                }}
              />
              <Field
                label="E-mail corporativo"
                error={registerForm.formState.errors.email?.message}
                inputProps={{
                  ...registerForm.register('email'),
                  type: 'email',
                  placeholder: 'voce@empresa.com.br',
                  autoComplete: 'email',
                }}
              />
              <Field
                label="Senha"
                error={registerForm.formState.errors.password?.message}
                inputProps={{
                  ...registerForm.register('password'),
                  type: 'password',
                  placeholder: 'Mínimo 8 caracteres',
                  autoComplete: 'new-password',
                }}
              />
              <div className="h-1" />
              <PrimaryButton loading={regLoading} icon={<UserPlus className="h-3.5 w-3.5" />}>
                Criar conta
              </PrimaryButton>
            </form>
          )}

          {tab === 'reset' && (
            <form onSubmit={resetForm.handleSubmit(handleReset)}>
              <Field
                label="E-mail cadastrado"
                error={resetForm.formState.errors.email?.message}
                inputProps={{
                  ...resetForm.register('email'),
                  type: 'email',
                  placeholder: 'voce@empresa.com.br',
                  autoComplete: 'email',
                }}
              />
              <div className="h-1" />
              <PrimaryButton loading={resetLoading} icon={<Mail className="h-3.5 w-3.5" />}>
                Enviar link de redefinição
              </PrimaryButton>
            </form>
          )}
        </div>
      </section>

      <footer className="border-t border-[rgba(255,255,255,0.06)] bg-[#0A0A0B] px-6 py-3.5 lg:col-span-2 lg:px-12">
        <p className="mx-auto max-w-[780px] text-center font-mono text-[10px] leading-[1.6] tracking-[0.03em] text-[#52525B]">
          SAP® e SAP Activate® são marcas registradas da SAP SE na Alemanha e em outros países.
          A Kynovia não é afiliada, patrocinada ou endossada pela SAP SE.
          Este portal utiliza a metodologia SAP Activate como referência de gestão de projetos.
        </p>
        <p className="mt-1.5 text-center font-mono text-[10px] leading-[1.6] tracking-[0.03em] text-[#52525B]">
          © 2026 Kynovia Tecnologia. Todos os direitos reservados.
        </p>
      </footer>
    </main>
  )
}

function Field({
  label,
  action,
  error,
  inputProps,
}: {
  label: string
  action?: ReactNode
  error?: string
  inputProps: InputHTMLAttributes<HTMLInputElement>
}) {
  return (
    <label className="mb-[13px] block">
      <span className="mb-[5px] flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold tracking-[0.01em] text-[#3F3F46]">{label}</span>
        {action}
      </span>
      <input
        {...inputProps}
        className="mt-[5px] w-full rounded-[8px] border border-[#E4E4E7] bg-white px-[13px] py-2.5 text-sm text-[#0F0F10] outline-none transition placeholder:text-[#A1A1AA] focus:border-[#3B82F6] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.10)]"
      />
      {error ? <span className="mt-1 block text-xs text-[#B91C1C]">{error}</span> : null}
    </label>
  )
}

function PrimaryButton({ children, icon, loading }: { children: string; icon: ReactNode; loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-[8px] border-0 bg-[#2563EB] px-[22px] py-[11px] text-sm font-medium tracking-[-0.1px] text-white transition hover:-translate-y-px hover:bg-[#1D4ED8] hover:shadow-[0_0_0_4px_rgba(37,99,235,.15),0_6px_20px_rgba(37,99,235,.25)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
    >
      {icon}
      {loading ? 'Processando...' : children}
    </button>
  )
}

function Message({ tone, children }: { tone: 'warning' | 'error' | 'success'; children: string }) {
  const styles = {
    warning: 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]',
    error: 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]',
    success: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]',
  }[tone]

  return (
    <div className={`mb-[18px] flex items-start gap-[9px] rounded-[8px] border px-[13px] py-2.5 ${styles}`}>
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      <p className="font-mono text-[11.5px] leading-[1.5]">{children}</p>
    </div>
  )
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: string }) {
  return (
    <div className="flex cursor-default items-center gap-3.5 rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.022)] px-[15px] py-[11px] transition hover:border-[rgba(59,130,246,0.22)] hover:bg-[rgba(255,255,255,0.038)]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[rgba(59,130,246,0.15)] bg-[rgba(37,99,235,0.12)] text-[#60A5FA]">
        {icon}
      </span>
      <span className="text-[13px] leading-[1.4] text-[#A1A1AA]">
        <span className="mb-px block font-medium text-[#F4F4F5]">{title}</span>
        {children}
      </span>
    </div>
  )
}

function PhaseRow({ color, shadow, name, tag }: { color: string; shadow: string; name: string; tag: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.018)] px-3 py-2 transition hover:border-[rgba(59,130,246,0.22)]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${shadow}` }} />
      <span className="font-mono text-xs tracking-[0.02em] text-[#A1A1AA]">{name}</span>
      <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.06em] text-[#52525B]">{tag}</span>
    </div>
  )
}

function LeftCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas: HTMLCanvasElement = canvasRef.current
    const maybeContext = canvas.getContext('2d')
    if (!maybeContext) return
    const context: CanvasRenderingContext2D = maybeContext

    let width = 0
    let height = 0
    let frame = 0
    let points: Array<{ x: number; y: number; vx: number; vy: number }> = []

    function resize() {
      const parent = canvas.parentElement
      if (!parent) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = parent.offsetWidth
      height = parent.offsetHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      points = Array.from({ length: 55 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
      }))
    }

    function draw() {
      context.clearRect(0, 0, width, height)
      for (let i = 0; i < points.length; i += 1) {
        const p = points[i]
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1
        context.beginPath()
        context.arc(p.x, p.y, 1.4, 0, Math.PI * 2)
        context.fillStyle = 'rgba(59,130,246,0.55)'
        context.fill()
        for (let j = i + 1; j < points.length; j += 1) {
          const q = points[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < 110) {
            context.beginPath()
            context.moveTo(p.x, p.y)
            context.lineTo(q.x, q.y)
            context.strokeStyle = `rgba(59,130,246,${0.14 * (1 - distance / 110)})`
            context.lineWidth = 0.5
            context.stroke()
          }
        }
      }
      frame = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(frame)
    }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 opacity-45" aria-hidden="true" />
}
