-- The source UID is stored for round-trip fidelity, but it is not queried yet.
drop index if exists public.idx_macro_schedule_tasks_source_uid;
