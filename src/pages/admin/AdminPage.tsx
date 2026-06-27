import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, Edit3, Palette, Search, Shield, UserCheck, UserCog, Users } from 'lucide-react'
import { useAdmin } from '@/hooks/useAdmin'
import { useAuthStore } from '@/store'
import type { AIProvider, Tenant, User, UserRole } from '@/types'

const roles: UserRole[] = ['ADMIN', 'USER', 'VIEWER']
const providers: AIProvider[] = ['openai', 'anthropic', 'gemini']

export default function AdminPage() {
  const currentUser = useAuthStore((s) => s.user)
  const { users, tenant, summary, isDemo, isLoading, updateRole, updateActive, updateTenant } = useAdmin()
  const [search, setSearch] = useState('')
  const [tenantDraft, setTenantDraft] = useState<Partial<Tenant>>({
    name: tenant?.name,
    primary_color: tenant?.primary_color,
    secondary_color: tenant?.secondary_color,
    accent_color: tenant?.accent_color,
    logo_url: tenant?.logo_url,
    ai_provider: tenant?.ai_provider,
    ai_model: tenant?.ai_model,
  })

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return users
    return users.filter((user) =>
      [user.full_name, user.email, user.role].some((value) => value?.toLowerCase().includes(term))
    )
  }, [search, users])

  function saveTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateTenant.mutate({
      name: tenantDraft.name,
      primary_color: tenantDraft.primary_color,
      secondary_color: tenantDraft.secondary_color,
      accent_color: tenantDraft.accent_color,
      logo_url: tenantDraft.logo_url || undefined,
      ai_provider: tenantDraft.ai_provider,
      ai_model: tenantDraft.ai_model,
    })
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-blue">Administração</span>
          <h1 className="mt-3 text-2xl font-bold text-text-primary">Console administrativo</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Usuários, permissões, tenant e parâmetros de IA do portal.
          </p>
        </div>
        <div className="card2 min-w-[220px]">
          <div className="flex items-center gap-3">
            <span className="rounded-[8px] bg-[#0f1229] p-2 text-brand-600"><Shield className="h-5 w-5" /></span>
            <div>
              <p className="text-xs text-text-muted">Sessão atual</p>
              <p className="font-bold text-text-primary">{currentUser?.role ?? '-'}</p>
            </div>
          </div>
        </div>
      </header>

      {isDemo ? (
        <div className="mb-5 rounded-[10px] border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.1)] px-4 py-3 text-sm text-[#FCD34D]">
          Modo demo: alterações de usuários e tenant são simuladas nesta sessão.
        </div>
      ) : null}

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Kpi icon={<Users className="h-4 w-4" />} label="Usuários" value={summary.total} />
        <Kpi icon={<UserCheck className="h-4 w-4" />} label="Ativos" value={summary.active} />
        <Kpi icon={<Shield className="h-4 w-4" />} label="Admins" value={summary.admins} />
        <Kpi icon={<UserCog className="h-4 w-4" />} label="Viewers" value={summary.viewers} />
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Usuários do tenant</h2>
              <p className="text-sm text-text-secondary">Promova perfis e bloqueie acessos sem remover histórico.</p>
            </div>
            <label className="relative w-full sm:w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                className="input pl-9"
                placeholder="Buscar usuário"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          {isLoading ? (
            <div className="p-6 text-text-secondary">Carregando usuários...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[780px]">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Perfil</th>
                    <th>Status</th>
                    <th>Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      currentUserId={currentUser?.id}
                      onRole={(role) => updateRole.mutate({ userId: user.id, role })}
                      onActive={(active) => updateActive.mutate({ userId: user.id, active })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form className="card" onSubmit={saveTenant}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Configurações do tenant</h2>
              <p className="text-sm text-text-secondary">Identidade visual e provedor padrão de IA.</p>
            </div>
            <span className="rounded-[8px] bg-[#0f1229] p-2 text-brand-600"><Palette className="h-5 w-5" /></span>
          </div>

          <Input label="Nome do portal" value={tenantDraft.name ?? ''} onChange={(name) => setTenantDraft((draft) => ({ ...draft, name }))} />
          <Input label="Logo URL" value={tenantDraft.logo_url ?? ''} onChange={(logo_url) => setTenantDraft((draft) => ({ ...draft, logo_url }))} />

          <div className="grid gap-3 md:grid-cols-3">
            <ColorInput label="Primária" value={tenantDraft.primary_color ?? '#3B4FE8'} onChange={(primary_color) => setTenantDraft((draft) => ({ ...draft, primary_color }))} />
            <ColorInput label="Secundária" value={tenantDraft.secondary_color ?? '#1E2A78'} onChange={(secondary_color) => setTenantDraft((draft) => ({ ...draft, secondary_color }))} />
            <ColorInput label="Acento" value={tenantDraft.accent_color ?? '#F59E0B'} onChange={(accent_color) => setTenantDraft((draft) => ({ ...draft, accent_color }))} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label>
              <span className="label">Provedor IA</span>
              <select className="input" value={tenantDraft.ai_provider ?? 'openai'} onChange={(event) => setTenantDraft((draft) => ({ ...draft, ai_provider: event.target.value as AIProvider }))}>
                {providers.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
              </select>
            </label>
            <Input label="Modelo IA" value={tenantDraft.ai_model ?? ''} onChange={(ai_model) => setTenantDraft((draft) => ({ ...draft, ai_model }))} />
          </div>

          <div className="mt-5 flex justify-end">
            <button className="btn-primary" type="submit" disabled={updateTenant.isPending}>
              <CheckCircle2 className="h-4 w-4" />
              {updateTenant.isPending ? 'Salvando...' : 'Salvar tenant'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function UserRow({ user, currentUserId, onRole, onActive }: { user: User; currentUserId?: string; onRole: (role: UserRole) => void; onActive: (active: boolean) => void }) {
  const isSelf = user.id === currentUserId
  return (
    <tr>
      <td className="text-text-primary">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {initials(user.full_name)}
          </div>
          <span>{user.full_name}</span>
        </div>
      </td>
      <td>{user.email}</td>
      <td>
        <select className="input min-w-[120px] py-1.5" value={user.role} disabled={isSelf} onChange={(event) => onRole(event.target.value as UserRole)}>
          {roles.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </td>
      <td>
        <button
          className={`badge ${user.active ? 'badge-green' : 'badge-gray'}`}
          type="button"
          disabled={isSelf}
          onClick={() => onActive(!user.active)}
          title={isSelf ? 'Você não pode bloquear sua própria conta.' : 'Alternar status'}
        >
          {user.active ? 'Ativo' : 'Bloqueado'}
        </button>
      </td>
      <td>
        <div className="flex items-center gap-2">
          {new Date(user.created_at).toLocaleDateString('pt-BR')}
          {isSelf ? <span className="badge badge-blue">você</span> : null}
        </div>
      </td>
    </tr>
  )
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        <span className="rounded-[8px] bg-[#0f1229] p-2 text-brand-600">{icon}</span>
      </div>
      <strong className="mt-3 block text-2xl text-text-primary">{value}</strong>
    </div>
  )
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mb-4 block">
      <span className="label">{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <input className="h-10 w-11 rounded-[8px] border border-surface-border bg-surface-card p-1" type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <input className="input min-w-0" value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
