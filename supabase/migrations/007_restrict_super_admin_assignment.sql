-- Only platform admins can assign or keep SUPER_ADMIN through user updates.

drop policy if exists users_update on public.users;

create policy users_update on public.users
  for update to authenticated
  using (
    app_private.is_platform_admin()
    or id = (select auth.uid())
    or app_private.is_admin_for_tenant(tenant_id)
  )
  with check (
    app_private.is_platform_admin()
    or (
      role <> 'SUPER_ADMIN'
      and tenant_id = app_private.current_tenant_id()
      and (
        id = (select auth.uid())
        or app_private.is_admin_for_tenant(tenant_id)
      )
    )
  );
