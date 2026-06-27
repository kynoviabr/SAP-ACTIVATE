-- Dedicated Macro Schedule module tables.
-- Kept separate from public.tasks to avoid changing phase/task behavior elsewhere.

create table if not exists public.macro_schedule_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app_private.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  wbs text not null,
  parent_id uuid references public.macro_schedule_tasks(id) on delete set null,
  title text not null default '',
  phase text not null default 'Prepare' check (phase in ('Prepare','Explore','Realize','Deploy','Run')),
  squad text,
  responsible text,
  allocation_pct integer not null default 100 check (allocation_pct between 0 and 100),
  start_date date,
  end_date date,
  is_milestone boolean not null default false,
  planned_pct integer not null default 0 check (planned_pct between 0 and 100),
  real_pct integer not null default 0 check (real_pct between 0 and 100),
  predecessors integer[] not null default '{}',
  hours numeric not null default 0,
  level integer not null default 2 check (level between 1 and 8),
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.macro_schedule_holidays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app_private.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  source text not null default 'manual' check (source in ('manual','br-national','detected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, holiday_date, name)
);

create index if not exists idx_macro_schedule_tasks_project_order
  on public.macro_schedule_tasks(project_id, sort_order);

create index if not exists idx_macro_schedule_tasks_tenant
  on public.macro_schedule_tasks(tenant_id);

create index if not exists idx_macro_schedule_tasks_project_parent
  on public.macro_schedule_tasks(project_id, parent_id);

create index if not exists idx_macro_schedule_holidays_project_date
  on public.macro_schedule_holidays(project_id, holiday_date);

create index if not exists idx_macro_schedule_holidays_tenant
  on public.macro_schedule_holidays(tenant_id);

drop trigger if exists set_updated_at_macro_schedule_tasks on public.macro_schedule_tasks;
create trigger set_updated_at_macro_schedule_tasks
  before update on public.macro_schedule_tasks
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_macro_schedule_holidays on public.macro_schedule_holidays;
create trigger set_updated_at_macro_schedule_holidays
  before update on public.macro_schedule_holidays
  for each row execute function public.set_updated_at();

alter table public.macro_schedule_tasks enable row level security;
alter table public.macro_schedule_holidays enable row level security;

grant select, insert, update, delete on public.macro_schedule_tasks to authenticated;
grant select, insert, update, delete on public.macro_schedule_holidays to authenticated;

drop policy if exists tenant_select on public.macro_schedule_tasks;
create policy tenant_select on public.macro_schedule_tasks
  for select to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_insert on public.macro_schedule_tasks;
create policy tenant_insert on public.macro_schedule_tasks
  for insert to authenticated
  with check (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_update on public.macro_schedule_tasks;
create policy tenant_update on public.macro_schedule_tasks
  for update to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin())
  with check (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_delete on public.macro_schedule_tasks;
create policy tenant_delete on public.macro_schedule_tasks
  for delete to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_select on public.macro_schedule_holidays;
create policy tenant_select on public.macro_schedule_holidays
  for select to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_insert on public.macro_schedule_holidays;
create policy tenant_insert on public.macro_schedule_holidays
  for insert to authenticated
  with check (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_update on public.macro_schedule_holidays;
create policy tenant_update on public.macro_schedule_holidays
  for update to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin())
  with check (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_delete on public.macro_schedule_holidays;
create policy tenant_delete on public.macro_schedule_holidays
  for delete to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());
