// src/pages/AuthPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { KynoviaWordmark } from '@/components/brand/KynoviaLogo'
import { useAuthStore, useProjectStore } from '@/store'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Project } from '@/types'

type Tab = 'login' | 'register' | 'reset'

// ── Schemas ───────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(4, 'Mínimo 4 caracteres'),
})
const registerSchema = z.object({
  full_name:        z.string().min(2, 'Nome obrigatório'),
  email:            z.string().email('E-mail inválido'),
  password:         z.string().min(8, 'Mínimo 8 caracteres'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'Senhas não coincidem',
  path: ['confirm_password'],
})
const resetSchema = z.object({
  email:            z.string().email('E-mail inválido'),
  password:         z.string().min(8, 'Mínimo 8 caracteres'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'Senhas não coincidem',
  path: ['confirm_password'],
})

type LoginForm    = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>
type ResetForm    = z.infer<typeof resetSchema>

export default function AuthPage() {
  const [tab, setTab]         = useState<Tab>('login')
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { login, user, loading, setUser, setTenant } = useAuthStore()
  const navigate = useNavigate()

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/home', { replace: true })
  }, [user])

  // ── Login ──────────────────────────────────────────────────────────────
  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const handleLogin = async (data: LoginForm) => {
    setError(null)
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

  // ── Register ───────────────────────────────────────────────────────────
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })
  const [regLoading, setRegLoading] = useState(false)

  const handleRegister = async (data: RegisterForm) => {
    setError(null)
    if (!isSupabaseConfigured) {
      setError('Cadastro indisponível: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.')
      return
    }
    setRegLoading(true)
    try {
      const { error: err } = await supabase.auth.signUp({
        email:    data.email,
        password: data.password,
        options:  { data: { full_name: data.full_name } },
      })
      if (err) throw err
      setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
      setTab('login')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setRegLoading(false)
    }
  }

  // ── Reset password ─────────────────────────────────────────────────────
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) })
  const [resetLoading, setResetLoading] = useState(false)

  const handleReset = async (data: ResetForm) => {
    setError(null)
    if (!isSupabaseConfigured) {
      setError('Redefinição indisponível: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.')
      return
    }
    setResetLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: data.password })
      if (err) throw err
      setSuccess('Senha redefinida com sucesso!')
      setTab('login')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setResetLoading(false)
    }
  }

  const tabLabel: Record<Tab, string> = {
    login:    'Entrar',
    register: 'Criar conta',
    reset:    'Redefinir senha',
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0A0B] p-6"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(rgba(59,130,246,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.045) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 80% at 50% 40%, black 20%, transparent 80%)',
          maskImage: 'radial-gradient(ellipse 70% 80% at 50% 40%, black 20%, transparent 80%)',
        }}
      />
      <div className="pointer-events-none absolute right-[-140px] top-[-120px] h-[420px] w-[520px] rounded-full bg-[rgba(37,99,235,0.16)] blur-[110px]" />
      <div className="pointer-events-none absolute bottom-[-130px] left-[-120px] h-[320px] w-[380px] rounded-full bg-[rgba(59,130,246,0.08)] blur-[100px]" />

      <div className="relative w-full max-w-[430px] animate-fade-in rounded-[14px] border border-[rgba(255,255,255,0.06)] bg-[#111112]/95 p-8 shadow-2xl shadow-black/40 backdrop-blur">
        <button
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#18181A] text-sm text-[#A1A1AA] transition hover:border-[rgba(255,255,255,0.13)] hover:text-[#F4F4F5]"
        >
          🌐
        </button>

        <a className="mb-7 inline-flex" href="/login" aria-label="Kynovia">
          <KynoviaWordmark className="h-8 w-[128px]" />
        </a>

        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(37,99,235,0.22)] bg-[rgba(37,99,235,0.10)] py-[5px] pl-2 pr-3.5 font-mono text-[11.5px] font-medium tracking-[0.04em] text-[#93C5FD]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6] shadow-[0_0_6px_#3B82F6,0_0_12px_rgba(59,130,246,0.4)]" />
          SAP ACTIVATE
        </div>

        <h1 className="mb-1 text-[28px] font-bold leading-tight tracking-[-1.2px] text-[#F4F4F5]">
          KYNOVIA PROJECT MANAGEMENT
        </h1>
        <p className="mb-1 text-sm text-[#60A5FA]">
          SAP Activate Methodology
        </p>
        <p className="mb-6 text-[13.5px] leading-relaxed text-[#A1A1AA]">
          Acesse com sua conta para continuar
        </p>
        {!isSupabaseConfigured && (
          <div className="mb-4 rounded-[10px] border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.1)] px-4 py-3 text-xs leading-relaxed text-[#FCD34D]">
            Supabase ainda não configurado neste ambiente. Login real, cadastro e reset ficam bloqueados; o modo demo continua disponível.
          </div>
        )}

        <div className="mb-6 grid grid-cols-3 gap-1 rounded-[10px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0B] p-1">
          {(['login', 'register', 'reset'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`rounded-[8px] px-2 py-2.5 text-xs font-semibold transition ${tab === t ? 'bg-[#2563EB] text-white shadow-[0_0_0_4px_rgba(37,99,235,0.12)]' : 'text-[#A1A1AA] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F4F4F5]'}`}
              onClick={() => { setTab(t); setError(null); setSuccess(null) }}
            >
              {tabLabel[t]}
            </button>
          ))}
        </div>

        {/* Error / success */}
        {error && (
          <div className="mb-4 rounded-[10px] border border-[rgba(248,113,113,0.28)] bg-[rgba(127,29,29,0.35)] px-4 py-3 text-sm text-[#FCA5A5]">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-[10px] border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.12)] px-4 py-3 text-sm text-[#6EE7B7]">
            {success}
          </div>
        )}

        {/* ── LOGIN TAB ── */}
        {tab === 'login' && (
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
            <div>
              <label className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#52525B]">E-mail</label>
              <input
                {...loginForm.register('email')}
                type="email"
                placeholder="voce@empresa.com"
                className="w-full rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0B] px-3.5 py-2.5 text-sm text-[#F4F4F5] outline-none transition placeholder:text-[#52525B] focus:border-[#2563EB]"
              />
              {loginForm.formState.errors.email && (
                <p className="mt-1 text-xs text-[#FCA5A5]">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#52525B]">Senha</label>
              <input
                {...loginForm.register('password')}
                type="password"
                placeholder="••••••"
                className="w-full rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0B] px-3.5 py-2.5 text-sm text-[#F4F4F5] outline-none transition placeholder:text-[#52525B] focus:border-[#2563EB]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[8px] bg-[#2563EB] py-3 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#1D4ED8] hover:shadow-[0_0_0_4px_rgba(37,99,235,0.18),0_8px_24px_rgba(37,99,235,0.28)] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <button
              type="button"
              className="w-full rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-transparent py-3 text-sm font-semibold text-[#A1A1AA] transition hover:border-[rgba(255,255,255,0.13)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#F4F4F5]"
              onClick={handleDemoLogin}
            >
              Entrar em modo demo
            </button>

            <div className="rounded-[10px] border border-[rgba(59,130,246,0.18)] bg-[rgba(37,99,235,0.09)] px-4 py-3 font-mono text-[11px] leading-relaxed text-[#93C5FD]">
              Demo local: <strong>demo@sap.local</strong> / <strong>demo1234</strong>
            </div>

            <div className="text-center">
              <button
                type="button"
                className="text-sm font-medium text-[#60A5FA] hover:underline"
                onClick={() => setTab('reset')}
              >
                Esqueci minha senha
              </button>
            </div>

            <p className="mt-4 text-center text-xs leading-relaxed text-[#52525B]">
              Novos cadastros entram como <strong className="text-[#60A5FA]">Usuário</strong>.<br />
              Apenas o <strong className="text-[#FCD34D]">ADM</strong> pode promover perfis e apagar dados.
            </p>
          </form>
        )}

        {/* ── REGISTER TAB ── */}
        {tab === 'register' && (
          <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
            {(['full_name', 'email', 'password', 'confirm_password'] as const).map((field) => (
              <div key={field}>
                <label className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#52525B]">
                  {field === 'full_name'        ? 'Nome completo' :
                   field === 'email'             ? 'E-mail' :
                   field === 'password'          ? 'Senha (mínimo 8 caracteres)' :
                   'Confirmar senha'}
                </label>
                <input
                  {...registerForm.register(field)}
                  type={field.includes('password') ? 'password' : field === 'email' ? 'email' : 'text'}
                  placeholder={field.includes('password') ? '••••••••' : field === 'email' ? 'voce@empresa.com' : 'Seu nome completo'}
                  className="w-full rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0B] px-3.5 py-2.5 text-sm text-[#F4F4F5] outline-none transition placeholder:text-[#52525B] focus:border-[#2563EB]"
                />
                {registerForm.formState.errors[field] && (
                  <p className="mt-1 text-xs text-[#FCA5A5]">
                    {registerForm.formState.errors[field]?.message}
                  </p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={regLoading}
              className="w-full rounded-[8px] bg-[#2563EB] py-3 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#1D4ED8] hover:shadow-[0_0_0_4px_rgba(37,99,235,0.18),0_8px_24px_rgba(37,99,235,0.28)] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
            >
              {regLoading ? 'Criando conta...' : 'Criar conta e entrar'}
            </button>
          </form>
        )}

        {/* ── RESET TAB ── */}
        {tab === 'reset' && (
          <form onSubmit={resetForm.handleSubmit(handleReset)} className="space-y-4">
            <p className="mb-2 text-xs leading-relaxed text-[#A1A1AA]">
              Permitido para o ADM raiz ou quando ainda não há senha definida no sistema.
            </p>

            {(['email', 'password', 'confirm_password'] as const).map((field) => (
              <div key={field}>
                <label className="mb-1 block font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#52525B]">
                  {field === 'email'             ? 'E-mail' :
                   field === 'password'          ? 'Nova senha (mínimo 8 caracteres)' :
                   'Confirmar nova senha'}
                </label>
                <input
                  {...resetForm.register(field)}
                  type={field.includes('password') ? 'password' : 'email'}
                  placeholder={field.includes('password') ? '••••••••' : 'voce@empresa.com'}
                  className="w-full rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0B] px-3.5 py-2.5 text-sm text-[#F4F4F5] outline-none transition placeholder:text-[#52525B] focus:border-[#2563EB]"
                />
                {resetForm.formState.errors[field] && (
                  <p className="mt-1 text-xs text-[#FCA5A5]">
                    {resetForm.formState.errors[field]?.message}
                  </p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={resetLoading}
              className="w-full rounded-[8px] bg-[#2563EB] py-3 text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-[#1D4ED8] hover:shadow-[0_0_0_4px_rgba(37,99,235,0.18),0_8px_24px_rgba(37,99,235,0.28)] disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none"
            >
              {resetLoading ? 'Redefinindo...' : 'Redefinir e entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
