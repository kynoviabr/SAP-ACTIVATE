-- SAP Activate Portal initial schema
-- Safe for Supabase public Data API: explicit grants + RLS on user data tables.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid generated always as (id) stored,
  slug text not null unique,
  name text not null,
  logo_url text,
  primary_color text not null default '#3B4FE8',
  secondary_color text not null default '#1E2A78',
  accent_color text not null default '#F59E0B',
  domain text,
  plan text not null default 'professional' check (plan in ('free','professional','enterprise')),
  max_projects integer not null default 10,
  max_users integer not null default 50,
  ai_provider text not null default 'openai',
  ai_model text not null default 'gpt-4-turbo',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'USER' check (role in ('ADMIN','USER','VIEWER')),
  avatar_url text,
  active boolean not null default true,
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.users where id = auth.uid() limit 1
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_name text;
  v_email text;
begin
  v_email := coalesce(new.email, 'user-' || new.id::text || '@local');
  v_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(v_email, '@', 1), 'Usuário');

  insert into public.tenants (slug, name)
  values ('tenant-' || left(new.id::text, 8), coalesce(new.raw_user_meta_data->>'tenant_name', 'SAP Activate'))
  returning id into v_tenant_id;

  insert into public.users (id, tenant_id, full_name, email, role)
  values (new.id, v_tenant_id, v_name, v_email, 'ADMIN')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  name text not null,
  client text not null,
  project_manager text not null,
  pm_user_id uuid references public.users(id),
  sponsor text,
  sponsor_email text,
  objective text,
  methodology text not null default 'SAP Activate',
  current_phase text not null default '1' check (current_phase in ('1','2','3','4','5')),
  status text not null default 'verde' check (status in ('verde','amarelo','vermelho','encerrado')),
  start_date date not null,
  golive_date date not null,
  spi numeric not null default 1,
  cpi numeric not null default 1,
  progress_pct integer not null default 0,
  planned_value numeric not null default 0,
  earned_value numeric not null default 0,
  actual_cost numeric not null default 0,
  modules text[] not null default '{}',
  tags text[] not null default '{}',
  active boolean not null default true,
  archived boolean not null default false,
  created_by uuid references public.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references public.users(id),
  full_name text not null,
  email text not null,
  role text not null default 'USER' check (role in ('ADMIN','USER','VIEWER')),
  module text,
  function text,
  is_leader boolean not null default false,
  company text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.tasks(id) on delete set null,
  wbs text not null,
  title text not null,
  phase text check (phase in ('1','2','3','4','5')),
  type text not null default 'task' check (type in ('phase','task','milestone')),
  start_date date,
  end_date date,
  duration_days integer,
  assignee text,
  status text not null default 'pendente' check (status in ('pendente','em_andamento','concluido','atrasado','cancelado')),
  progress_pct integer not null default 0,
  planned_hours numeric not null default 0,
  actual_hours numeric not null default 0,
  dependencies text[] not null default '{}',
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  issue_number integer generated by default as identity,
  code text generated always as ('ISS-' || lpad(issue_number::text, 3, '0')) stored,
  description text not null,
  issue_type text not null check (issue_type in ('tecnica','processo','gestao','cliente','escopo')),
  priority text not null default 'media' check (priority in ('baixa','media','alta','critica')),
  phase text check (phase in ('1','2','3','4','5')),
  status text not null default 'aberta' check (status in ('aberta','em_andamento','resolvida','atrasada','cancelada')),
  assignee text,
  opened_by text,
  due_date date,
  resolved_at timestamptz,
  action_plan text,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.risks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  risk_number integer generated by default as identity,
  code text generated always as ('RSK-' || lpad(risk_number::text, 3, '0')) stored,
  description text not null,
  category text not null check (category in ('tecnico','prazo','recursos','escopo','externo','qualidade')),
  phase text check (phase in ('1','2','3','4','5')),
  impact integer not null default 1,
  probability integer not null default 1,
  exposure integer generated always as (impact * probability) stored,
  severity text generated always as (
    case
      when impact * probability >= 15 then 'critico'
      when impact * probability >= 8 then 'alto'
      when impact * probability >= 4 then 'medio'
      else 'baixo'
    end
  ) stored,
  status text not null default 'identificado' check (status in ('identificado','em_mitigacao','mitigado','ocorrido')),
  assignee text,
  mitigation text,
  contingency text,
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bpd_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  bpd_id text not null,
  module text not null,
  process_name text not null,
  version text not null default '1.0',
  priority text not null default 'media' check (priority in ('alta','media','baixa')),
  item_type text not null default 'obrigatorio' check (item_type in ('obrigatorio','desejavel','futuro')),
  status text not null default 'pendente' check (status in ('pendente','em_andamento','concluido')),
  legal_refs text,
  consultant text,
  key_user text,
  reviewer text,
  approver text,
  as_is text,
  to_be text,
  triggers text,
  solution text,
  gap_type text not null default 'standard' check (gap_type in ('standard','config','development')),
  complexity text not null default 'media' check (complexity in ('baixa','media','alta','critica')),
  effort_hours numeric not null default 0,
  acceptance text,
  exclusions text,
  client_signed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quality_gate_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  phase text not null check (phase in ('1','2','3','4','5')),
  description text not null,
  required boolean not null default true,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.quality_gate_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  template_id uuid not null references public.quality_gate_templates(id) on delete cascade,
  phase text not null check (phase in ('1','2','3','4','5')),
  answer text check (answer in ('sim','nao','na')),
  notes text,
  answered_by uuid references public.users(id) default auth.uid(),
  answered_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, template_id)
);

