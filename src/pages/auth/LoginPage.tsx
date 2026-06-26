// src/pages/AuthPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
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
      name: 'SAP Activate Demo',
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
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #1E2A78 0%, #3B4FE8 100%)' }}
    >
      <div
        className="bg-white rounded-[20px] shadow-2xl w-full max-w-md p-8 relative animate-fade-in"
      >
        {/* Language toggle */}
        <button
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-sm text-white hover:opacity-80 transition"
          style={{ background: '#1a1f3a' }}
        >
          🌐
        </button>

        {/* Title */}
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1E2A78' }}>
          SAP Activate Portal
        </h1>
        <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
          Acesse com sua conta para continuar
        </p>
        {!isSupabaseConfigured && (
          <div className="mb-4 px-4 py-3 rounded-lg text-xs" style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa', lineHeight: 1.5 }}>
            Supabase ainda não configurado neste ambiente. Login real, cadastro e reset ficam bloqueados; o modo demo continua disponível.
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b mb-6" style={{ borderColor: '#e5e7eb' }}>
          {(['login', 'register', 'reset'] as Tab[]).map((t) => (
            <button
              key={t}
              className="flex-1 py-3 text-sm font-medium transition-colors"
              style={{
                borderBottom: tab === t ? '2px solid #3B4FE8' : '2px solid transparent',
                color:        tab === t ? '#3B4FE8' : '#9ca3af',
                fontWeight:   tab === t ? 700 : 500,
              }}
              onClick={() => { setTab(t); setError(null); setSuccess(null) }}
            >
              {tabLabel[t]}
            </button>
          ))}
        </div>

        {/* Error / success */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
            {success}
          </div>
        )}

        {/* ── LOGIN TAB ── */}
        {tab === 'login' && (
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
            <div>
              <label className="label" style={{ color: '#475569' }}>E-mail</label>
              <input
                {...loginForm.register('email')}
                type="email"
                placeholder="voce@empresa.com"
                className="w-full px-3.5 py-2.5 rounded-[8px] text-sm outline-none transition"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
              />
              {loginForm.formState.errors.email && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="label" style={{ color: '#475569' }}>Senha</label>
              <input
                {...loginForm.register('password')}
                type="password"
                placeholder="••••••"
                className="w-full px-3.5 py-2.5 rounded-[8px] text-sm outline-none transition"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-[8px] font-bold text-sm text-white transition"
              style={{ background: '#3B4FE8', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <button
              type="button"
              className="w-full py-3 rounded-[8px] font-bold text-sm transition"
              style={{ background: '#F59E0B', color: '#1a1f3a' }}
              onClick={handleDemoLogin}
            >
              Entrar em modo demo
            </button>

            <div className="rounded-lg px-4 py-3 text-xs" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', lineHeight: 1.6 }}>
              Demo local: <strong>demo@sap.local</strong> / <strong>demo1234</strong>
            </div>

            <div className="text-center">
              <button
                type="button"
                className="text-sm font-medium hover:underline"
                style={{ color: '#F59E0B' }}
                onClick={() => setTab('reset')}
              >
                Esqueci minha senha
              </button>
            </div>

            <p className="text-center text-xs mt-4" style={{ color: '#9ca3af', lineHeight: 1.6 }}>
              Novos cadastros entram como <strong style={{ color: '#3B4FE8' }}>Usuário</strong>.<br />
              Apenas o <strong style={{ color: '#F59E0B' }}>ADM</strong> pode promover perfis e apagar dados.
            </p>
          </form>
        )}

        {/* ── REGISTER TAB ── */}
        {tab === 'register' && (
          <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
            {(['full_name', 'email', 'password', 'confirm_password'] as const).map((field) => (
              <div key={field}>
                <label className="label" style={{ color: '#475569' }}>
                  {field === 'full_name'        ? 'Nome completo' :
                   field === 'email'             ? 'E-mail' :
                   field === 'password'          ? 'Senha (mínimo 8 caracteres)' :
                   'Confirmar senha'}
                </label>
                <input
                  {...registerForm.register(field)}
                  type={field.includes('password') ? 'password' : field === 'email' ? 'email' : 'text'}
                  placeholder={field.includes('password') ? '••••••••' : field === 'email' ? 'voce@empresa.com' : 'Seu nome completo'}
                  className="w-full px-3.5 py-2.5 rounded-[8px] text-sm outline-none"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
                />
                {registerForm.formState.errors[field] && (
                  <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                    {registerForm.formState.errors[field]?.message}
                  </p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={regLoading}
              className="w-full py-3 rounded-[8px] font-bold text-sm text-white"
              style={{ background: '#3B4FE8', opacity: regLoading ? 0.7 : 1 }}
            >
              {regLoading ? 'Criando conta...' : 'Criar conta e entrar'}
            </button>
          </form>
        )}

        {/* ── RESET TAB ── */}
        {tab === 'reset' && (
          <form onSubmit={resetForm.handleSubmit(handleReset)} className="space-y-4">
            <p className="text-xs mb-2" style={{ color: '#9ca3af', lineHeight: 1.6 }}>
              Permitido para o ADM raiz ou quando ainda não há senha definida no sistema.
            </p>

            {(['email', 'password', 'confirm_password'] as const).map((field) => (
              <div key={field}>
                <label className="label" style={{ color: '#475569' }}>
                  {field === 'email'             ? 'E-mail' :
                   field === 'password'          ? 'Nova senha (mínimo 8 caracteres)' :
                   'Confirmar nova senha'}
                </label>
                <input
                  {...resetForm.register(field)}
                  type={field.includes('password') ? 'password' : 'email'}
                  placeholder={field.includes('password') ? '••••••••' : 'voce@empresa.com'}
                  className="w-full px-3.5 py-2.5 rounded-[8px] text-sm outline-none"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b' }}
                />
                {resetForm.formState.errors[field] && (
                  <p className="text-xs mt-1" style={{ color: '#ef4444' }}>
                    {resetForm.formState.errors[field]?.message}
                  </p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={resetLoading}
              className="w-full py-3 rounded-[8px] font-bold text-sm text-white"
              style={{ background: '#3B4FE8', opacity: resetLoading ? 0.7 : 1 }}
            >
              {resetLoading ? 'Redefinindo...' : 'Redefinir e entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
