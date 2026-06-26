-- Security hardening after initial schema.
-- Keeps helper functions out of the exposed public RPC schema where possible.

create schema if not exists app_private;
grant usage on schema app_private to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.users where id = (select auth.uid()) limit 1
$$;

create or replace function app_private.same_tenant(row_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select row_tenant = app_private.current_tenant_id()
$$;

create or replace function app_private.handle_new_user()
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

grant execute on function app_private.current_tenant_id() to authenticated;
grant execute on function app_private.same_tenant(uuid) to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

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
    execute format('alter table public.%I alter column tenant_id set default app_private.current_tenant_id()', t);
    execute format('drop policy if exists tenant_select on public.%I', t);
    execute format('drop policy if exists tenant_insert on public.%I', t);
    execute format('drop policy if exists tenant_update on public.%I', t);
    execute format('drop policy if exists tenant_delete on public.%I', t);
    execute format('create policy tenant_select on public.%I for select to authenticated using (app_private.same_tenant(tenant_id))', t);
    execute format('create policy tenant_insert on public.%I for insert to authenticated with check (app_private.same_tenant(tenant_id))', t);
    execute format('create policy tenant_update on public.%I for update to authenticated using (app_private.same_tenant(tenant_id)) with check (app_private.same_tenant(tenant_id))', t);
    execute format('create policy tenant_delete on public.%I for delete to authenticated using (app_private.same_tenant(tenant_id))', t);
  end loop;
end $$;

drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select to authenticated using (id = app_private.current_tenant_id());

drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated using (tenant_id = app_private.current_tenant_id());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists qg_templates_select on public.quality_gate_templates;
create policy qg_templates_select on public.quality_gate_templates
  for select to authenticated using (active = true and (tenant_id is null or tenant_id = app_private.current_tenant_id()));

drop policy if exists project_attachments_read on storage.objects;

revoke execute on function public.current_tenant_id() from public, anon, authenticated;
revoke execute on function public.same_tenant(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
