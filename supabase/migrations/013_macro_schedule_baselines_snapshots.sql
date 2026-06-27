-- Audit-grade governance for Macro Schedule baselines and cut-off measurements.

create table if not exists public.macro_schedule_baselines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app_private.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  version integer not null,
  name text not null default '',
  baseline_date date not null default current_date,
  status text not null default 'locked' check (status in ('locked','superseded')),
  locked_at timestamptz not null default now(),
  locked_by text,
  notes text,
  task_count integer not null default 0,
  total_weight numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, version)
);

create table if not exists public.macro_schedule_baseline_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app_private.current_tenant_id() references public.tenants(id) on delete cascade,
  baseline_id uuid not null references public.macro_schedule_baselines(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  original_task_id uuid,
  wbs text not null,
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
  created_at timestamptz not null default now()
);

create table if not exists public.macro_schedule_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app_private.current_tenant_id() references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  baseline_id uuid references public.macro_schedule_baselines(id) on delete set null,
  status_date date not null,
  measured_at timestamptz not null default now(),
  measured_by text,
  notes text,
  task_count integer not null default 0,
  total_weight numeric not null default 0,
  planned_pct numeric not null default 0,
  real_pct numeric not null default 0,
  pv numeric not null default 0,
  ev numeric not null default 0,
  spi numeric,
  delayed_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, status_date)
);

create table if not exists public.macro_schedule_snapshot_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default app_private.current_tenant_id() references public.tenants(id) on delete cascade,
  snapshot_id uuid not null references public.macro_schedule_snapshots(id) on delete cascade,
  baseline_task_id uuid references public.macro_schedule_baseline_tasks(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  wbs text not null,
  title text not null default '',
  planned_pct numeric not null default 0,
  real_pct numeric not null default 0,
  weight numeric not null default 0,
  pv numeric not null default 0,
  ev numeric not null default 0,
  spi numeric,
  is_delayed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_macro_schedule_baselines_project_version
  on public.macro_schedule_baselines(project_id, version desc);

create index if not exists idx_macro_schedule_baselines_project_status
  on public.macro_schedule_baselines(project_id, status);

create index if not exists idx_macro_schedule_baseline_tasks_baseline_order
  on public.macro_schedule_baseline_tasks(baseline_id, sort_order);

create index if not exists idx_macro_schedule_snapshots_project_date
  on public.macro_schedule_snapshots(project_id, status_date);

create index if not exists idx_macro_schedule_snapshot_tasks_snapshot_wbs
  on public.macro_schedule_snapshot_tasks(snapshot_id, wbs);

drop trigger if exists set_updated_at_macro_schedule_baselines on public.macro_schedule_baselines;
create trigger set_updated_at_macro_schedule_baselines
  before update on public.macro_schedule_baselines
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_macro_schedule_snapshots on public.macro_schedule_snapshots;
create trigger set_updated_at_macro_schedule_snapshots
  before update on public.macro_schedule_snapshots
  for each row execute function public.set_updated_at();

alter table public.macro_schedule_baselines enable row level security;
alter table public.macro_schedule_baseline_tasks enable row level security;
alter table public.macro_schedule_snapshots enable row level security;
alter table public.macro_schedule_snapshot_tasks enable row level security;

grant select, insert, update, delete on public.macro_schedule_baselines to authenticated;
grant select, insert, update, delete on public.macro_schedule_baseline_tasks to authenticated;
grant select, insert, update, delete on public.macro_schedule_snapshots to authenticated;
grant select, insert, update, delete on public.macro_schedule_snapshot_tasks to authenticated;

drop policy if exists tenant_select on public.macro_schedule_baselines;
create policy tenant_select on public.macro_schedule_baselines
  for select to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_insert on public.macro_schedule_baselines;
create policy tenant_insert on public.macro_schedule_baselines
  for insert to authenticated
  with check (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_update on public.macro_schedule_baselines;
create policy tenant_update on public.macro_schedule_baselines
  for update to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin())
  with check (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_delete on public.macro_schedule_baselines;
create policy tenant_delete on public.macro_schedule_baselines
  for delete to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_select on public.macro_schedule_baseline_tasks;
create policy tenant_select on public.macro_schedule_baseline_tasks
  for select to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_insert on public.macro_schedule_baseline_tasks;
create policy tenant_insert on public.macro_schedule_baseline_tasks
  for insert to authenticated
  with check (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_update on public.macro_schedule_baseline_tasks;
create policy tenant_update on public.macro_schedule_baseline_tasks
  for update to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin())
  with check (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_delete on public.macro_schedule_baseline_tasks;
create policy tenant_delete on public.macro_schedule_baseline_tasks
  for delete to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_select on public.macro_schedule_snapshots;
create policy tenant_select on public.macro_schedule_snapshots
  for select to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_insert on public.macro_schedule_snapshots;
create policy tenant_insert on public.macro_schedule_snapshots
  for insert to authenticated
  with check (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_update on public.macro_schedule_snapshots;
create policy tenant_update on public.macro_schedule_snapshots
  for update to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin())
  with check (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_delete on public.macro_schedule_snapshots;
create policy tenant_delete on public.macro_schedule_snapshots
  for delete to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_select on public.macro_schedule_snapshot_tasks;
create policy tenant_select on public.macro_schedule_snapshot_tasks
  for select to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_insert on public.macro_schedule_snapshot_tasks;
create policy tenant_insert on public.macro_schedule_snapshot_tasks
  for insert to authenticated
  with check (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_update on public.macro_schedule_snapshot_tasks;
create policy tenant_update on public.macro_schedule_snapshot_tasks
  for update to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin())
  with check (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());

drop policy if exists tenant_delete on public.macro_schedule_snapshot_tasks;
create policy tenant_delete on public.macro_schedule_snapshot_tasks
  for delete to authenticated
  using (app_private.same_tenant(tenant_id) or app_private.is_platform_admin());
