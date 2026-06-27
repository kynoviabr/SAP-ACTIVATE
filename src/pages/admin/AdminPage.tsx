import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Building2, CheckCircle2, CircleDollarSign, Palette, Plus, Search, Shield, UserCheck, Users } from 'lucide-react'
import { useAdmin } from '@/hooks/useAdmin'
import { useAuthStore } from '@/store'
import type { AIProvider, CreateTenantInput, Tenant, TenantContactInput, TenantContactType, User, UserRole } from '@/types'

const platformRoles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'USER', 'VIEWER']
const tenantRoles: UserRole[] = ['ADMIN', 'USER', 'VIEWER']
const providers: AIProvider[] = ['openai', 'anthropic', 'gemini']
const contactLabels: Record<TenantContactType, string> = {
  admin: 'Administrador',
  billing: 'Cobranca/Faturamento',
  additional: 'Contato adicional',
}

type ContactDraft = Omit<TenantContactInput, 'tenant_id' | 'active' | 'sort_order'>

const emptyContact = (contact_type: TenantContactType): ContactDraft => ({
  contact_type,
  full_name: '',
  job_title: '',
  email: '',
  whatsapp: '',
  notes: '',
})

const initialContacts = (): ContactDraft[] => [
  emptyContact('admin'),
  emptyContact('billing'),
  emptyContact('additional'),
  emptyContact('additional'),
]

const initialClient: CreateTenantInput = {
  slug: '',
  name: '',
  legal_name: '',
  trade_name: '',
  cnpj: '',
  state_registration: '',
  municipal_registration: '',
  tax_regime: '',
  company_email: '',
  company_phone: '',
  company_whatsapp: '',
  website: '',
  zip_code: '',
  address_line: '',
  address_number: '',
  address_complement: '',
  district: '',
  city: '',
  state: '',
  country: 'Brasil',
  plan: 'professional',
  billing_model: 'per_project',
  billing_status: 'active',
  project_unit_price: 0,
  billing_currency: 'BRL',
  billing_notes: '',
  max_projects: 10,
  max_users: 50,
  primary_color: '#3B4FE8',
  secondary_color: '#1E2A78',
  accent_color: '#F59E0B',
  ai_provider: 'openai',
  ai_model: 'gpt-4-turbo',
  active: true,
}

