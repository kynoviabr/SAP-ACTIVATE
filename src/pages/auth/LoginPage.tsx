// src/pages/AuthPage.tsx
import { useEffect, useRef, useState, type InputHTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Layers, LogIn, Mail, PlayCircle, Terminal, UserPlus } from 'lucide-react'
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
      handleDemoLogin()
      return
    }
    if (!isSupabaseConfigured) {
      setError('Login real indisponível: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local. Use demo@sap.local / demo1234 enquanto isso.')
      return
    }
    await login(data.email, data.password)
    const { error: err } = useAuthStore.getState()
    if (err) setError(err)
  }

  const handleDemoLogin = () => {
    const now = new Date().toISOString()
    const demoProject: Project = {
      id: 'demo-project',
      tenant_id: 'demo-tenant',
      created_at: now,
      updated_at: now,
      name: 'Projeto Demo SAP Activate',
      client: 'Cliente Demo',
      project_manager: 'Usuário Demo',
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
      full_name: 'Usuário Demo',
      email: 'demo@sap.local',
      role: 'ADMIN',
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0A0B] p-6 text-[#F4F4F5] antialiased">
      <ParticleCanvas />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(59,130,246,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.045)_1px,transparent_1px)] bg-[length:56px_56px] [mask-image:radial-gradient(ellipse_70%_80%_at_50%_40%,black_20%,transparent_80%)]" />
      <div className="pointer-events-none fixed right-[-80px] top-[-120px] h-[400px] w-[500px] rounded-full bg-[rgba(37,99,235,0.16)] blur-[110px]" />
      <div className="pointer-events-none fixed bottom-[-100px] left-[-80px] h-[300px] w-[360px] rounded-full bg-[rgba(59,130,246,0.08)] blur-[90px]" />

      <section className="relative z-10 grid w-full max-w-[860px] animate-fade-in overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.06)] bg-[#111112] shadow-2xl shadow-black/30 md:grid-cols-2">
        <aside className="relative hidden min-h-[560px] overflow-hidden border-r border-[rgba(255,255,255,0.06)] bg-[#0A0A0B] px-9 py-10 md:flex md:flex-col md:justify-between">
          <div className="pointer-events-none absolute right-[-100px] top-[-100px] h-[300px] w-[300px] rounded-full bg-[rgba(37,99,235,0.10)] blur-[60px]" />

          <div className="relative">
            <a className="inline-flex items-center gap-2.5 text-decoration-none" href="/login" aria-label="Kynovia">
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-[#2563EB]">
                <Layers className="h-4 w-4 text-white" strokeWidth={1.6} />
              </span>
              <span className="text-base font-bold tracking-[-0.2px] text-[#F4F4F5]">
                Kynov<span className="text-[#3B82F6]">ia</span>
              </span>
            </a>

            <div className="mt-8 inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(37,99,235,0.22)] bg-[rgba(37,99,235,0.10)] py-[5px] pl-2 pr-3.5 font-mono text-[11px] font-medium tracking-[0.04em] text-[#93C5FD]">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#3B82F6] shadow-[0_0_6px_#3B82F6,0_0_12px_rgba(59,130,246,0.4)]" />
              SAP ACTIVATE PORTAL
            </div>
          </div>

          <div className="relative flex flex-1 flex-col justify-center py-7">
            <div className="mb-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#52525B]">
              // Project Management
            </div>
            <h1 className="mb-3 max-w-[280px] text-[22px] font-bold leading-[1.3] tracking-[-0.5px] text-[#F4F4F5]">
              Visibilidade total sobre cada <span className="text-[#3B82F6]">fase</span> do projeto.
            </h1>
            <p className="mb-6 max-w-[250px] text-[13.5px] leading-[1.6] text-[#A1A1AA]">
              Rastreie entregas, riscos e KPIs em tempo real, da Preparação ao Go-Live.
            </p>

            <div className="flex flex-col gap-[5px]">
              <PhaseRow color="#3B82F6" shadow="rgba(59,130,246,0.5)" name="Discover & Prepare" tag="Fase 1" />
              <PhaseRow color="#10B981" shadow="rgba(16,185,129,0.5)" name="Explore & Realize" tag="Fase 2-3" />
              <PhaseRow color="#F59E0B" shadow="rgba(245,158,11,0.5)" name="Deploy & Run" tag="Fase 4-5" />
            </div>

            <div className="mt-6 flex gap-5 border-t border-[rgba(255,255,255,0.06)] pt-5">
              <Stat value="12" suffix="+" label="Projetos ativos" />
              <Stat value="98" suffix="%" label="SLA cumprido" />
              <Stat value="5" suffix="x" label="Faster delivery" />
            </div>
          </div>

          <div className="relative font-mono text-[10px] tracking-[0.06em] text-[#52525B]">
            © 2026 KYNOVIA · ENTERPRISE EDITION
          </div>
        </aside>

        <section className="bg-[#111112] px-6 py-8 md:px-9 md:py-10">
          <div className="mb-6">
            <h2 className="mb-1 text-lg font-semibold tracking-[-0.3px] text-[#F4F4F5]">Acessar portal</h2>
            <p className="text-[13px] text-[#A1A1AA]">Entre com sua conta corporativa</p>
          </div>

          {!isSupabaseConfigured && (
            <Message tone="warning">
              Supabase não configurado. Login real e cadastro ficam bloqueados; modo demo disponível.
            </Message>
          )}
          {error && <Message tone="error">{error}</Message>}
          {success && <Message tone="success">{success}</Message>}

          <div className="mb-[22px] flex gap-0 border-b border-[rgba(255,255,255,0.06)]">
            {(['login', 'register', 'reset'] as Tab[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`mb-[-1px] mr-[18px] border-b-2 px-0 py-2 text-[13px] font-medium tracking-[0.01em] transition ${
                  tab === item
                    ? 'border-[#3B82F6] text-[#F4F4F5]'
                    : 'border-transparent text-[#52525B] hover:text-[#A1A1AA]'
                }`}
                onClick={() => selectTab(item)}
              >
                {tabLabel[item]}
              </button>
            ))}
          </div>

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
                error={loginForm.formState.errors.password?.message}
                inputProps={{
                  ...loginForm.register('password'),
                  type: 'password',
                  placeholder: '••••••••',
                  autoComplete: 'current-password',
                }}
              />
              <div className="-mt-1.5 mb-[18px] flex justify-end">
                <button
                  type="button"
                  className="text-xs text-[#60A5FA] transition hover:text-[#93C5FD]"
                  onClick={() => selectTab('reset')}
                >
                  Esqueci minha senha
                </button>
              </div>
              <PrimaryButton loading={loading} icon={<LogIn className="h-3.5 w-3.5" />}>
                Entrar
              </PrimaryButton>
              <OutlineButton type="button" onClick={handleDemoLogin} icon={<PlayCircle className="h-3.5 w-3.5" />}>
                Entrar em modo demo
              </OutlineButton>
              <div className="mt-2.5 flex items-center gap-2 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0B] px-3 py-[9px]">
                <Terminal className="h-[13px] w-[13px] shrink-0 text-[#52525B]" strokeWidth={1.5} />
                <span className="font-mono text-[11px] tracking-[0.04em] text-[#52525B]">
                  demo local: <span className="text-[#60A5FA]">demo@sap.local</span> / <span className="text-[#60A5FA]">demo1234</span>
                </span>
              </div>
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
              <PrimaryButton loading={resetLoading} icon={<Mail className="h-3.5 w-3.5" />}>
                Enviar link de redefinição
              </PrimaryButton>
            </form>
          )}

          <p className="mt-[18px] text-center text-[11.5px] leading-[1.6] text-[#52525B]">
            Novos cadastros entram como <span className="font-medium text-[#A1A1AA]">Usuário</span>.<br />
            Apenas o <span className="font-semibold text-[#60A5FA]">ADM</span> pode promover perfis e apagar dados.
          </p>
        </section>
      </section>
    </main>
  )
}

