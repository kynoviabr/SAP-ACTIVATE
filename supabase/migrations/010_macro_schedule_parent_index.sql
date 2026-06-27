-- Cover macro schedule self-referencing parent foreign key.

create index if not exists idx_macro_schedule_tasks_parent
  on public.macro_schedule_tasks(parent_id);
