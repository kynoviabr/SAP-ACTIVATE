-- Consolidate tenant/user admin policies to avoid multiple permissive RLS checks.

drop policy if exists tenants_select on public.tenants;
drop policy if exists tenants_admin_update on public.tenants;
drop policy if exists tenants_super_admin_select on public.tenants;
drop policy if exists tenants_super_admin_update on public.tenants;

create policy tenants_select on public.tenants
  for select to authenticated
  using (id = app_private.current_tenant_id() or app_private.is_platform_admin());

create policy tenants_admin_update on public.tenants
  for update to authenticated
  using (app_private.is_admin_for_tenant(id) or app_private.is_platform_admin())
  with check (app_private.is_admin_for_tenant(id) or app_private.is_platform_admin());

drop policy if exists users_select on public.users;
drop policy if exists users_update_self on public.users;
drop policy if exists users_admin_update on public.users;
drop policy if exists users_super_admin_select on public.users;
drop policy if exists users_super_admin_update on public.users;

create policy users_select on public.users
  for select to authenticated
  using (tenant_id = app_private.current_tenant_id() or app_private.is_platform_admin());

create policy users_update on public.users
  for update to authenticated
  using (
    id = (select auth.uid())
    or app_private.is_admin_for_tenant(tenant_id)
    or app_private.is_platform_admin()
  )
  with check (
    id = (select auth.uid())
    or app_private.is_admin_for_tenant(tenant_id)
    or app_private.is_platform_admin()
  );