function Field({
  label,
  error,
  inputProps,
}: {
  label: string
  error?: string
  inputProps: InputHTMLAttributes<HTMLInputElement>
}) {
  return (
    <label className="mb-3.5 block">
      <span className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.10em] text-[#52525B]">
        {label}
      </span>
      <input
        {...inputProps}
        className="w-full rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#18181A] px-[13px] py-2.5 text-[13.5px] text-[#F4F4F5] outline-none transition placeholder:text-[#52525B] focus:border-[rgba(59,130,246,0.5)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
      />
      {error ? <span className="mt-1 block text-xs text-[#FCA5A5]">{error}</span> : null}
    </label>
  )
}

function PrimaryButton({
  children,
  icon,
  loading,
}: {
  children: string
  icon: ReactNode
  loading?: boolean
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mb-[9px] inline-flex w-full items-center justify-center gap-2 rounded-[8px] border-0 bg-[#2563EB] px-[22px] py-[11px] text-sm font-medium tracking-[-0.1px] text-white transition hover:-translate-y-px hover:bg-[#1D4ED8] hover:shadow-[0_0_0_4px_rgba(37,99,235,0.18),0_8px_24px_rgba(37,99,235,0.28)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
    >
      {icon}
      {loading ? 'Processando...' : children}
    </button>
  )
}

function OutlineButton({
  children,
  icon,
  type = 'button',
  onClick,
}: {
  children: string
  icon: ReactNode
  type?: 'button' | 'submit'
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-transparent px-[22px] py-[11px] text-sm font-medium tracking-[-0.1px] text-[#A1A1AA] transition hover:border-[rgba(255,255,255,0.13)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F4F4F5]"
    >
      {icon}
      {children}
    </button>
  )
}

function Message({ tone, children }: { tone: 'warning' | 'error' | 'success'; children: string }) {
  const styles = {
    warning: 'border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.07)] text-[#FCD34D]',
    error: 'border-[rgba(248,113,113,0.28)] bg-[rgba(127,29,29,0.35)] text-[#FCA5A5]',
    success: 'border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.12)] text-[#6EE7B7]',
  }[tone]

  return (
    <div className={`mb-5 flex items-start gap-2.5 rounded-[10px] border px-[13px] py-2.5 ${styles}`}>
      <AlertTriangle className="mt-px h-[15px] w-[15px] shrink-0" strokeWidth={1.5} />
      <p className="font-mono text-xs leading-[1.5] tracking-[0.01em]">{children}</p>
    </div>
  )
}

function PhaseRow({ color, shadow, name, tag }: { color: string; shadow: string; name: string; tag: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-3 py-2 transition hover:border-[rgba(59,130,246,0.18)] hover:bg-[rgba(255,255,255,0.04)]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${shadow}` }} />
      <span className="font-mono text-xs tracking-[0.02em] text-[#A1A1AA]">{name}</span>
      <span className="ml-auto font-mono text-[9.5px] font-medium uppercase tracking-[0.06em] text-[#52525B]">{tag}</span>
    </div>
  )
}

function Stat({ value, suffix, label }: { value: string; suffix: string; label: string }) {
  return (
    <div className="flex-1">
      <div className="text-[22px] font-bold leading-none tracking-[-1.5px] text-[#F4F4F5]">
        {value}<span className="text-[#3B82F6]">{suffix}</span>
      </div>
      <div className="mt-1 font-mono text-[11px] tracking-[0.04em] text-[#52525B]">{label}</div>
    </div>
  )
}

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const htmlCanvas: HTMLCanvasElement = canvasRef.current
    const maybeContext = htmlCanvas.getContext('2d')
    if (!maybeContext) return
    const context: CanvasRenderingContext2D = maybeContext

    let width = 0
    let height = 0
    let frame = 0
    let points: Array<{ x: number; y: number; vx: number; vy: number }> = []

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      htmlCanvas.width = Math.floor(width * dpr)
      htmlCanvas.height = Math.floor(height * dpr)
      htmlCanvas.style.width = `${width}px`
      htmlCanvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      points = Array.from({ length: 60 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
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
        context.arc(p.x, p.y, 1.5, 0, Math.PI * 2)
        context.fillStyle = 'rgba(59,130,246,0.5)'
        context.fill()

        for (let j = i + 1; j < points.length; j += 1) {
          const q = points[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < 120) {
            context.beginPath()
            context.moveTo(p.x, p.y)
            context.lineTo(q.x, q.y)
            context.strokeStyle = `rgba(59,130,246,${0.15 * (1 - distance / 120)})`
            context.lineWidth = 0.6
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

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0 opacity-55" aria-hidden="true" />
}
