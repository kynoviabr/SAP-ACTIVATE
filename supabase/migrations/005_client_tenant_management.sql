-- Client / tenant administration for Kynovia Project Management.
-- Billing is modeled per project, without external payment integration.

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('SUPER_ADMIN','ADMIN','USER','VIEWER'));

alter table public.tenants
  add column if not exists legal_name text,
  add column if not exists trade_name text,
  add column if not exists cnpj text,
  add column if not exists state_registration text,
  add column if not exists municipal_registration text,
  add column if not exists tax_regime text,
  add column if not exists company_email text,
  add column if not exists company_phone text,
  add column if not exists company_whatsapp text,
  add column if not exists website text,
  add column if not exists zip_code text,
  add column if not exists address_line text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists district text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text not null default 'Brasil',
  add column if not exists billing_model text not null default 'per_project',
  add column if not exists billing_status text not null default 'active',
  add column if not exists project_unit_price numeric not null default 0,
  add column if not exists billing_currency text not null default 'BRL',
  add column if not exists billing_notes text;

alter table public.tenants drop constraint if exists tenants_billing_model_check;
alter table public.tenants
  add constraint tenants_billing_model_check check (billing_model in ('per_project'));

alter table public.tenants drop constraint if exists tenants_billing_status_check;
alter table public.tenants
  add constraint tenants_billing_status_check check (billing_status in ('trial','active','paused','cancelled'));

alter table public.tenants drop constraint if exists tenants_billing_currency_check;
alter table public.tenants
  add constraint tenants_billing_currency_check check (billing_currency in ('BRL'));

alter table public.tenants drop constraint if exists tenants_cnpj_alpha_check;
alter table public.tenants
  add constraint tenants_cnpj_alpha_check check (cnpj is null or cnpj = '' or cnpj ~ '^[A-Z0-9]{14}$');

create unique index if not exists idx_tenants_cnpj_unique
  on public.tenants (cnpj)
  where cnpj is not null and cnpj <> '';

create table if not exists public.tenant_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_type text not null check (contact_type in ('admin','billing','additional')),
  full_name text not null,
  job_title text,
  email text not null,
  whatsapp text,
  notes text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tenant_contacts_tenant_type
  on public.tenant_contacts (tenant_id, contact_type, sort_order);

drop trigger if exists set_updated_at_tenant_contacts on public.tenant_contacts;
create trigger set_updated_at_tenant_contacts
  before update on public.tenant_contacts
  for each row execute function public.set_updated_at();

alter table public.tenant_contacts enable row level security;

grant select, insert, update, delete on public.tenants to authenticated;
grant select, insert, update, delete on public.tenant_contacts to authenticated;

create or replace function app_private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.role = 'SUPER_ADMIN'
      and u.active = true
  );
$$;

revoke execute on function app_private.is_platform_admin() from public, anon;
grant execute on function app_private.is_platform_admin() to authenticated;

drop policy if exists tenants_super_admin_select on public.tenants;
create policy tenants_super_admin_select on public.tenants
  for select to authenticated
  using (app_private.is_platform_admin());

drop policy if exists tenants_super_admin_insert on public.tenants;
create policy tenants_super_admin_insert on public.tenants
  for insert to authenticated
  with check (app_private.is_platform_admin());

drop policy if exists tenants_super_admin_update on public.tenants;
create policy tenants_super_admin_update on public.tenants
  for update to authenticated
  using (app_private.is_platform_admin())
  with check (app_private.is_platform_admin());

drop policy if exists tenants_super_admin_delete on public.tenants;
create policy tenants_super_admin_delete on public.tenants
  for delete to authenticated
  using (app_private.is_platform_admin());

drop policy if exists users_super_admin_select on public.users;
create policy users_super_admin_select on public.users
  for select to authenticated
  using (app_private.is_platform_admin());

drop policy if exists users_super_admin_update on public.users;
create policy users_super_admin_update on public.users
  for update to authenticated
  using (app_private.is_platform_admin())
  with check (app_private.is_platform_admin());

drop policy if exists tenant_contacts_select on public.tenant_contacts;
create policy tenant_contacts_select on public.tenant_contacts
  for select to authenticated
  using (app_private.is_platform_admin() or app_private.same_tenant(tenant_id));

drop policy if exists tenant_contacts_insert on public.tenant_contacts;
create policy tenant_contacts_insert on public.tenant_contacts
  for insert to authenticated
  with check (app_private.is_platform_admin() or app_private.is_admin_for_tenant(tenant_id));

drop policy if exists tenant_contacts_update on public.tenant_contacts;
create policy tenant_contacts_update on public.tenant_contacts
  for update to authenticated
  using (app_private.is_platform_admin() or app_private.is_admin_for_tenant(tenant_id))
  with check (app_private.is_platform_admin() or app_private.is_admin_for_tenant(tenant_id));

drop policy if exists tenant_contacts_delete on public.tenant_contacts;
create policy tenant_contacts_delete on public.tenant_contacts
  for delete to authenticated
  using (app_private.is_platform_admin() or app_private.is_admin_for_tenant(tenant_id));