create table if not exists public.quality_gate_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  phase text not null check (phase in ('1','2','3','4','5')),
  decision text not null check (decision in ('aprovado','rejeitado')),
  comments text,
  decided_by uuid references public.users(id) default auth.uid(),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, phase)
);

create table if not exists public.kickoffs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null unique references public.projects(id) on delete cascade,
  kickoff_date timestamptz,
  location text,
  platform text not null default 'Teams',
  duration_hours numeric not null default 1,
  modality text not null default 'remoto' check (modality in ('remoto','presencial','hibrido')),
  objective text,
  agenda text,
  results text,
  decisions text,
  next_steps text,
  gp_signed_at timestamptz,
  sponsor_signed_at timestamptz,
  presentation_url text,
  minutes_url text,
  ai_generated boolean not null default false,
  ai_content jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  phase text not null check (phase in ('1','2','3','4','5')),
  label text not null,
  start_date date,
  end_date date,
  planned_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, phase)
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.users(id),
  user_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.costs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  category text,
  amount numeric not null default 0,
  currency text not null default 'BRL',
  date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cr_number integer generated by default as identity,
  title text not null,
  description text,
  impact text,
  requester text,
  status text not null default 'aberta' check (status in ('aberta','aprovada','rejeitada','cancelada')),
  decision_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone text not null,
  amount numeric not null default 0,
  currency text not null default 'BRL',
  due_date date,
  invoice_date date,
  payment_date date,
  status text not null default 'pendente' check (status in ('pendente','faturado','pago','cancelado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.travels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  traveler text not null,
  destination text,
  departure_date date,
  return_date date,
  purpose text,
  estimated_cost numeric,
  actual_cost numeric,
  status text not null default 'solicitada' check (status in ('solicitada','aprovada','realizada','cancelada')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.template_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  template_key text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','completed')),
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, template_key)
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'tenants','users','projects','project_members','tasks','issues','risks','bpd_items',
    'quality_gate_templates','quality_gate_answers','quality_gate_decisions','kickoffs',
    'project_phases','activity_log','costs','change_requests','billing','travels','template_states'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    if t <> 'activity_log' and t <> 'quality_gate_templates' then
      execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    end if;
  end loop;
end $$;

create index if not exists idx_projects_tenant on public.projects(tenant_id);
create index if not exists idx_tasks_project_phase on public.tasks(project_id, phase, sort_order);
create index if not exists idx_issues_project on public.issues(project_id);
create index if not exists idx_risks_project on public.risks(project_id);
create index if not exists idx_template_states_project on public.template_states(project_id, template_key);

alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.issues enable row level security;
alter table public.risks enable row level security;
alter table public.bpd_items enable row level security;
alter table public.quality_gate_templates enable row level security;
alter table public.quality_gate_answers enable row level security;
alter table public.quality_gate_decisions enable row level security;
alter table public.kickoffs enable row level security;
alter table public.project_phases enable row level security;
alter table public.activity_log enable row level security;
alter table public.costs enable row level security;
alter table public.change_requests enable row level security;
alter table public.billing enable row level security;
alter table public.travels enable row level security;
alter table public.template_states enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;

create or replace function public.same_tenant(row_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select row_tenant = public.current_tenant_id()
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'projects','project_members','tasks','issues','risks','bpd_items',
    'quality_gate_answers','quality_gate_decisions','kickoffs','project_phases',
    'activity_log','costs','change_requests','billing','travels','template_states'
  ]
  loop
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format('drop policy if exists tenant_delete on public.%I', t);
    execute format('create policy tenant_select on public.%I for select to authenticated using (public.same_tenant(tenant_id))', t);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (public.same_tenant(tenant_id))', t);
    execute format('create policy tenant_update on public.%I for update to authenticated using (public.same_tenant(tenant_id)) with check (public.same_tenant(tenant_id))', t);
    execute format('create policy tenant_delete on public.%I for delete to authenticated using (public.same_tenant(tenant_id))', t);
  end loop;
end $$;

drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select to authenticated using (id = public.current_tenant_id());

drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated using (tenant_id = public.current_tenant_id());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists qg_templates_select on public.quality_gate_templates;
create policy qg_templates_select on public.quality_gate_templates
  for select to authenticated using (active = true and (tenant_id is null or tenant_id = public.current_tenant_id()));

insert into public.quality_gate_templates (phase, description, required, sort_order) values
('1', 'Kickoff com sponsor e key-users', true, 1),
('1', 'Ata assinada', true, 2),
('1', 'Cronograma aprovado', true, 3),
('1', 'Escopo aceito', true, 4),
('1', 'Equipe definida', true, 5),
('1', 'Plano comunicação', true, 6),
('1', 'Ambientes SAP disponíveis', true, 7),
('1', 'Licenças confirmadas', true, 8),
('1', 'Portal configurado', false, 9),
('1', 'Riscos identificados', false, 10),
('2', 'BPDs concluídos', true, 1),
('2', 'GAP aprovado', true, 2),
('2', 'Solução validada', true, 3),
('2', 'RICEFW estimados', true, 4),
('2', 'Plano migração', true, 5),
('2', 'Plano testes', true, 6),
('2', 'Plano treinamento', false, 7),
('2', 'Arquitetura documentada', true, 8),
('2', 'Interfaces especificadas', false, 9),
('2', 'BPDs assinados', true, 10),
('2', 'Riscos atualizados', false, 11),
('3', 'Configuração concluída', true, 1),
('3', 'Requests transportadas', true, 2),
('3', 'SIT executado', true, 3),
('3', 'Bugs críticos resolvidos', true, 4),
('3', 'Status report aprovado', false, 5),
('3', 'Monitoramento atualizado', false, 6),
('4', 'Runbook aprovado', true, 1),
('4', 'UAT final aprovado', true, 2),
('4', 'Plano de transição aprovado', true, 3),
('4', 'Critério Go/No-Go definido', true, 4),
('5', 'Hypercare encerrado', true, 1),
('5', 'Lições aprendidas registradas', true, 2),
('5', 'Termo de aceite assinado', true, 3),
('5', 'Transição para AMS concluída', true, 4)
on conflict do nothing;

insert into storage.buckets (id, name, public)
values ('project-attachments', 'project-attachments', true)
on conflict (id) do nothing;

drop policy if exists project_attachments_read on storage.objects;
create policy project_attachments_read on storage.objects
  for select to authenticated using (bucket_id = 'project-attachments');

drop policy if exists project_attachments_insert on storage.objects;
create policy project_attachments_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'project-attachments');

drop policy if exists project_attachments_update on storage.objects;
create policy project_attachments_update on storage.objects
  for update to authenticated using (bucket_id = 'project-attachments') with check (bucket_id = 'project-attachments');

drop policy if exists project_attachments_delete on storage.objects;
create policy project_attachments_delete on storage.objects
  for delete to authenticated using (bucket_id = 'project-attachments');

