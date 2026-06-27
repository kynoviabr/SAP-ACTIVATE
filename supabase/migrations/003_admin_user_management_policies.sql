create or replace function app_private.is_tenant_admin()
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
      and u.role = 'ADMIN'
      and u.active = true
  );
$$;

revoke execute on function app_private.is_tenant_admin() from public, anon;
grant execute on function app_private.is_tenant_admin() to authenticated;

create or replace function app_private.is_admin_for_tenant(row_tenant uuid)
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
      and u.tenant_id = row_tenant
      and u.role = 'ADMIN'
      and u.active = true
  );
$$;

revoke execute on function app_private.is_admin_for_tenant(uuid) from public, anon;
grant execute on function app_private.is_admin_for_tenant(uuid) to authenticated;

drop policy if exists users_admin_update on public.users;
create policy users_admin_update on public.users
  for update to authenticated
  using (app_private.is_admin_for_tenant(tenant_id))
  with check (app_private.is_admin_for_tenant(tenant_id));

drop policy if exists tenants_admin_update on public.tenants;
create policy tenants_admin_update on public.tenants
  for update to authenticated
  using (app_private.is_admin_for_tenant(id))
  with check (app_private.is_admin_for_tenant(id));