export default function AdminPage() {
  const currentUser = useAuthStore((s) => s.user)
  const {
    users,
    tenant,
    tenants,
    tenantContacts,
    summary,
    isDemo,
    isPlatformAdmin,
    isLoading,
    updateRole,
    updateActive,
    updateTenant,
    createTenant,
    updateTenantById,
  } = useAdmin()
  const [search, setSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clientDraft, setClientDraft] = useState<CreateTenantInput>(initialClient)
  const [contactsDraft, setContactsDraft] = useState<ContactDraft[]>(initialContacts)
  const [formError, setFormError] = useState('')
  const canManageClients = isPlatformAdmin || isDemo
  const [tenantDraft, setTenantDraft] = useState<Partial<Tenant>>({})

  useEffect(() => {
    setTenantDraft({
      name: tenant?.name,
      primary_color: tenant?.primary_color,
      secondary_color: tenant?.secondary_color,
      accent_color: tenant?.accent_color,
      logo_url: tenant?.logo_url,
      ai_provider: tenant?.ai_provider,
      ai_model: tenant?.ai_model,
    })
  }, [tenant])

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return users
    return users.filter((user) =>
      [user.full_name, user.email, user.role].some((value) => value?.toLowerCase().includes(term))
    )
  }, [search, users])

  const filteredTenants = useMemo(() => {
    const term = clientSearch.trim().toLowerCase()
    if (!term) return tenants
    return tenants.filter((item) =>
      [item.name, item.legal_name, item.trade_name, item.cnpj, item.city, item.state].some((value) => value?.toLowerCase().includes(term))
    )
  }, [clientSearch, tenants])

  const tenantContactsByTenant = useMemo(() => {
    return tenantContacts.reduce<Record<string, typeof tenantContacts>>((acc, contact) => {
      acc[contact.tenant_id] = [...(acc[contact.tenant_id] ?? []), contact]
      return acc
    }, {})
  }, [tenantContacts])

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

  function updateClient<K extends keyof CreateTenantInput>(key: K, value: CreateTenantInput[K]) {
    setClientDraft((draft) => {
      const next = { ...draft, [key]: value }
      if (key === 'name' && !draft.slug) next.slug = slugify(String(value))
      return next
    })
  }

  function updateContact(index: number, field: keyof ContactDraft, value: string) {
    setContactsDraft((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  }

  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const cnpj = normalizeCnpj(clientDraft.cnpj ?? '')
    if (!clientDraft.name?.trim() || !clientDraft.legal_name?.trim()) {
      setFormError('Informe nome do cliente e razao social.')
      return
    }
    if (!isValidAlphaCnpj(cnpj)) {
      setFormError('Informe um CNPJ alfanumerico com 14 caracteres.')
      return
    }
    const requiredContacts = contactsDraft.slice(0, 2)
    if (requiredContacts.some((contact) => !contact.full_name.trim() || !contact.email.trim())) {
      setFormError('Administrador e contato de cobranca precisam de nome completo e e-mail.')
      return
    }

    const tenantInput: CreateTenantInput = {
      ...clientDraft,
      slug: clientDraft.slug?.trim() || slugify(clientDraft.name),
      name: clientDraft.name.trim(),
      legal_name: clientDraft.legal_name?.trim(),
      trade_name: clientDraft.trade_name?.trim() || clientDraft.name.trim(),
      cnpj,
      project_unit_price: Number(clientDraft.project_unit_price ?? 0),
      max_projects: Number(clientDraft.max_projects ?? 10),
      max_users: Number(clientDraft.max_users ?? 50),
      billing_model: 'per_project',
      billing_currency: 'BRL',
      active: true,
    }

    const contacts: TenantContactInput[] = contactsDraft
      .filter((contact, index) => index < 2 || contact.full_name.trim() || contact.email.trim() || contact.whatsapp?.trim())
      .map((contact, index) => ({
        tenant_id: '',
        contact_type: contact.contact_type,
        full_name: contact.full_name.trim(),
        job_title: contact.job_title?.trim(),
        email: contact.email.trim(),
        whatsapp: contact.whatsapp?.trim(),
        notes: contact.notes?.trim(),
        sort_order: index,
        active: true,
      }))

    await createTenant.mutateAsync({ tenant: tenantInput, contacts })
    setClientDraft(initialClient)
    setContactsDraft(initialContacts())
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="badge badge-blue">Administracao</span>
          <h1 className="mt-3 text-2xl font-bold text-text-primary">Console administrativo</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Clientes, tenants, usuarios, identidade visual e parametros operacionais do portal.
          </p>
        </div>
        <div className="card2 min-w-[220px]">
          <div className="flex items-center gap-3">
            <span className="rounded-[8px] bg-[#0f1229] p-2 text-brand-600"><Shield className="h-5 w-5" /></span>
            <div>
              <p className="text-xs text-text-muted">Sessao atual</p>
              <p className="font-bold text-text-primary">{currentUser?.role ?? '-'}</p>
            </div>
          </div>
        </div>
      </header>

      {isDemo ? (
        <div className="mb-5 rounded-[10px] border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.1)] px-4 py-3 text-sm text-[#FCD34D]">
          Modo demo: alteracoes de usuarios, clientes e tenant sao simuladas nesta sessao.
        </div>
      ) : null}

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <Kpi icon={<Users className="h-4 w-4" />} label="Usuarios" value={summary.total} />
        <Kpi icon={<UserCheck className="h-4 w-4" />} label="Ativos" value={summary.active} />
        <Kpi icon={<Shield className="h-4 w-4" />} label="Admins" value={summary.admins} />
        <Kpi icon={<Building2 className="h-4 w-4" />} label="Clientes" value={tenants.length} />
      </section>

      {canManageClients ? (
        <section className="mb-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <form className="card" onSubmit={saveClient}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Novo cliente / tenant</h2>
                <p className="text-sm text-text-secondary">Cadastro Brasil com CNPJ alfanumerico e cobranca conceitual por projeto.</p>
              </div>
              <span className="rounded-[8px] bg-[#0f1229] p-2 text-brand-600"><Plus className="h-5 w-5" /></span>
            </div>

            {formError ? <div className="mb-4 rounded-[8px] border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</div> : null}

            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Nome comercial*" value={clientDraft.name ?? ''} onChange={(value) => updateClient('name', value)} />
              <Input label="Slug*" value={clientDraft.slug ?? ''} onChange={(value) => updateClient('slug', slugify(value))} />
              <Input label="Razao social*" value={clientDraft.legal_name ?? ''} onChange={(value) => updateClient('legal_name', value)} />
              <Input label="Nome fantasia" value={clientDraft.trade_name ?? ''} onChange={(value) => updateClient('trade_name', value)} />
              <Input label="CNPJ alfanumerico*" value={clientDraft.cnpj ?? ''} onChange={(value) => updateClient('cnpj', value.toUpperCase())} />
              <Input label="Regime tributario" value={clientDraft.tax_regime ?? ''} onChange={(value) => updateClient('tax_regime', value)} />
              <Input label="Inscricao estadual" value={clientDraft.state_registration ?? ''} onChange={(value) => updateClient('state_registration', value)} />
              <Input label="Inscricao municipal" value={clientDraft.municipal_registration ?? ''} onChange={(value) => updateClient('municipal_registration', value)} />
              <Input label="E-mail corporativo" value={clientDraft.company_email ?? ''} onChange={(value) => updateClient('company_email', value)} />
              <Input label="WhatsApp corporativo" value={clientDraft.company_whatsapp ?? ''} onChange={(value) => updateClient('company_whatsapp', value)} />
              <Input label="Telefone" value={clientDraft.company_phone ?? ''} onChange={(value) => updateClient('company_phone', value)} />
              <Input label="Website" value={clientDraft.website ?? ''} onChange={(value) => updateClient('website', value)} />
            </div>

            <div className="mt-2 grid gap-3 md:grid-cols-[0.8fr_1.2fr_0.6fr]">
              <Input label="CEP" value={clientDraft.zip_code ?? ''} onChange={(value) => updateClient('zip_code', value)} />
              <Input label="Endereco" value={clientDraft.address_line ?? ''} onChange={(value) => updateClient('address_line', value)} />
              <Input label="Numero" value={clientDraft.address_number ?? ''} onChange={(value) => updateClient('address_number', value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Input label="Complemento" value={clientDraft.address_complement ?? ''} onChange={(value) => updateClient('address_complement', value)} />
              <Input label="Bairro" value={clientDraft.district ?? ''} onChange={(value) => updateClient('district', value)} />
              <Input label="Cidade" value={clientDraft.city ?? ''} onChange={(value) => updateClient('city', value)} />
              <Input label="UF" value={clientDraft.state ?? ''} onChange={(value) => updateClient('state', value.toUpperCase().slice(0, 2))} />
            </div>

            <div className="mt-4 rounded-[8px] border border-surface-border bg-[#0f1229]/45 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
                <CircleDollarSign className="h-4 w-4 text-brand-600" />
                Acesso vendido por projeto
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <NumberInput label="Projetos contratados" value={clientDraft.max_projects ?? 10} onChange={(value) => updateClient('max_projects', value)} />
                <NumberInput label="Valor por projeto (BRL)" value={clientDraft.project_unit_price ?? 0} onChange={(value) => updateClient('project_unit_price', value)} />
                <label>
                  <span className="label">Status comercial</span>
                  <select className="input" value={clientDraft.billing_status ?? 'active'} onChange={(event) => updateClient('billing_status', event.target.value as CreateTenantInput['billing_status'])}>
                    <option value="trial">Trial</option>
                    <option value="active">Ativo</option>
                    <option value="paused">Pausado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </label>
              </div>
              <label className="mt-3 block">
                <span className="label">Observacoes comerciais</span>
                <textarea className="input min-h-[72px]" value={clientDraft.billing_notes ?? ''} onChange={(event) => updateClient('billing_notes', event.target.value)} />
              </label>
            </div>

            <div className="mt-4 space-y-3">
              {contactsDraft.map((contact, index) => (
                <ContactEditor
                  key={`${contact.contact_type}-${index}`}
                  index={index}
                  contact={contact}
                  onChange={updateContact}
                />
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button className="btn-primary" type="submit" disabled={createTenant.isPending}>
                <CheckCircle2 className="h-4 w-4" />
                {createTenant.isPending ? 'Criando...' : 'Criar cliente'}
              </button>
            </div>
          </form>

          <div className="card overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Clientes cadastrados</h2>
                <p className="text-sm text-text-secondary">Tenants com cobranca por projeto e contatos principais.</p>
              </div>
              <label className="relative w-full sm:w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input className="input pl-9" placeholder="Buscar cliente" value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} />
              </label>
            </div>
            <div className="max-h-[900px] overflow-y-auto p-4">
              <div className="space-y-3">
                {filteredTenants.map((item) => (
                  <TenantCard
                    key={item.id}
                    tenant={item}
                    contacts={tenantContactsByTenant[item.id] ?? []}
                    onCommercialChange={(input) => updateTenantById.mutate({ tenantId: item.id, input })}
                  />
                ))}
                {filteredTenants.length === 0 ? <p className="p-4 text-sm text-text-secondary">Nenhum cliente encontrado.</p> : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Usuarios do tenant</h2>
              <p className="text-sm text-text-secondary">Promova perfis e bloqueie acessos sem remover historico.</p>
            </div>
            <label className="relative w-full sm:w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input className="input pl-9" placeholder="Buscar usuario" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
          </div>
          {isLoading ? (
            <div className="p-6 text-text-secondary">Carregando usuarios...</div>
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
                      roleOptions={isPlatformAdmin ? platformRoles : tenantRoles}
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
              <h2 className="text-lg font-bold text-text-primary">Configuracoes do tenant</h2>
              <p className="text-sm text-text-secondary">Identidade visual e provedor padrao de IA.</p>
            </div>
            <span className="rounded-[8px] bg-[#0f1229] p-2 text-brand-600"><Palette className="h-5 w-5" /></span>
          </div>

          <Input label="Nome do portal" value={tenantDraft.name ?? ''} onChange={(name) => setTenantDraft((draft) => ({ ...draft, name }))} />
          <Input label="Logo URL" value={tenantDraft.logo_url ?? ''} onChange={(logo_url) => setTenantDraft((draft) => ({ ...draft, logo_url }))} />

          <div className="grid gap-3 md:grid-cols-3">
            <ColorInput label="Primaria" value={tenantDraft.primary_color ?? '#3B4FE8'} onChange={(primary_color) => setTenantDraft((draft) => ({ ...draft, primary_color }))} />
            <ColorInput label="Secundaria" value={tenantDraft.secondary_color ?? '#1E2A78'} onChange={(secondary_color) => setTenantDraft((draft) => ({ ...draft, secondary_color }))} />
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

function ContactEditor({ index, contact, onChange }: { index: number; contact: ContactDraft; onChange: (index: number, field: keyof ContactDraft, value: string) => void }) {
  return (
    <div className="rounded-[8px] border border-surface-border bg-[#0f1229]/45 p-4">
      <div className="mb-3 text-sm font-semibold text-text-primary">{contactLabels[contact.contact_type]} {index > 1 ? index - 1 : ''}</div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Nome completo" value={contact.full_name} onChange={(value) => onChange(index, 'full_name', value)} />
        <Input label="Cargo" value={contact.job_title ?? ''} onChange={(value) => onChange(index, 'job_title', value)} />
        <Input label="E-mail" value={contact.email} onChange={(value) => onChange(index, 'email', value)} />
        <Input label="WhatsApp" value={contact.whatsapp ?? ''} onChange={(value) => onChange(index, 'whatsapp', value)} />
      </div>
    </div>
  )
}

function TenantCard({ tenant, contacts, onCommercialChange }: { tenant: Tenant; contacts: { contact_type: TenantContactType; full_name: string; email: string; whatsapp?: string }[]; onCommercialChange: (input: Partial<Tenant>) => void }) {
  return (
    <article className="rounded-[8px] border border-surface-border bg-[#0f1229]/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-text-primary">{tenant.name}</h3>
            <span className="badge badge-blue">{tenant.billing_model === 'per_project' ? 'Por projeto' : 'Comercial'}</span>
            <span className={`badge ${tenant.active ? 'badge-green' : 'badge-gray'}`}>{tenant.active ? 'Ativo' : 'Inativo'}</span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">{tenant.legal_name ?? tenant.trade_name ?? tenant.slug}</p>
          <p className="mt-1 text-xs text-text-muted">{tenant.cnpj ? `CNPJ ${tenant.cnpj}` : 'CNPJ nao informado'} {tenant.city ? `- ${tenant.city}/${tenant.state ?? ''}` : ''}</p>
        </div>
        <div className="grid min-w-[260px] gap-2 sm:grid-cols-2">
          <NumberInput label="Projetos" value={tenant.max_projects} onChange={(max_projects) => onCommercialChange({ max_projects })} />
          <NumberInput label="Valor BRL" value={tenant.project_unit_price ?? 0} onChange={(project_unit_price) => onCommercialChange({ project_unit_price })} />
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {contacts.slice(0, 4).map((contact) => (
          <div key={`${contact.contact_type}-${contact.email}`} className="rounded-[8px] border border-surface-border/70 bg-surface-card/60 p-3">
            <p className="text-xs font-semibold uppercase text-brand-600">{contactLabels[contact.contact_type]}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{contact.full_name}</p>
            <p className="text-xs text-text-secondary">{contact.email}</p>
            {contact.whatsapp ? <p className="text-xs text-text-muted">{contact.whatsapp}</p> : null}
          </div>
        ))}
      </div>
    </article>
  )
}

function UserRow({ user, currentUserId, roleOptions, onRole, onActive }: { user: User; currentUserId?: string; roleOptions: UserRole[]; onRole: (role: UserRole) => void; onActive: (active: boolean) => void }) {
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
        <select className="input min-w-[140px] py-1.5" value={user.role} disabled={isSelf} onChange={(event) => onRole(event.target.value as UserRole)}>
          {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </td>
      <td>
        <button className={`badge ${user.active ? 'badge-green' : 'badge-gray'}`} type="button" disabled={isSelf} onClick={() => onActive(!user.active)} title={isSelf ? 'Voce nao pode bloquear sua propria conta.' : 'Alternar status'}>
          {user.active ? 'Ativo' : 'Bloqueado'}
        </button>
      </td>
      <td>
        <div className="flex items-center gap-2">
          {new Date(user.created_at).toLocaleDateString('pt-BR')}
          {isSelf ? <span className="badge badge-blue">voce</span> : null}
        </div>
      </td>
    </tr>
  )
}

function Kpi({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
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
    <label className="mb-3 block">
      <span className="label">{label}</span>
      <input className="input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="mb-3 block">
      <span className="label">{label}</span>
      <input className="input" min={0} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
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
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function normalizeCnpj(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function isValidAlphaCnpj(value: string) {
  return /^[A-Z0-9]{14}$/.test(value)
}
