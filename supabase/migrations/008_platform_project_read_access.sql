-- Platform admins can read projects across tenants for administrative KPIs.

drop policy if exists projects_super_admin_select on public.projects;
create policy projects_super_admin_select on public.projects
  for select to authenticated
  using (app_private.is_platform_admin());
