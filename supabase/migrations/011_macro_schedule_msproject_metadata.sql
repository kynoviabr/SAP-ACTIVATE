-- Preserve MS Project XML metadata during import/export.

alter table public.macro_schedule_tasks
  add column if not exists source_uid integer,
  add column if not exists source_id integer,
  add column if not exists source_outline_number text,
  add column if not exists source_outline_level integer,
  add column if not exists source_calendar_uid integer,
  add column if not exists source_constraint_type integer,
  add column if not exists source_constraint_date timestamptz,
  add column if not exists source_is_summary boolean,
  add column if not exists source_is_critical boolean,
  add column if not exists source_is_active boolean,
  add column if not exists source_is_manual boolean,
  add column if not exists source_raw jsonb not null default '{}'::jsonb;

create index if not exists idx_macro_schedule_tasks_source_uid
  on public.macro_schedule_tasks(project_id, source_uid);
